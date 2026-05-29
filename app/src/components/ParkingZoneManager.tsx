import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { ParkingPolygon, ParkingZone } from "../types";

const EMPTY_FORM = {
  code: "",
  name: "",
  description: "",
};

export function ParkingZoneManager() {
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [polygons, setPolygons] = useState<ParkingPolygon[]>([]);
  const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { zones: z } = await api.adminParkingZones();
      setZones(z);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar zonas");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imageSrc) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const toCanvas = (x: number, y: number) => ({
      x: x / scaleX,
      y: y / scaleY,
    });

    ctx.lineWidth = 2;
    polygons.forEach((poly, i) => {
      if (!poly.points.length) return;
      ctx.strokeStyle = i % 2 === 0 ? "#015cb4" : "#0d9488";
      ctx.fillStyle = i % 2 === 0 ? "rgba(1, 92, 180, 0.2)" : "rgba(13, 148, 136, 0.2)";
      ctx.beginPath();
      poly.points.forEach(([x, y], idx) => {
        const p = toCanvas(x, y);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    if (currentPoints.length) {
      ctx.strokeStyle = "#dc2626";
      ctx.fillStyle = "rgba(220, 38, 38, 0.25)";
      ctx.beginPath();
      currentPoints.forEach(([x, y], idx) => {
        const p = toCanvas(x, y);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (currentPoints.length >= 3) ctx.closePath();
      ctx.fill();
      ctx.stroke();
      currentPoints.forEach(([x, y]) => {
        const p = toCanvas(x, y);
        ctx.fillStyle = "#dc2626";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [imageSrc, polygons, currentPoints]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxW = Math.min(640, canvas.parentElement?.clientWidth ?? 640);
      const h = Math.round(maxW * (img.naturalHeight / img.naturalWidth));
      canvas.width = maxW;
      canvas.height = h;
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
      requestAnimationFrame(drawCanvas);
    };
    img.src = imageSrc;
  }, [imageSrc, drawCanvas]);

  function resetEditor() {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setPolygons([]);
    setCurrentPoints([]);
    setImageSrc(null);
    setImageSize({ w: 0, h: 0 });
    setEnabled(true);
    imgRef.current = null;
  }

  async function openZone(id: string) {
    try {
      const { zone } = await api.adminParkingZone(id);
      setSelectedId(zone.id);
      setForm({
        code: zone.code,
        name: zone.name,
        description: zone.description,
      });
      setPolygons(zone.polygons);
      setEnabled(zone.enabled);
      setCurrentPoints([]);
      if (zone.imageBase64 && zone.imageMimeType) {
        setImageSrc(`data:${zone.imageMimeType};base64,${zone.imageBase64}`);
      } else {
        setImageSrc(null);
        imgRef.current = null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  function onImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        setImageSrc(src);
        setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    setCurrentPoints((pts) => [...pts, [x, y]]);
  }

  function finishPolygon() {
    if (currentPoints.length < 3) {
      setError("Marcá al menos 3 puntos para cerrar el polígono.");
      return;
    }
    setPolygons((p) => [...p, { points: currentPoints }]);
    setCurrentPoints([]);
    setError(null);
  }

  function undoPoint() {
    setCurrentPoints((pts) => pts.slice(0, -1));
  }

  function removePolygon(index: number) {
    setPolygons((p) => p.filter((_, i) => i !== index));
  }

  async function saveZone(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        code: form.code,
        name: form.name,
        description: form.description,
        polygons,
        enabled,
        imageWidth: imageSize.w || undefined,
        imageHeight: imageSize.h || undefined,
      };
      if (imageSrc?.startsWith("data:")) {
        payload.imageBase64 = imageSrc;
      }

      if (selectedId) {
        await api.adminUpdateParkingZone(selectedId, payload);
      } else {
        const { zone } = await api.adminCreateParkingZone(payload);
        setSelectedId(zone.id);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function deleteZone() {
    if (!selectedId || !confirm("¿Eliminar esta zona de parking?")) return;
    try {
      await api.adminDeleteParkingZone(selectedId);
      resetEditor();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <div className="zone-manager">
      {error && <p className="form-error banner-error">{error}</p>}

      <div className="split-panel zone-split">
        <section className="panel">
          <div className="row-between">
            <h2>Zonas ({zones.length})</h2>
            <button type="button" className="btn-small" onClick={resetEditor}>
              Nueva
            </button>
          </div>
          <div className="card-list">
            {zones.map((z) => (
              <button
                key={z.id}
                type="button"
                className={`list-card clickable ${selectedId === z.id ? "selected" : ""}`}
                onClick={() => openZone(z.id)}
              >
                <strong>{z.name}</strong>
                <span className="chip">{z.code}</span>
                <p className="meta">
                  {z.slotCount} espacios · {z.hasImage ? "con imagen" : "sin imagen"}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>{selectedId ? "Editar zona" : "Nueva zona de parking"}</h2>
          <p className="panel-desc">
            Subí la imagen de referencia y marcá polígonos (formato compatible con
            PyTorch / Ultralytics: lista de puntos por espacio).
          </p>

          <form className="form-grid" onSubmit={saveZone}>
            <div className="form-row">
              <label>
                Código *
                <input
                  required
                  disabled={Boolean(selectedId)}
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value })
                  }
                  placeholder="microcentro"
                />
              </label>
              <label>
                Nombre *
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Descripción
              <input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label>
              Imagen de referencia
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImageFile(f);
                }}
              />
            </label>
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Zona habilitada
            </label>

            {imageSrc && (
              <div className="zone-canvas-wrap">
                <p className="zone-hint">
                  Clic en la imagen para agregar vértices. Cerrá cada espacio con
                  el botón inferior.
                </p>
                <div className="zone-toolbar">
                  <button
                    type="button"
                    className="btn-small"
                    onClick={finishPolygon}
                  >
                    Cerrar polígono ({currentPoints.length} pts)
                  </button>
                  <button
                    type="button"
                    className="btn-small btn-ghost"
                    onClick={undoPoint}
                    disabled={!currentPoints.length}
                  >
                    Deshacer punto
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  className="zone-canvas"
                  onClick={handleCanvasClick}
                />
                <ul className="zone-poly-list">
                  {polygons.map((poly, i) => (
                    <li key={i}>
                      Espacio {i + 1}: {poly.points.length} puntos
                      <button
                        type="button"
                        className="btn-small btn-danger"
                        onClick={() => removePolygon(i)}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="form-actions-row">
              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
              >
                {saving ? "Guardando…" : "Guardar zona"}
              </button>
              {selectedId && (
                <button
                  type="button"
                  className="btn-small btn-danger"
                  onClick={deleteZone}
                >
                  Eliminar
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
