import { useEffect, useMemo, useState } from "react";
import { api, unwrapPaginated } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useSubmitLock } from "../hooks/useSubmitLock";
import { usePaginatedTable } from "../hooks/usePaginatedTable";
import { useToast } from "./Toast";
import { DataTable, RefCell, TableActions } from "./DataTable";
import {
  EMPTY_PERSONAL_INFO,
  PersonalInfoFields,
  validatePersonalInfo,
  type PersonalInfoForm,
} from "./PersonalInfoFields";
import { PasswordInput } from "./PasswordInput";
import { RegisterStepper } from "./RegisterStepper";
import { AsyncMultiSelect } from "./AsyncSearchableSelect";
import type { User, UserRole } from "../types";
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
    desc: "Requiere legajo. Podés asignar cero, una o varias zonas.",
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
      list: (query?: { page?: number; pageSize?: number; q?: string; role?: string; active?: string }) =>
        api.municipioUsers({
          page: query?.page,
          pageSize: query?.pageSize,
          q: query?.q,
          role: query?.role,
          active: query?.active,
        }),
      create: (payload: Record<string, unknown>) =>
        api.municipioCreateUser(payload),
      update: (id: string, payload: Record<string, unknown>) =>
        api.municipioUpdateUser(id, payload),
      zoneOptions: api.municipioParkingZoneOptions,
    };
  }
  return {
    list: (query?: { page?: number; pageSize?: number; q?: string; role?: string; active?: string }) =>
      api.adminUsers({
        page: query?.page,
        pageSize: query?.pageSize,
        q: query?.q,
        role: query?.role,
        active: query?.active,
      }),
    create: (payload: Record<string, unknown>) =>
      api.adminCreateUser(payload),
    update: (id: string, payload: Record<string, unknown>) =>
      api.adminUpdateUser(id, payload),
    zoneOptions: api.adminParkingZoneOptions,
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
  const toast = useToast();
  const { user: actor } = useAuth();

  const { items: users, serverPagination, refresh } = usePaginatedTable<User>({
    fetchPage: async ({ page, pageSize, q, filters }) =>
      unwrapPaginated(
        "users",
        await usersApiClient.list({
          page,
          pageSize,
          q,
          role: filters.role,
          active: filters.active,
        }),
      ),
  });

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole>("permisionario");
  const [name, setName] = useState("");
  const [legajo, setLegajo] = useState("");
  const [parkingZoneIds, setParkingZoneIds] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [personal, setPersonal] = useState<PersonalInfoForm>(EMPTY_PERSONAL_INFO);
  const [editing, setEditing] = useState<User | null>(null);
  const [editZoneIds, setEditZoneIds] = useState<string[]>([]);
  const { busy: creating, run: runCreate } = useSubmitLock();
  const { busy: savingZone, run: runSaveZone } = useSubmitLock();
  const { busy: togglingId, run: runToggle } = useSubmitLock();

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
      setEditZoneIds(
        u.parkingZoneIds?.length
          ? u.parkingZoneIds
          : u.parkingZoneId
            ? [u.parkingZoneId]
            : [],
      );
      onNavHandled?.();
    }
  }, [navTarget, users, onNavHandled]);

  function validateStep2(): string | null {
    if (!name.trim()) return "El nombre completo es obligatorio.";
    if (role === "permisionario" && !legajo.trim()) {
      return "El legajo es obligatorio para permisionarios.";
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
    const err = step === 2 ? validateStep2() : null;
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  }

  function goBack() {
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
    setParkingZoneIds([]);
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep3();
    if (err) {
      toast.error(err);
      return;
    }
    await runCreate(async () => {
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
          payload.parkingZoneIds = parkingZoneIds;
        }
        await usersApiClient.create(payload);
        toast.success("Usuario creado correctamente.");
        resetForm();
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  async function toggleUser(u: User) {
    if (!actor || !adminCanToggle(actor.id, u) || togglingId) return;
    const action = u.active ? "desactivar" : "activar";
    const ok = await toast.confirm({
      title: u.active ? "Desactivar usuario" : "Activar usuario",
      message: `¿Confirmás ${action} a ${u.name}?`,
      confirmLabel: u.active ? "Desactivar" : "Activar",
    });
    if (!ok) return;
    await runToggle(async () => {
      try {
        await usersApiClient.update(u.id, { active: !u.active });
        toast.success(u.active ? "Usuario desactivado." : "Usuario activado.");
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  async function saveZoneAssignment() {
    if (!editing) return;
    await runSaveZone(async () => {
      try {
        await usersApiClient.update(editing.id, {
          parkingZoneIds: editZoneIds,
        });
        toast.success("Zonas actualizadas.");
        setEditing(null);
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al guardar zonas");
      }
    });
  }

  return (
    <div className="crud-layout">
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
                          onChange={() => setRole(opt.id)}
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
                      <label htmlFor="admin-zones">Zonas asignadas</label>
                      <AsyncMultiSelect
                        id="admin-zones"
                        values={parkingZoneIds}
                        onChange={setParkingZoneIds}
                        loadPage={usersApiClient.zoneOptions}
                        emptyLabel="Ninguna (sin zonas asignadas)"
                      />
                      <p className="field-hint">
                        Opcional. Podés asignar una o más zonas después.
                      </p>
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
            serverPagination={serverPagination}
            filters={[
              {
                key: "role",
                label: "Rol",
                options: [
                  { value: "permisionario", label: "Permisionario" },
                  { value: "admin", label: "Admin" },
                  { value: "conductor", label: "Conductor" },
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
                searchValues: (u) => [u.role],
                render: (u) => <span className="chip">{u.role}</span>,
              },
              {
                key: "zone",
                header: "Zonas",
                searchValues: (u) => [
                  u.zoneName,
                  u.zone,
                  ...(u.assignedZones?.map((z) => z.name) ?? []),
                ],
                render: (u) =>
                  u.role === "permisionario"
                    ? u.zoneName ??
                      u.assignedZones?.map((z) => z.name).join(", ") ??
                      u.zone ??
                      "—"
                    : "—",
              },
              {
                key: "active",
                header: "Estado",
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
                            setEditZoneIds(
                              u.parkingZoneIds?.length
                                ? u.parkingZoneIds
                                : u.parkingZoneId
                                  ? [u.parkingZoneId]
                                  : [],
                            );
                          }}
                        >
                          Zonas
                        </button>
                      )}
                      {canToggle ? (
                        <button
                          type="button"
                          className="btn-small"
                          disabled={Boolean(togglingId)}
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
          <h2>Zonas de {editing.name}</h2>
          <div className="form-grid form-grid-inline">
            <label>
              Zonas asignadas
              <AsyncMultiSelect
                values={editZoneIds}
                onChange={setEditZoneIds}
                loadPage={usersApiClient.zoneOptions}
                emptyLabel="Ninguna (sin zonas asignadas)"
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
