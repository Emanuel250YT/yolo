import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useSubmitLock } from "../hooks/useSubmitLock";
import { DataTable, RefCell, TableActions } from "./DataTable";
import {
  EMPTY_PERSONAL_INFO,
  PersonalInfoFields,
  validatePersonalInfo,
  type PersonalInfoForm,
} from "./PersonalInfoFields";
import { PasswordInput } from "./PasswordInput";
import { RegisterStepper } from "./RegisterStepper";
import { SearchableSelect } from "./SearchableSelect";
import type { ParkingZone, User, UserRole } from "../types";
import { zoneIdOptions } from "../utils/selectOptions";
import { formatRef } from "../utils/formatRef";
import type { EntityNavTarget } from "../utils/entityNav";

const STEPS = ["Tipo de cuenta", "Datos", "Acceso"] as const;

const ROLE_OPTIONS: {
  id: UserRole;
  label: string;
  desc: string;
}[] = [
  {
    id: "permisionario",
    label: "Permisionario",
    desc: "Requiere legajo y zona asignada del catálogo.",
  },
  {
    id: "admin",
    label: "Administrador",
    desc: "Acceso al panel de administración del SEM.",
  },
  {
    id: "conductor",
    label: "Conductor",
    desc: "Usuario ciudadano para reservas y estacionamiento.",
  },
];

function adminCanToggle(actorId: string, target: User): boolean {
  if (target.id === actorId) return false;
  if (target.role === "admin") return false;
  if (target.role === "municipio") return false;
  return true;
}

type UsersApiMode = "admin" | "municipio";

function usersApi(mode: UsersApiMode) {
  if (mode === "municipio") {
    return {
      list: () => api.municipioUsers(),
      create: (payload: Record<string, unknown>) =>
        api.municipioCreateUser(payload),
      update: (id: string, payload: Record<string, unknown>) =>
        api.municipioUpdateUser(id, payload),
    };
  }
  return {
    list: () => api.adminUsers(),
    create: (payload: Record<string, unknown>) =>
      api.adminCreateUser(payload),
    update: (id: string, payload: Record<string, unknown>) =>
      api.adminUpdateUser(id, payload),
  };
}

export function UsersManager({
  apiMode = "admin",
  navTarget,
  onNavHandled,
}: {
  apiMode?: UsersApiMode;
  navTarget?: EntityNavTarget | null;
  onNavHandled?: () => void;
} = {}) {
  const usersApiClient = useMemo(() => usersApi(apiMode), [apiMode]);
  const { user: actor } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole>("permisionario");
  const [name, setName] = useState("");
  const [legajo, setLegajo] = useState("");
  const [parkingZoneId, setParkingZoneId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [personal, setPersonal] = useState<PersonalInfoForm>(EMPTY_PERSONAL_INFO);
  const [editing, setEditing] = useState<User | null>(null);
  const [editZoneId, setEditZoneId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { busy: creating, run: runCreate } = useSubmitLock();
  const { busy: savingZone, run: runSaveZone } = useSubmitLock();
  const { busy: togglingId, run: runToggle } = useSubmitLock();

  const zoneOpts = useMemo(() => zoneIdOptions(zones), [zones]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [u, z] = await Promise.all([
        usersApiClient.list(),
        api.parkingZones(),
      ]);
      setUsers(u.users);
      setZones(z.zones);
      setParkingZoneId((prev) => prev || z.zones[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    }
  }, [usersApiClient]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!navTarget || navTarget.kind !== "user") return;
    const u =
      users.find(
        (x) =>
          formatRef(x) === navTarget.ref ||
          x.id === navTarget.id ||
          x.id === navTarget.ref,
      ) ?? null;
    if (u && u.role === "permisionario") {
      setEditing(u);
      setEditZoneId(
        u.parkingZoneId ??
          zones.find((z) => z.code === u.zone)?.id ??
          zones[0]?.id ??
          "",
      );
      onNavHandled?.();
    }
  }, [navTarget, users, zones, onNavHandled]);

  function validateStep2(): string | null {
    if (!name.trim()) return "El nombre completo es obligatorio.";
    if (role === "permisionario" && !legajo.trim()) {
      return "El legajo es obligatorio para permisionarios.";
    }
    if (role === "permisionario" && !parkingZoneId) {
      return "Seleccioná la zona asignada.";
    }
    return validatePersonalInfo(personal);
  }

  function validateStep3(): string | null {
    if (!email.trim()) return "El correo electrónico es obligatorio.";
    if (password.length < 6) {
      return "La contraseña debe tener al menos 6 caracteres.";
    }
    if (password !== password2) return "Las contraseñas no coinciden.";
    return null;
  }

  function goNext() {
    setError(null);
    const err = step === 2 ? validateStep2() : null;
    if (err) {
      setError(err);
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function resetForm() {
    setStep(1);
    setRole("permisionario");
    setName("");
    setLegajo("");
    setEmail("");
    setPassword("");
    setPassword2("");
    setPersonal(EMPTY_PERSONAL_INFO);
    setParkingZoneId(zones[0]?.id ?? "");
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep3();
    if (err) {
      setError(err);
      return;
    }
    await runCreate(async () => {
      setError(null);
      try {
        const payload: Record<string, unknown> = {
          email,
          password,
          name,
          role,
          citizen: personal,
        };
        if (role === "permisionario") {
          payload.legajo = legajo;
          payload.parkingZoneId = parkingZoneId;
        }
        await usersApiClient.create(payload);
        resetForm();
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  async function toggleUser(u: User) {
    if (!actor || !adminCanToggle(actor.id, u) || togglingId) return;
    await runToggle(async () => {
      try {
        await usersApiClient.update(u.id, { active: !u.active });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  async function saveZoneAssignment() {
    if (!editing) return;
    await runSaveZone(async () => {
      try {
        await usersApiClient.update(editing.id, {
          parkingZoneId: editZoneId,
        });
        setEditing(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar zona");
      }
    });
  }

  return (
    <div className="crud-layout">
      {error && <p className="form-error banner-error">{error}</p>}

      <div className="split-panel">
        <section className="panel">
          <h2>Crear cuenta</h2>
          <p className="panel-desc">
            Mismo flujo que el registro público: tipo de cuenta, datos y acceso.
          </p>

          <RegisterStepper step={step} labels={[...STEPS]} />

          <form
            className="form-standard register-wizard"
            onSubmit={step === 3 ? createUser : (ev) => ev.preventDefault()}
          >
            {step === 1 && (
              <div className="wizard-panel">
                <h2 className="wizard-panel-title">Elegí el tipo de cuenta</h2>
                <fieldset className="role-picker">
                  <legend className="sr-only">Tipo de cuenta</legend>
                  <div className="role-grid">
                    {ROLE_OPTIONS.map((opt) => (
                      <label
                        key={opt.id}
                        className={`role-option ${role === opt.id ? "selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name={`${apiMode}-role`}
                          value={opt.id}
                          checked={role === opt.id}
                          onChange={() => {
                            setRole(opt.id);
                            setError(null);
                          }}
                        />
                        <span className="role-label">{opt.label}</span>
                        <span className="role-desc">{opt.desc}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

            {step === 2 && (
              <div className="wizard-panel">
                <h2 className="wizard-panel-title">Datos de la cuenta</h2>
                <div className="field">
                  <label htmlFor="admin-name">Nombre completo *</label>
                  <input
                    id="admin-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                {role === "permisionario" && (
                  <>
                    <div className="field">
                      <label htmlFor="admin-legajo">Legajo *</label>
                      <input
                        id="admin-legajo"
                        required
                        value={legajo}
                        onChange={(e) => setLegajo(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="admin-zone">Zona asignada *</label>
                      <SearchableSelect
                        id="admin-zone"
                        required
                        value={parkingZoneId}
                        onChange={setParkingZoneId}
                        options={zoneOpts}
                      />
                    </div>
                  </>
                )}
                <h3 className="wizard-subtitle">Información personal</h3>
                <PersonalInfoFields value={personal} onChange={setPersonal} />
              </div>
            )}

            {step === 3 && (
              <div className="wizard-panel">
                <h2 className="wizard-panel-title">Datos de acceso</h2>
                <p className="wizard-panel-desc">
                  La cuenta quedará activa al crearla.
                </p>
                <div className="field">
                  <label htmlFor="admin-email">Correo electrónico *</label>
                  <input
                    id="admin-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="admin-pass">Contraseña *</label>
                    <PasswordInput
                      id="admin-pass"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="admin-pass2">Repetir contraseña *</label>
                    <PasswordInput
                      id="admin-pass2"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="wizard-actions">
              {step > 1 && (
                <button type="button" className="btn-ghost" onClick={goBack}>
                  Atrás
                </button>
              )}
              {step < 3 ? (
                <button type="button" className="btn-primary" onClick={goNext}>
                  Siguiente
                </button>
              ) : (
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? "Creando…" : "Crear usuario"}
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel">
          <h2>Listado de usuarios</h2>
          <DataTable
            rows={users}
            rowKey={(u) => u.id}
            searchPlaceholder="Buscar por ID, nombre, email…"
            filters={[
              {
                key: "role",
                label: "Rol",
                options: [
                  { value: "permisionario", label: "Permisionario" },
                  { value: "admin", label: "Admin" },
                  { value: "conductor", label: "Conductor" },
                  { value: "municipio", label: "Municipio" },
                ],
              },
              {
                key: "active",
                label: "Estado",
                options: [
                  { value: "true", label: "Activo" },
                  { value: "false", label: "Inactivo" },
                ],
              },
            ]}
            columns={[
              {
                key: "ref",
                header: "ID",
                searchValues: (u) => [u.ref, u.id, u.name, u.email],
                render: (u) => (
                  <RefCell refId={formatRef(u)} entityKind="user" />
                ),
              },
              {
                key: "dni",
                header: "DNI",
                searchValues: (u) => [u.citizen?.dni],
                render: (u) => u.citizen?.dni ?? "—",
              },
              {
                key: "phone",
                header: "Teléfono",
                searchValues: (u) => [u.citizen?.phone],
                render: (u) => u.citizen?.phone ?? "—",
              },
              {
                key: "name",
                header: "Nombre",
                searchValues: (u) => [u.name],
                render: (u) => u.name,
              },
              {
                key: "email",
                header: "Email",
                searchValues: (u) => [u.email],
                render: (u) => u.email,
              },
              {
                key: "role",
                header: "Rol",
                filterKey: "role",
                searchValues: (u) => [u.role],
                render: (u) => <span className="chip">{u.role}</span>,
              },
              {
                key: "zone",
                header: "Zona",
                searchValues: (u) => [u.zoneName, u.zone],
                render: (u) =>
                  u.role === "permisionario"
                    ? u.zoneName ?? u.zone ?? "—"
                    : "—",
              },
              {
                key: "active",
                header: "Estado",
                filterKey: "active",
                searchValues: (u) => [String(u.active)],
                render: (u) => (u.active ? "Activo" : "Inactivo"),
              },
              {
                key: "actions",
                header: "Acciones",
                render: (u) => {
                  const canToggle = actor ? adminCanToggle(actor.id, u) : false;
                  return (
                    <TableActions>
                      {u.role === "permisionario" && (
                        <button
                          type="button"
                          className="btn-small"
                          onClick={() => {
                            setEditing(u);
                            setEditZoneId(
                              u.parkingZoneId ??
                                zones.find((z) => z.code === u.zone)?.id ??
                                zones[0]?.id ??
                                "",
                            );
                          }}
                        >
                          Editar
                        </button>
                      )}
                      {canToggle ? (
                        <button
                          type="button"
                          className="btn-small"
                          disabled={togglingId}
                          onClick={() => toggleUser(u)}
                        >
                          {u.active ? "Desactivar" : "Activar"}
                        </button>
                      ) : (
                        <span className="field-hint">—</span>
                      )}
                    </TableActions>
                  );
                },
              },
            ]}
          />
        </section>
      </div>

      {editing && (
        <section className="panel panel-edit">
          <h2>Zona de {editing.name}</h2>
          <div className="form-grid form-grid-inline">
            <label>
              Zona asignada
              <SearchableSelect
                value={editZoneId}
                onChange={setEditZoneId}
                options={zoneOpts}
              />
            </label>
            <button
              type="button"
              className="btn-primary"
              onClick={saveZoneAssignment}
              disabled={savingZone}
            >
              {savingZone ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
