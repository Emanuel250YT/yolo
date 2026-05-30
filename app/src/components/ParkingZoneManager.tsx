import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { ConfirmModal } from "./ConfirmModal";
import { DataTable, RefCell, TableActions } from "./DataTable";
import { ZoneBoundaryMap } from "./ZoneBoundaryMap";
import { ZonesMap } from "./ZonesMap";
import { useConfirmModal } from "../hooks/useConfirmModal";
import { formatRef } from "../utils/formatRef";
import { extractZonePolygonRings } from "../utils/zoneGeo";
import type { EntityNavTarget } from "../utils/entityNav";
import type { ParkingPolygon, ParkingZone } from "../types";

const EMPTY_FORM = {
  code: "",
  name: "",
  region: "Centro",
  description: "",
};

type ViewMode = "list" | "edit";
type ApiMode = "admin" | "municipio";

interface ParkingZoneManagerProps {
  apiMode?: ApiMode;
  initialView?: ViewMode;
  navTarget?: EntityNavTarget | null;
  onNavHandled?: () => void;
}

function zoneApi(mode: ApiMode) {
  if (mode === "municipio") {
    return {
      list: () => api.municipioParkingZones(),
      get: (id: string) => api.municipioParkingZone(id),
      create: (p: Record<string, unknown>) => api.municipioCreateParkingZone(p),
      update: (id: string, p: Record<string, unknown>) =>
        api.municipioUpdateParkingZone(id, p),
      delete: (id: string, force?: boolean) =>
        api.municipioDeleteParkingZone(id, force),
      deleteCheck: (id: string) => api.municipioParkingZoneDeleteCheck(id),
    };
  }
  return {
    list: () => api.adminParkingZones(),
    get: (id: string) => api.adminParkingZone(id),
    create: (p: Record<string, unknown>) => api.adminCreateParkingZone(p),
    update: (id: string, p: Record<string, unknown>) =>
      api.adminUpdateParkingZone(id, p),
      delete: (id: string, force?: boolean) => api.adminDeleteParkingZone(id, force),
      deleteCheck: (id: string) => api.adminParkingZoneDeleteCheck(id),
  };
}

export function ParkingZoneManager({
  apiMode = "admin",
  initialView = "list",
  navTarget,
  onNavHandled,
}: ParkingZoneManagerProps) {
  const zonesApi = useMemo(() => zoneApi(apiMode), [apiMode]);
  const [view, setView] = useState<ViewMode>(initialView);
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [polygons, setPolygons] = useState<ParkingPolygon[]>([]);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { modal, confirm, confirmDanger } = useConfirmModal();

  const load = useCallback(async () => {
    setError(null);
    try {
      const { zones: z } = await zonesApi.list();
      setZones(z);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar zonas");
    }
  }, [zonesApi]);

  useEffect(() => {
    load();
  }, [load]);

  const otherZones = useMemo(
    () => zones.filter((z) => z.id !== selectedId),
    [zones, selectedId],
  );

  function resetEditor() {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setPolygons([]);
    setImageSrc(null);
    setImageSize({ w: 0, h: 0 });
    setEnabled(true);
  }

  function startNewZone() {
    resetEditor();
    setView("edit");
    void load();
  }

  function backToList() {
    resetEditor();
    setView("list");
  }

  async function openZone(id: string) {
    try {
      const { zone } = await zonesApi.get(id);
      setSelectedId(zone.id);
      setForm({
        code: zone.code,
        name: zone.name,
        region: zone.region ?? "Centro",
        description: zone.description,
      });
      setPolygons(zone.polygons ?? []);
      setEnabled(zone.enabled);
      if (zone.imageBase64 && zone.imageMimeType) {
        setImageSrc(`data:${zone.imageMimeType};base64,${zone.imageBase64}`);
        setImageSize({
          w: zone.imageWidth ?? 0,
          h: zone.imageHeight ?? 0,
        });
      } else {
        setImageSrc(null);
        setImageSize({ w: 0, h: 0 });
      }
      setView("edit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  useEffect(() => {
    if (!navTarget || navTarget.kind !== "zone") return;
    const z =
      zones.find(
        (x) =>
          formatRef(x) === navTarget.ref ||
          x.id === navTarget.id ||
          x.id === navTarget.ref,
      ) ?? null;
    if (z) {
      void openZone(z.id);
      onNavHandled?.();
    }
  }, [navTarget, zones, onNavHandled]);

  function onImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        setImageSrc(src);
        setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  async function saveZone(e: React.FormEvent) {
    e.preventDefault();
    if (!polygons.some((p) => p.points.length >= 3)) {
      setError("Delimitá la zona en el mapa (mínimo 3 puntos).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        code: form.code,
        name: form.name,
        region: form.region,
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
        await zonesApi.update(selectedId, payload);
      } else {
        await zonesApi.create(payload);
      }
      await load();
      backToList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function deleteZone(id: string, name: string) {
    const ok = await confirm({
      title: "Eliminar zona",
      message: `¿Eliminar la zona «${name}»? Se desvincularán permisionarios y se cerrarán permisos y reservas activas en esta zona.`,
      confirmLabel: "Eliminar zona",
    });
    if (!ok) return;

    try {
      await zonesApi.delete(id);
      if (selectedId === id) backToList();
      await load();
    } catch (err) {
      await confirmDanger({
        title: "Error al eliminar",
        message: err instanceof Error ? err.message : "Error al eliminar la zona.",
        confirmLabel: "Entendido",
        showCancel: false,
      });
    }
  }

  if (view === "edit") {
    return (
      <div className="zone-manager zone-manager--edit">
        {modal && (
          <ConfirmModal
            open
            title={modal.title}
            message={modal.message}
            variant={modal.variant}
            confirmLabel={modal.confirmLabel}
            cancelLabel={modal.cancelLabel}
            showCancel={modal.showCancel}
            onConfirm={modal.onConfirm}
            onCancel={modal.onCancel}
          />
        )}
        {error && <p className="form-error banner-error">{error}</p>}

        <header className="zone-editor-head">
          <button type="button" className="btn-small" onClick={backToList}>
            ← Volver al listado
          </button>
          <h2>{selectedId ? "Editar zona" : "Nueva zona"}</h2>
        </header>

        <section className="panel">
          <p className="panel-desc">
            Delimitá el sector en el mapa haciendo clic en las esquinas de la
            cuadra. Las zonas ya registradas aparecen en gris para evitar
            superposiciones. Podés arrastrar cada vértice para ajustarlo.
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
              <label>
                Región *
                <select
                  required
                  value={form.region}
                  onChange={(e) =>
                    setForm({ ...form, region: e.target.value })
                  }
                >
                  {["Centro", "Norte", "Sur", "Este", "Oeste"].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
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

            <ZoneBoundaryMap
              polygons={polygons}
              onPolygonsChange={setPolygons}
              otherZones={otherZones}
              referenceImageUrl={imageSrc}
              editable
              height={480}
              hint="Clic para agregar vértices. Arrastrá los puntos rojos (borrador) o azules (zona guardada) para moverlos. Las zonas existentes se muestran en gris."
            />

            {otherZones.length > 0 && (
              <div className="existing-zones-panel">
                <span className="existing-zones-label">
                  Zonas ya registradas ({otherZones.length}):
                </span>
                <ul className="existing-zones-chips">
                  {otherZones.map((z) => (
                    <li key={z.id}>
                      <span className="zone-chip zone-chip--readonly">
                        <strong>{formatRef(z)}</strong> {z.name}
                        {extractZonePolygonRings(z).length > 0
                          ? ""
                          : " · sin mapa"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <label>
              Imagen de referencia (opcional)
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImageFile(f);
                }}
              />
            </label>
            {imageSrc && (
              <div className="zone-image-preview">
                <img src={imageSrc} alt="Vista previa zona" />
              </div>
            )}
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Zona habilitada
            </label>

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
                  onClick={() => {
                    const z = zones.find((x) => x.id === selectedId);
                    if (z) deleteZone(selectedId, z.name);
                  }}
                >
                  Eliminar
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="zone-manager">
      {modal && (
        <ConfirmModal
          open
          title={modal.title}
          message={modal.message}
          variant={modal.variant}
          confirmLabel={modal.confirmLabel}
          cancelLabel={modal.cancelLabel}
          showCancel={modal.showCancel}
          onConfirm={modal.onConfirm}
          onCancel={modal.onCancel}
        />
      )}
      {error && <p className="form-error banner-error">{error}</p>}

      <section className="panel">
        <h2>Mapa de zonas</h2>
        <p className="panel-desc">
          Vista general de todas las zonas delimitadas. Los colores indican
          ocupación según plazas registradas.
        </p>
        <ZonesMap spots={[]} zones={zones} height={320} />
      </section>

      <section className="panel">
        <div className="row-between">
          <h2>Catálogo de zonas ({zones.length})</h2>
          <button type="button" className="btn-primary btn-small" onClick={startNewZone}>
            + Nueva zona
          </button>
        </div>

        <DataTable
          rows={zones}
          rowKey={(z) => z.id}
          searchPlaceholder="Buscar por ID, nombre o código…"
          emptyMessage="No hay zonas. Creá la primera con el botón superior."
          filters={[
            {
              key: "enabled",
              label: "Estado",
              options: [
                { value: "true", label: "Habilitada" },
                { value: "false", label: "Inactiva" },
              ],
            },
          ]}
          columns={[
            {
              key: "ref",
              header: "ID",
              searchValues: (z) => [z.ref, z.id],
              render: (z) => <RefCell refId={formatRef(z)} entityKind="zone" />,
            },
            {
              key: "name",
              header: "Nombre",
              searchValues: (z) => [z.name, z.code, z.region],
              render: (z) => z.name,
            },
            {
              key: "code",
              header: "Código",
              searchValues: (z) => [z.code],
              render: (z) => <span className="chip">{z.code}</span>,
            },
            {
              key: "region",
              header: "Región",
              searchValues: (z) => [z.region],
              render: (z) => z.region ?? "Centro",
            },
            {
              key: "map",
              header: "Mapa",
              render: (z) =>
                z.polygons.some((p) => p.points.length >= 3) ? "Sí" : "No",
            },
            {
              key: "image",
              header: "Imagen",
              render: (z) => (z.hasImage ? "Sí" : "No"),
            },
            {
              key: "enabled",
              header: "Estado",
              filterKey: "enabled",
              searchValues: (z) => [String(z.enabled)],
              render: (z) => (z.enabled ? "Habilitada" : "Inactiva"),
            },
            {
              key: "actions",
              header: "Acciones",
              render: (z) => (
                <TableActions>
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => openZone(z.id)}
                  >
                    Ver
                  </button>
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => openZone(z.id)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn-small btn-danger"
                    onClick={() => deleteZone(z.id, z.name)}
                  >
                    Eliminar
                  </button>
                </TableActions>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
