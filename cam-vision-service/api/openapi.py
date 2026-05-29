"""Metadatos y ejemplos OpenAPI para Swagger UI."""

API_DESCRIPTION = """
API REST para **detección y tracking multi-objeto** con YOLO + BoT-SORT.

## Flujos de uso

### 1. Imagen única
Usa `POST /track/image` para analizar una foto y obtener detecciones con UUID estable.

### 2. Video completo
Usa `POST /track/video` para procesar un archivo `.mp4`, `.avi`, etc.
Puedes usar `frame_stride` para acelerar (procesar 1 de cada N frames).

### 3. Buffer / bytes
- `POST /track/buffer` — imagen en **base64** (JSON)
- `POST /track/buffer/raw` — bytes crudos de imagen (multipart)

### 4. Streaming por sesión
Ideal para cámara en vivo o frames sueltos con IDs persistentes:

1. `POST /sessions` → obtienes `session_id`
2. `POST /sessions/{session_id}/frame` → envías cada frame
3. `GET /sessions/{session_id}` → consultas estado y trayectorias
4. `DELETE /sessions/{session_id}` → liberas memoria

## Parámetros comunes

| Parámetro | Descripción |
|-----------|-------------|
| `conf` | Umbral de confianza (0–1). Default: `0.25` |
| `iou` | Umbral IoU para NMS (0–1). Default: `0.7` |
| `classes` | IDs COCO separados por coma. Ej: `2,3,5` (car, motorcycle, bus) |

## Variables de entorno

- `YOLO_MODEL` — ruta al modelo (default: `yolo26x.pt`)
- `YOLO_TRACKER` — config del tracker (default: `trackers/botsort.yaml`)
- `YOLO_CONF` / `YOLO_IOU` — defaults globales
"""

OPENAPI_TAGS = [
    {
        "name": "Sistema",
        "description": "Health check y estado del servicio.",
    },
    {
        "name": "Tracking · Imagen",
        "description": "Análisis de una sola imagen (archivo multipart).",
    },
    {
        "name": "Tracking · Buffer",
        "description": "Imágenes enviadas como base64 o bytes crudos.",
    },
    {
        "name": "Tracking · Video",
        "description": "Procesamiento de video completo con tracking persistente.",
    },
    {
        "name": "Sesiones",
        "description": "Tracking stateful frame a frame (cámara, RTSP, WebSocket, etc.).",
    },
]

SWAGGER_UI_PARAMETERS = {
    "docExpansion": "list",
    "defaultModelsExpandDepth": 2,
    "defaultModelExpandDepth": 2,
    "tryItOutEnabled": True,
    "persistAuthorization": True,
    "filter": True,
    "displayRequestDuration": True,
    "syntaxHighlight.theme": "monokai",
}

EXAMPLE_DETECTION = {
    "track_id": 1,
    "uuid": "5a5e62bf-560e-4d92-9f8c-fc8916f21724",
    "class_id": 2,
    "class_name": "car",
    "confidence": 0.9079,
    "bbox": {"x1": 346.8, "y1": 668.2, "x2": 463.7, "y2": 766.5},
    "center": {"x": 405.2, "y": 717.3},
    "reassociated": False,
}

EXAMPLE_FRAME_RESPONSE = {
    "frame_index": 0,
    "detections": [EXAMPLE_DETECTION],
    "summary": {"detection_count": 1, "unique_tracks": 1},
}

EXAMPLE_VIDEO_RESPONSE = {
    "video_info": {
        "width": 1920,
        "height": 1080,
        "fps": 30.0,
        "total_frames": 900,
        "processed_frames": 900,
        "frame_stride": 1,
    },
    "frames": [EXAMPLE_FRAME_RESPONSE],
    "global_summary": {
        "unique_tracks": 12,
        "total_frames_with_detections": 850,
        "total_frames": 900,
    },
    "registry": {
        "unique_tracks": 12,
        "tracks": [
            {
                "uuid": "5a5e62bf-560e-4d92-9f8c-fc8916f21724",
                "yolo_track_id": 1,
                "class_id": 2,
                "class_name": "car",
                "first_frame": 0,
                "last_frame": 899,
                "hit_count": 840,
                "avg_confidence": 0.82,
                "last_bbox": {"x1": 346.8, "y1": 668.2, "x2": 463.7, "y2": 766.5},
                "trajectory": [{"x": 405.2, "y": 717.3}],
            }
        ],
    },
}

EXAMPLE_SESSION_STATE = {
    "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "frames_processed": 42,
    "latest_frame": EXAMPLE_FRAME_RESPONSE,
    "registry": EXAMPLE_VIDEO_RESPONSE["registry"],
}

EXAMPLE_BUFFER_REQUEST = {
    "data_base64": "/9j/4AAQSkZJRgABAQEASABIAAD/2wBD...",
    "content_type": "image/jpeg",
}

COMMON_QUERY_PARAMS = {
    "conf": {
        "description": "Umbral de confianza del detector (0.0 – 1.0).",
        "ge": 0.0,
        "le": 1.0,
        "example": 0.25,
    },
    "iou": {
        "description": "Umbral IoU para Non-Max Suppression (0.0 – 1.0).",
        "ge": 0.0,
        "le": 1.0,
        "example": 0.7,
    },
    "classes": {
        "description": "Filtrar clases COCO por ID, separadas por coma. Ej: `2,3,5`",
        "example": "2,3,5",
    },
}
