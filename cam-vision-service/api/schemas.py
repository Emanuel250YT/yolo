from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from .openapi import EXAMPLE_BUFFER_REQUEST, EXAMPLE_FRAME_RESPONSE


class BBox(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {"x1": 100.0, "y1": 200.0, "x2": 300.0, "y2": 400.0}})

    x1: float = Field(..., description="Coordenada X superior izquierda")
    y1: float = Field(..., description="Coordenada Y superior izquierda")
    x2: float = Field(..., description="Coordenada X inferior derecha")
    y2: float = Field(..., description="Coordenada Y inferior derecha")


class Center(BaseModel):
    x: float = Field(..., description="Centro X del bounding box")
    y: float = Field(..., description="Centro Y del bounding box")


class Detection(BaseModel):
    track_id: int | None = Field(None, description="ID interno del tracker YOLO")
    uuid: str | None = Field(None, description="UUID estable asignado por el sistema")
    class_id: int = Field(..., description="ID de clase COCO")
    class_name: str = Field(..., description="Nombre de la clase detectada")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confianza del detector")
    bbox: BBox
    center: Center
    reassociated: bool | None = Field(
        None,
        description="True si el objeto fue re-asociado tras una oclusión",
    )


class FrameSummary(BaseModel):
    detection_count: int = Field(..., description="Detecciones en este frame")
    unique_tracks: int = Field(..., description="Total de objetos únicos rastreados hasta ahora")


class FrameResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": EXAMPLE_FRAME_RESPONSE})

    frame_index: int = Field(..., description="Índice del frame procesado")
    detections: list[Detection]
    summary: FrameSummary


class TrackSummary(BaseModel):
    uuid: str
    yolo_track_id: int
    class_id: int
    class_name: str
    first_frame: int
    last_frame: int
    hit_count: int = Field(..., description="Veces que el objeto fue detectado")
    avg_confidence: float
    last_bbox: BBox
    trajectory: list[Center] = Field(..., description="Historial de posiciones (centro del bbox)")


class RegistrySummary(BaseModel):
    unique_tracks: int
    tracks: list[TrackSummary]


class VideoInfo(BaseModel):
    width: int
    height: int
    fps: float
    total_frames: int
    processed_frames: int
    frame_stride: int = Field(..., description="Procesar 1 de cada N frames")


class GlobalSummary(BaseModel):
    unique_tracks: int
    total_frames_with_detections: int
    total_frames: int


class VideoResponse(BaseModel):
    video_info: VideoInfo
    frames: list[FrameResponse]
    global_summary: GlobalSummary
    registry: RegistrySummary | None = Field(
        None,
        description="Resumen global de todos los tracks del video",
    )


class SessionCreateResponse(BaseModel):
    session_id: str = Field(..., description="UUID de la sesión. Úsalo en los endpoints /sessions/{session_id}/...")
    message: str = "Sesión de tracking creada."


class SessionStateResponse(BaseModel):
    session_id: str
    frames_processed: int
    latest_frame: FrameResponse | None
    registry: RegistrySummary


class BufferTrackRequest(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": EXAMPLE_BUFFER_REQUEST})

    data_base64: str = Field(
        ...,
        description="Imagen codificada en base64 (sin prefijo data:image/...)",
        examples=["/9j/4AAQSkZJRgABAQEASABIAAD/2wBD..."],
    )
    content_type: str | None = Field(
        default="image/jpeg",
        description="Tipo MIME del buffer (image/jpeg, image/png, etc.)",
    )


class HealthResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "ok",
                "model": "yolo26x.pt",
                "tracker": "trackers/botsort.yaml",
            }
        }
    )

    status: str
    model: str
    tracker: str


class ErrorResponse(BaseModel):
    detail: str
