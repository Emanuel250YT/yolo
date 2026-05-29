"""CLI de ejemplo usando el motor de tracking mejorado."""

import argparse
import json
from pathlib import Path

from tracking.engine import TrackingEngine
from tracking.registry import TrackRegistry


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Tracking YOLO con UUIDs estables.")
    parser.add_argument("--source", default="./dev.mp4",
                        help="Ruta a imagen o video.")
    parser.add_argument("--model", default="yolo26x.pt", help="Modelo YOLO.")
    parser.add_argument(
        "--tracker", default="trackers/botsort.yaml", help="Config del tracker.")
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--iou", type=float, default=0.7)
    parser.add_argument("--frame-stride", type=int, default=1)
    parser.add_argument("--max-frames", type=int, default=None)
    parser.add_argument("--output", default=None,
                        help="Guardar resultados JSON.")
    args = parser.parse_args()

    engine = TrackingEngine(
        model_path=args.model,
        tracker=args.tracker,
        conf=args.conf,
        iou=args.iou,
    )
    registry = TrackRegistry()
    source = Path(args.source)

    if source.suffix.lower() in {".mp4", ".avi", ".mov", ".mkv", ".webm"}:
        result = engine.process_video_path(
            source,
            registry=registry,
            max_frames=args.max_frames,
            frame_stride=args.frame_stride,
        )

        payload = result.to_dict()
        payload["registry"] = registry.to_summary()
    else:
        image_bytes = source.read_bytes()
        frame_result = engine.process_image_bytes(
            image_bytes, registry=registry)
        payload = {
            "frame": frame_result.to_dict(),
            "registry": registry.to_summary(),
        }

    print(json.dumps(payload, indent=2, ensure_ascii=False))

    if args.output:
        Path(args.output).write_text(
            json.dumps(payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"\nResultados guardados en {args.output}")


if __name__ == "__main__":
    main()
