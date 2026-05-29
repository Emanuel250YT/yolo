from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from uuid import uuid4

import cv2
import numpy as np
from ultralytics import YOLO

from .registry import TrackRegistry, bbox_center


DEFAULT_MODEL = os.getenv("YOLO_MODEL", "yolo26x.pt")
DEFAULT_TRACKER = os.getenv("YOLO_TRACKER", "trackers/botsort.yaml")


@dataclass
class FrameResult:
    frame_index: int
    detections: list[dict[str, Any]]
    summary: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "frame_index": self.frame_index,
            "detections": self.detections,
            "summary": self.summary,
        }


@dataclass
class VideoResult:
    frames: list[FrameResult] = field(default_factory=list)
    video_info: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "video_info": self.video_info,
            "frames": [frame.to_dict() for frame in self.frames],
            "global_summary": self.registry_summary(),
        }

    def registry_summary(self) -> dict[str, Any]:
        if not self.frames:
            return {"unique_tracks": 0, "total_frames_with_detections": 0}
        last_summary = self.frames[-1].summary
        frames_with_detections = sum(1 for frame in self.frames if frame.detections)
        return {
            "unique_tracks": last_summary.get("unique_tracks", 0),
            "total_frames_with_detections": frames_with_detections,
            "total_frames": len(self.frames),
        }


class TrackingEngine:
    def __init__(
        self,
        model_path: str = DEFAULT_MODEL,
        tracker: str = DEFAULT_TRACKER,
        conf: float = 0.25,
        iou: float = 0.7,
        classes: list[int] | None = None,
        device: str | None = None,
    ) -> None:
        self.model_path = model_path
        self.tracker = tracker
        self.conf = conf
        self.iou = iou
        self.classes = classes
        self.device = device
        self.model = YOLO(model_path)

    def _track_kwargs(self, persist: bool) -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "persist": persist,
            "conf": self.conf,
            "iou": self.iou,
            "tracker": self.tracker,
            "verbose": False,
        }
        if self.classes is not None:
            kwargs["classes"] = self.classes
        if self.device is not None:
            kwargs["device"] = self.device
        return kwargs

    @staticmethod
    def _decode_image(image_bytes: bytes) -> np.ndarray:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("No se pudo decodificar la imagen/buffer proporcionado.")
        return frame

    @staticmethod
    def _extract_detections(result, frame_idx: int) -> list[dict[str, Any]]:
        if result.boxes is None or len(result.boxes) == 0:
            return []

        boxes = result.boxes
        has_ids = boxes.id is not None
        track_ids = boxes.id.int().tolist() if has_ids else [None] * len(boxes)

        detections: list[dict[str, Any]] = []
        for box, track_id in zip(boxes, track_ids):
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            bbox = {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
            class_id = int(box.cls)
            detections.append(
                {
                    "track_id": int(track_id) if track_id is not None else None,
                    "class_id": class_id,
                    "class_name": result.names[class_id],
                    "confidence": round(float(box.conf), 4),
                    "bbox": bbox,
                    "center": bbox_center(bbox),
                }
            )
        return detections

    def process_frame(
        self,
        frame: np.ndarray,
        frame_index: int,
        registry: TrackRegistry,
        persist: bool = True,
    ) -> FrameResult:
        results = self.model.track(frame, **self._track_kwargs(persist=persist))
        result = results[0]
        raw_detections = self._extract_detections(result, frame_index)
        enriched = registry.update_frame(frame_index, raw_detections)

        return FrameResult(
            frame_index=frame_index,
            detections=enriched,
            summary={
                "detection_count": len(enriched),
                "unique_tracks": registry.unique_count,
            },
        )

    def process_image_bytes(
        self,
        image_bytes: bytes,
        registry: TrackRegistry | None = None,
        persist: bool = False,
    ) -> FrameResult:
        frame = self._decode_image(image_bytes)
        active_registry = registry or TrackRegistry()
        return self.process_frame(frame, 0, active_registry, persist=persist)

    def process_video_path(
        self,
        video_path: str | Path,
        registry: TrackRegistry | None = None,
        max_frames: int | None = None,
        frame_stride: int = 1,
    ) -> VideoResult:
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise ValueError(f"No se pudo abrir el video: {video_path}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        active_registry = registry or TrackRegistry()
        frames: list[FrameResult] = []
        frame_idx = 0
        processed = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_stride == 0:
                frame_result = self.process_frame(
                    frame, processed, active_registry, persist=True
                )
                frames.append(frame_result)
                processed += 1
                if max_frames is not None and processed >= max_frames:
                    break

            frame_idx += 1

        cap.release()

        video_result = VideoResult(
            frames=frames,
            video_info={
                "width": width,
                "height": height,
                "fps": fps,
                "total_frames": total_frames,
                "processed_frames": len(frames),
                "frame_stride": frame_stride,
            },
        )
        return video_result

    def process_video_bytes(
        self,
        video_bytes: bytes,
        suffix: str = ".mp4",
        **kwargs: Any,
    ) -> VideoResult:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(video_bytes)
            tmp_path = tmp.name

        try:
            return self.process_video_path(tmp_path, **kwargs)
        finally:
            Path(tmp_path).unlink(missing_ok=True)


class TrackingSession:
    """Stateful tracker for streaming frames with persistent IDs."""

    def __init__(self, engine: TrackingEngine | None = None, **engine_kwargs: Any) -> None:
        self.session_id = str(uuid4())
        self.engine = engine or TrackingEngine(**engine_kwargs)
        self.registry = TrackRegistry()
        self.frame_counter = 0
        self.history: list[FrameResult] = []

    def process_bytes(self, image_bytes: bytes) -> FrameResult:
        frame = TrackingEngine._decode_image(image_bytes)
        result = self.engine.process_frame(
            frame,
            self.frame_counter,
            self.registry,
            persist=True,
        )
        self.history.append(result)
        self.frame_counter += 1
        return result

    def get_state(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "frames_processed": self.frame_counter,
            "latest_frame": self.history[-1].to_dict() if self.history else None,
            "registry": self.registry.to_summary(),
        }
