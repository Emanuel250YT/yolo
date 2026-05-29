# cam-vision-service

API FastAPI para detección y seguimiento de vehículos con YOLO (Ultralytics).

## Requisitos

- Python 3.10+
- CUDA opcional (GPU)

## Instalación

```bash
cd cam-vision-service
pip install -r requirements.txt
```

## Ejecutar la API

Desde esta carpeta:

```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

Documentación: http://localhost:8000/docs

## Variables de entorno

| Variable       | Default                 |
|----------------|-------------------------|
| `YOLO_MODEL`   | `yolo26x.pt`            |
| `YOLO_TRACKER` | `trackers/botsort.yaml` |
| `YOLO_CONF`    | `0.25`                  |
| `YOLO_IOU`     | `0.7`                   |

## CLI

```bash
python main.py --source ./video.mp4 --output resultados.json
```
