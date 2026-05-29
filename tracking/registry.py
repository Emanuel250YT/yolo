from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
import uuid


def bbox_iou(a: dict[str, float], b: dict[str, float]) -> float:
    x1 = max(a["x1"], b["x1"])
    y1 = max(a["y1"], b["y1"])
    x2 = min(a["x2"], b["x2"])
    y2 = min(a["y2"], b["y2"])

    inter_w = max(0.0, x2 - x1)
    inter_h = max(0.0, y2 - y1)
    inter = inter_w * inter_h
    if inter <= 0:
        return 0.0

    area_a = (a["x2"] - a["x1"]) * (a["y2"] - a["y1"])
    area_b = (b["x2"] - b["x1"]) * (b["y2"] - b["y1"])
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def bbox_center(bbox: dict[str, float]) -> dict[str, float]:
    return {
        "x": (bbox["x1"] + bbox["x2"]) / 2,
        "y": (bbox["y1"] + bbox["y2"]) / 2,
    }


@dataclass
class TrackRecord:
    uuid: str
    yolo_track_id: int
    class_id: int
    class_name: str
    first_frame: int
    last_frame: int
    last_bbox: dict[str, float]
    trajectory: list[dict[str, float]] = field(default_factory=list)
    confidence_history: list[float] = field(default_factory=list)
    hit_count: int = 0

    def update(
        self,
        frame_idx: int,
        bbox: dict[str, float],
        confidence: float,
        yolo_track_id: int | None = None,
    ) -> None:
        if yolo_track_id is not None:
            self.yolo_track_id = yolo_track_id
        self.last_frame = frame_idx
        self.last_bbox = bbox
        self.trajectory.append(bbox_center(bbox))
        self.confidence_history.append(confidence)
        self.hit_count += 1


@dataclass
class LostTrack:
    uuid: str
    class_id: int
    class_name: str
    last_bbox: dict[str, float]
    lost_at_frame: int
    record: TrackRecord


class TrackRegistry:
    """Maps YOLO track IDs to stable UUIDs with re-association for occlusions."""

    def __init__(
        self,
        reid_iou_threshold: float = 0.4,
        reid_max_frames: int = 90,
        max_trajectory_points: int = 120,
    ) -> None:
        self.reid_iou_threshold = reid_iou_threshold
        self.reid_max_frames = reid_max_frames
        self.max_trajectory_points = max_trajectory_points
        self._by_yolo_id: dict[int, TrackRecord] = {}
        self._by_uuid: dict[str, TrackRecord] = {}
        self._lost: list[LostTrack] = []

    @property
    def unique_count(self) -> int:
        return len(self._by_uuid)

    def get_all_tracks(self) -> list[TrackRecord]:
        return sorted(self._by_uuid.values(), key=lambda t: t.first_frame)

    def _trim_trajectory(self, record: TrackRecord) -> None:
        if len(record.trajectory) > self.max_trajectory_points:
            record.trajectory = record.trajectory[-self.max_trajectory_points :]
        if len(record.confidence_history) > self.max_trajectory_points:
            record.confidence_history = record.confidence_history[
                -self.max_trajectory_points :
            ]

    def _expire_lost(self, frame_idx: int) -> None:
        self._lost = [
            lost
            for lost in self._lost
            if frame_idx - lost.lost_at_frame <= self.reid_max_frames
        ]

    def _mark_missing_as_lost(self, frame_idx: int, active_yolo_ids: set[int]) -> None:
        for yolo_id, record in list(self._by_yolo_id.items()):
            if yolo_id not in active_yolo_ids:
                self._lost.append(
                    LostTrack(
                        uuid=record.uuid,
                        class_id=record.class_id,
                        class_name=record.class_name,
                        last_bbox=record.last_bbox,
                        lost_at_frame=frame_idx,
                        record=record,
                    )
                )
                del self._by_yolo_id[yolo_id]

    def _try_reassociate(
        self,
        class_id: int,
        bbox: dict[str, float],
        frame_idx: int,
    ) -> TrackRecord | None:
        best: LostTrack | None = None
        best_iou = 0.0

        for lost in self._lost:
            if lost.class_id != class_id:
                continue
            if frame_idx - lost.lost_at_frame > self.reid_max_frames:
                continue
            iou = bbox_iou(bbox, lost.last_bbox)
            if iou >= self.reid_iou_threshold and iou > best_iou:
                best = lost
                best_iou = iou

        if best is None:
            return None

        self._lost = [lost for lost in self._lost if lost.uuid != best.uuid]
        return best.record

    def update_frame(
        self,
        frame_idx: int,
        detections: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        self._expire_lost(frame_idx)
        active_yolo_ids = {det["track_id"] for det in detections if det["track_id"] is not None}

        enriched: list[dict[str, Any]] = []
        seen_yolo_ids: set[int] = set()

        for det in detections:
            yolo_id = det["track_id"]
            if yolo_id is None:
                enriched.append({**det, "uuid": None, "reassociated": False})
                continue

            seen_yolo_ids.add(yolo_id)
            bbox = det["bbox"]
            reassociated = False

            if yolo_id in self._by_yolo_id:
                record = self._by_yolo_id[yolo_id]
            else:
                record = self._try_reassociate(det["class_id"], bbox, frame_idx)
                if record is not None:
                    reassociated = True
                    self._by_yolo_id[yolo_id] = record
                else:
                    record = TrackRecord(
                        uuid=str(uuid.uuid4()),
                        yolo_track_id=yolo_id,
                        class_id=det["class_id"],
                        class_name=det["class_name"],
                        first_frame=frame_idx,
                        last_frame=frame_idx,
                        last_bbox=bbox,
                    )
                    self._by_yolo_id[yolo_id] = record
                    self._by_uuid[record.uuid] = record

            record.update(frame_idx, bbox, det["confidence"], yolo_id)
            self._trim_trajectory(record)
            enriched.append({**det, "uuid": record.uuid, "reassociated": reassociated})

        self._mark_missing_as_lost(frame_idx, seen_yolo_ids)
        return enriched

    def to_summary(self) -> dict[str, Any]:
        tracks = []
        for record in self.get_all_tracks():
            avg_conf = (
                sum(record.confidence_history) / len(record.confidence_history)
                if record.confidence_history
                else 0.0
            )
            tracks.append(
                {
                    "uuid": record.uuid,
                    "yolo_track_id": record.yolo_track_id,
                    "class_id": record.class_id,
                    "class_name": record.class_name,
                    "first_frame": record.first_frame,
                    "last_frame": record.last_frame,
                    "hit_count": record.hit_count,
                    "avg_confidence": round(avg_conf, 4),
                    "last_bbox": record.last_bbox,
                    "trajectory": record.trajectory,
                }
            )

        return {
            "unique_tracks": self.unique_count,
            "tracks": tracks,
        }
