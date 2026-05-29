from ultralytics import YOLO
import uuid

# Load a pretrained YOLO model
model = YOLO("yolo26x.pt")

# Perform object detection on an image
# results = model("C:\\Users\\Emanuel\\Downloads\\b.mp4")

# Visualize the results
# for result in results:
#    result.show()

results = model.track(
    source=r"./dev.mp4",
    show=True,
    save=True,
    project="renders",
    name="video1",
    persist=True  # Mantiene los IDs entre frames
)

# Rastrear objetos únicos y asignar UUIDs
track_id_to_uuid = {}
element_count = 0

print("\n" + "="*80)
print("RASTREO DE OBJETOS EN VIDEO")
print("="*80)

for frame_idx, result in enumerate(results):
    if result.boxes.id is None:
        continue

    detections = result.boxes
    track_ids = detections.id.int().tolist()

    print(f"\nFrame {frame_idx}:")

    for box, track_id in zip(detections, track_ids):
        # Asignar UUID a este track ID si es la primera vez que lo vemos
        if track_id not in track_id_to_uuid:
            track_id_to_uuid[track_id] = str(uuid.uuid4())
            element_count += 1

        element_uuid = track_id_to_uuid[track_id]
        class_name = result.names[int(box.cls)]
        confidence = float(box.conf)

        print(
            f"  [ID {track_id}] UUID: {element_uuid} | Clase: {class_name} | Confianza: {confidence:.2f}")

print(f"\n{'='*80}")
print(f"Total de elementos únicos rastreados: {element_count}")
print(f"{'='*80}")
print(f"\nDiccionario de mapping (Track ID -> UUID):")
for track_id, obj_uuid in sorted(track_id_to_uuid.items()):
    print(f"  Track {track_id}: {obj_uuid}")
