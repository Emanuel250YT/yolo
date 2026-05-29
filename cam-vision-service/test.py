from ultralytics import YOLO
import uuid
import json

# Cambia esta ruta al video que quieres procesar
VIDEO_PATH = r"C:\Users\emanu\Downloads\b.mp4"
OUTPUT_JSON = "track_results.json"

model = YOLO("yolo26n.pt")

# Realiza seguimiento de objetos en el video y muestra el resultado visual
results = model.track(
    source=VIDEO_PATH,
    show=True,
    save=False,
    persist=True,
    device=0
)

track_id_to_uuid = {}
frames = []

for frame_idx, result in enumerate(results):
    if result.boxes is None:
        continue

    frame_data = {
        "frame": frame_idx,
        "objects": [],
    }

    track_ids = result.boxes.id.int().tolist() if result.boxes.id is not None else []

    for box, track_id in zip(result.boxes, track_ids):
        if track_id not in track_id_to_uuid:
            track_id_to_uuid[track_id] = str(uuid.uuid4())

        frame_data["objects"].append({
            "track_id": int(track_id),
            "uuid": track_id_to_uuid[track_id],
            "class": result.names[int(box.cls)],
            "confidence": float(box.conf),
            "xyxy": [float(x) for x in box.xyxy[0].tolist()],
        })

    if frame_data["objects"]:
        frames.append(frame_data)

output = {
    "video": VIDEO_PATH,
    "unique_objects": len(track_id_to_uuid),
    "tracks": track_id_to_uuid,
    "frames": frames,
}

with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"Resultados de seguimiento guardados en '{OUTPUT_JSON}'")
print(f"Objetos únicos rastreados: {len(track_id_to_uuid)}")
