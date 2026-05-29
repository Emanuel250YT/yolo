from __future__ import annotations

import base64
import os
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from tracking.engine import TrackingEngine, TrackingSession
from tracking.registry import TrackRegistry

from .openapi import (
    API_DESCRIPTION,
    EXAMPLE_FRAME_RESPONSE,
    EXAMPLE_SESSION_STATE,
    EXAMPLE_VIDEO_RESPONSE,
    OPENAPI_TAGS,
    SWAGGER_UI_PARAMETERS,
)
from .schemas import (
    BufferTrackRequest,
    ErrorResponse,
    FrameResponse,
    HealthResponse,
    SessionCreateResponse,
    SessionStateResponse,
    VideoResponse,
)

DEFAULT_MODEL = os.getenv("YOLO_MODEL", "yolo26x.pt")
DEFAULT_TRACKER = os.getenv("YOLO_TRACKER", "trackers/botsort.yaml")
DEFAULT_CONF = float(os.getenv("YOLO_CONF", "0.25"))
DEFAULT_IOU = float(os.getenv("YOLO_IOU", "0.7"))

ConfParam = Annotated[
    float | None,
    Query(ge=0.0, le=1.0, description="Umbral de confianza del detector (0–1)."),
]
IouParam = Annotated[
    float | None,
    Query(ge=0.0, le=1.0, description="Umbral IoU para NMS (0–1)."),
]
ClassesParam = Annotated[
    str | None,
    Query(description="IDs COCO separados por coma. Ej: `2,3,5` (car, motorcycle, bus)."),
]

engine: TrackingEngine | None = None
sessions: dict[str, TrackingSession] = {}


def get_engine(
    conf: float | None = None,
    iou: float | None = None,
    classes: list[int] | None = None,
) -> TrackingEngine:
    global engine
    if engine is None:
        engine = TrackingEngine(
            model_path=DEFAULT_MODEL,
            tracker=DEFAULT_TRACKER,
            conf=conf or DEFAULT_CONF,
            iou=iou or DEFAULT_IOU,
        )
        return engine

    if conf is not None:
        engine.conf = conf
    if iou is not None:
        engine.iou = iou
    if classes is not None:
        engine.classes = classes
    return engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_engine()
    yield
    sessions.clear()


app = FastAPI(
    title="YOLO Tracking API",
    description=API_DESCRIPTION,
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=OPENAPI_TAGS,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    swagger_ui_parameters=SWAGGER_UI_PARAMETERS,
    contact={
        "name": "YOLO Tracking",
    },
    license_info={
        "name": "AGPL-3.0 (Ultralytics)",
        "url": "https://ultralytics.com/license",
    },
)


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


@app.get("/swagger", include_in_schema=False)
async def swagger_redirect() -> RedirectResponse:
    return RedirectResponse(url="/docs")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _parse_classes(value: str | None) -> list[int] | None:
    if not value:
        return None
    return [int(item.strip()) for item in value.split(",") if item.strip()]


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Sistema"],
    summary="Estado del servicio",
    responses={500: {"model": ErrorResponse, "description": "Error interno"}},
)
async def health() -> HealthResponse:
    """Comprueba que la API y el modelo YOLO están cargados correctamente."""
    active_engine = get_engine()
    return HealthResponse(
        status="ok",
        model=active_engine.model_path,
        tracker=active_engine.tracker,
    )


@app.post(
    "/track/image",
    response_model=FrameResponse,
    tags=["Tracking · Imagen"],
    summary="Tracking en imagen (archivo)",
    responses={
        200: {
            "description": "Detecciones del frame",
            "content": {"application/json": {"example": EXAMPLE_FRAME_RESPONSE}},
        },
        400: {"model": ErrorResponse, "description": "Archivo vacío o inválido"},
    },
)
async def track_image(
    file: Annotated[
        UploadFile,
        File(description="Imagen JPG, PNG, WEBP, etc."),
    ],
    conf: Annotated[
        float | None,
        Form(description="Umbral de confianza (0–1). Vacío = default del servidor."),
    ] = None,
    iou: Annotated[
        float | None,
        Form(description="Umbral IoU para NMS (0–1). Vacío = default del servidor."),
    ] = None,
    classes: Annotated[
        str | None,
        Form(description="IDs COCO separados por coma. Ej: 2,3,5"),
    ] = None,
) -> FrameResponse:
    """
    Sube una imagen y obtén detecciones con **track_id**, **uuid** y bounding boxes.

    Ideal para pruebas rápidas desde Swagger: pulsa **Try it out**, selecciona un archivo y **Execute**.
    """
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Archivo de imagen vacío.")

    active_engine = get_engine(conf=conf, iou=iou, classes=_parse_classes(classes))
    registry = TrackRegistry()
    result = active_engine.process_image_bytes(image_bytes, registry=registry, persist=False)
    return FrameResponse.model_validate(result.to_dict())


@app.post(
    "/track/buffer",
    response_model=FrameResponse,
    tags=["Tracking · Buffer"],
    summary="Tracking en imagen (base64 JSON)",
    responses={
        200: {
            "description": "Detecciones del frame",
            "content": {"application/json": {"example": EXAMPLE_FRAME_RESPONSE}},
        },
        400: {"model": ErrorResponse, "description": "Base64 inválido"},
    },
)
async def track_buffer(
    payload: BufferTrackRequest,
    conf: ConfParam = None,
    iou: IouParam = None,
) -> FrameResponse:
    """
    Envía una imagen codificada en **base64** dentro de un JSON.

    Útil cuando el cliente no puede usar multipart/form-data.
    """
    try:
        image_bytes = base64.b64decode(payload.data_base64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Base64 inválido.") from exc

    active_engine = get_engine(conf=conf, iou=iou)
    registry = TrackRegistry()
    result = active_engine.process_image_bytes(image_bytes, registry=registry, persist=False)
    return FrameResponse.model_validate(result.to_dict())


@app.post(
    "/track/buffer/raw",
    response_model=FrameResponse,
    tags=["Tracking · Buffer"],
    summary="Tracking en imagen (bytes crudos)",
    responses={
        200: {
            "description": "Detecciones del frame",
            "content": {"application/json": {"example": EXAMPLE_FRAME_RESPONSE}},
        },
        400: {"model": ErrorResponse, "description": "Buffer vacío o inválido"},
    },
)
async def track_buffer_raw(
    file: Annotated[
        UploadFile,
        File(description="Bytes crudos de imagen (JPEG, PNG, etc.)"),
    ],
    conf: Annotated[float | None, Form(description="Umbral de confianza (0–1).")] = None,
    iou: Annotated[float | None, Form(description="Umbral IoU (0–1).")] = None,
) -> FrameResponse:
    """Sube bytes crudos de imagen sin metadata JSON adicional."""
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Buffer vacío.")

    active_engine = get_engine(conf=conf, iou=iou)
    registry = TrackRegistry()
    result = active_engine.process_image_bytes(raw_bytes, registry=registry, persist=False)
    return FrameResponse.model_validate(result.to_dict())


@app.post(
    "/track/video",
    response_model=VideoResponse,
    tags=["Tracking · Video"],
    summary="Tracking en video completo",
    responses={
        200: {
            "description": "Resultados frame a frame + resumen global",
            "content": {"application/json": {"example": EXAMPLE_VIDEO_RESPONSE}},
        },
        400: {"model": ErrorResponse, "description": "Video vacío o formato no soportado"},
    },
)
async def track_video(
    file: Annotated[
        UploadFile,
        File(description="Video MP4, AVI, MOV, MKV, WEBM, etc."),
    ],
    conf: Annotated[float | None, Form(description="Umbral de confianza (0–1).")] = None,
    iou: Annotated[float | None, Form(description="Umbral IoU (0–1).")] = None,
    frame_stride: Annotated[
        int,
        Form(description="Procesar 1 de cada N frames. Ej: 2 = mitad de frames."),
    ] = 1,
    max_frames: Annotated[
        int | None,
        Form(description="Límite máximo de frames a procesar (útil para pruebas)."),
    ] = None,
    classes: Annotated[
        str | None,
        Form(description="IDs COCO separados por coma. Ej: 2,3,5"),
    ] = None,
    include_registry: Annotated[
        bool,
        Form(description="Incluir resumen de tracks con trayectorias completas."),
    ] = True,
) -> VideoResponse:
    """
    Procesa un video completo manteniendo IDs persistentes entre frames.

    **Nota:** videos largos pueden tardar varios minutos. Usa `max_frames` o `frame_stride` para pruebas.
    """
    video_bytes = await file.read()
    if not video_bytes:
        raise HTTPException(status_code=400, detail="Archivo de video vacío.")

    suffix = os.path.splitext(file.filename or ".mp4")[1] or ".mp4"
    active_engine = get_engine(conf=conf, iou=iou, classes=_parse_classes(classes))
    registry = TrackRegistry()

    try:
        video_result = active_engine.process_video_bytes(
            video_bytes,
            suffix=suffix,
            registry=registry,
            max_frames=max_frames,
            frame_stride=max(1, frame_stride),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    payload = video_result.to_dict()
    if include_registry:
        payload["registry"] = registry.to_summary()
    return VideoResponse.model_validate(payload)


@app.post(
    "/sessions",
    response_model=SessionCreateResponse,
    tags=["Sesiones"],
    summary="Crear sesión de tracking",
    responses={
        200: {
            "description": "Sesión creada",
            "content": {
                "application/json": {
                    "example": {
                        "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                        "message": "Sesión de tracking creada.",
                    }
                }
            },
        },
    },
)
async def create_session(
    conf: Annotated[float | None, Form(description="Umbral de confianza para esta sesión.")] = None,
    iou: Annotated[float | None, Form(description="Umbral IoU para esta sesión.")] = None,
    classes: Annotated[
        str | None,
        Form(description="IDs COCO separados por coma. Ej: 2,3,5"),
    ] = None,
) -> SessionCreateResponse:
    """
    Crea una sesión stateful para enviar frames uno a uno.

    Los **UUIDs se mantienen** entre frames mientras la sesión esté activa.
    """
    session_engine = TrackingEngine(
        model_path=DEFAULT_MODEL,
        tracker=DEFAULT_TRACKER,
        conf=conf or DEFAULT_CONF,
        iou=iou or DEFAULT_IOU,
        classes=_parse_classes(classes),
    )
    session = TrackingSession(engine=session_engine)
    sessions[session.session_id] = session
    return SessionCreateResponse(session_id=session.session_id)


@app.post(
    "/sessions/{session_id}/frame",
    response_model=FrameResponse,
    tags=["Sesiones"],
    summary="Enviar frame a sesión",
    responses={
        200: {
            "description": "Detecciones del frame en la sesión",
            "content": {"application/json": {"example": EXAMPLE_FRAME_RESPONSE}},
        },
        404: {"model": ErrorResponse, "description": "Sesión no encontrada"},
        400: {"model": ErrorResponse, "description": "Frame vacío o base64 inválido"},
    },
)
async def track_session_frame(
    session_id: str,
    file: Annotated[
        UploadFile | None,
        File(description="Frame como imagen. Usa esto O data_base64, no ambos."),
    ] = None,
    data_base64: Annotated[
        str | None,
        Form(description="Frame codificado en base64 (alternativa a file)."),
    ] = None,
) -> FrameResponse:
    """
    Procesa un frame dentro de una sesión existente.

    1. Crea sesión con `POST /sessions`
    2. Copia el `session_id` en la URL
    3. Envía frames repetidamente con este endpoint
    """
    session = sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")

    if file is not None:
        image_bytes = await file.read()
    elif data_base64:
        try:
            image_bytes = base64.b64decode(data_base64, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Base64 inválido.") from exc
    else:
        raise HTTPException(
            status_code=400,
            detail="Envía un archivo (file) o data_base64.",
        )

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Frame vacío.")

    try:
        result = session.process_bytes(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return FrameResponse.model_validate(result.to_dict())


@app.get(
    "/sessions/{session_id}",
    response_model=SessionStateResponse,
    tags=["Sesiones"],
    summary="Estado de sesión",
    responses={
        200: {
            "description": "Estado acumulado de la sesión",
            "content": {"application/json": {"example": EXAMPLE_SESSION_STATE}},
        },
        404: {"model": ErrorResponse, "description": "Sesión no encontrada"},
    },
)
async def get_session_state(session_id: str) -> SessionStateResponse:
    """Devuelve frames procesados, último resultado y registro completo de tracks."""
    session = sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")
    return SessionStateResponse.model_validate(session.get_state())


@app.delete(
    "/sessions/{session_id}",
    tags=["Sesiones"],
    summary="Eliminar sesión",
    responses={
        200: {
            "description": "Sesión eliminada",
            "content": {
                "application/json": {
                    "example": {
                        "message": "Sesión eliminada.",
                        "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                    }
                }
            },
        },
        404: {"model": ErrorResponse, "description": "Sesión no encontrada"},
    },
)
async def delete_session(session_id: str) -> dict[str, str]:
    """Libera memoria y destruye el estado de tracking de la sesión."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")
    del sessions[session_id]
    return {"message": "Sesión eliminada.", "session_id": session_id}


@app.exception_handler(Exception)
async def unhandled_exception_handler(_, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"detail": f"Error interno: {exc}"},
    )
