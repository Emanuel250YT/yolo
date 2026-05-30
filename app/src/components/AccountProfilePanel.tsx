import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useSubmitLock } from "../hooks/useSubmitLock";
import { useToast } from "./Toast";
import { PasswordInput } from "./PasswordInput";
import { RefCell } from "./DataTable";
import type { UserRole } from "../types";

const ROLE_LABELS: Record<UserRole, string> = {
  municipio: "Municipalidad",
  admin: "Administrador",
  permisionario: "Permisionario",
  conductor: "Conductor",
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  if (!value && !children) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children ?? value}</dd>
    </div>
  );
}

export function AccountProfilePanel() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const { busy: savingPwd, run: runPwd } = useSubmitLock();
  const { busy: linkingMp, run: runLinkMp } = useSubmitLock();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  if (!user) return null;

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== newPassword2) {
      toast.error("Las contraseñas nuevas no coinciden.");
      return;
    }

    await runPwd(async () => {
      try {
        const res = await api.changePassword(currentPassword, newPassword);
        toast.success(res.message ?? "Contraseña actualizada.");
        setCurrentPassword("");
        setNewPassword("");
        setNewPassword2("");
        await refreshUser();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  async function linkMercadoPago() {
    await runLinkMp(async () => {
      try {
        const res = await api.mercadoPagoAuthorize();
        if (res.linked) {
          await refreshUser();
          toast.info("Ya tenés Mercado Pago vinculado.");
          return;
        }
        if (!res.url) {
          toast.error("No se pudo obtener el enlace de Mercado Pago.");
          return;
        }
        window.location.href = res.url;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  const zonesLabel =
    user.zoneName ||
    user.assignedZones?.map((z) => z.name).join(", ") ||
    user.zone ||
    null;

  return (
    <section className="panel account-profile">
      <h2>Mi cuenta</h2>
      <p className="panel-desc">
        Datos de tu perfil en el sistema. Podés actualizar tu contraseña cuando
        quieras.
      </p>

      <div className="account-profile-grid">
        <div className="account-profile-block">
          <h3>Identificación</h3>
          <dl className="account-details">
            <DetailRow label="ID">
              {user.ref ? (
                <RefCell refId={user.ref} entityKind="user" />
              ) : (
                user.id
              )}
            </DetailRow>
            <DetailRow label="Nombre" value={user.name} />
            <DetailRow label="Email" value={user.email} />
            <DetailRow label="Rol" value={ROLE_LABELS[user.role]} />
            <DetailRow label="Estado">
              <span
                className={`chip${user.active ? "" : " chip-warn"}`}
              >
                {user.active
                  ? user.activationPending
                    ? "Activo (alta pendiente)"
                    : "Activo"
                  : user.activationPending
                    ? "Inactivo · pendiente de habilitación"
                    : "Inactivo"}
              </span>
            </DetailRow>
            <DetailRow label="Alta" value={formatDate(user.createdAt)} />
            <DetailRow label="Última actualización" value={formatDate(user.updatedAt)} />
          </dl>
        </div>

        <div className="account-profile-block">
          <h3>Asignación</h3>
          <dl className="account-details">
            {user.legajo && <DetailRow label="Legajo" value={user.legajo} />}
            {zonesLabel && <DetailRow label="Zona(s)" value={zonesLabel} />}
            {user.createdByMunicipio && (
              <DetailRow label="Origen" value="Cuenta creada por Municipalidad" />
            )}
          </dl>
        </div>

        {user.citizen && (
          <div className="account-profile-block account-profile-block--wide">
            <h3>Datos personales</h3>
            <dl className="account-details account-details--grid">
              <DetailRow
                label="Apellido y nombre"
                value={`${user.citizen.lastName}, ${user.citizen.firstName}`}
              />
              <DetailRow label="DNI" value={user.citizen.dni} />
              <DetailRow label="Fecha de nacimiento" value={user.citizen.birthDate} />
              <DetailRow label="Sexo" value={user.citizen.sex} />
              <DetailRow label="Teléfono" value={user.citizen.phone} />
              <DetailRow label="Domicilio" value={user.citizen.address} />
              <DetailRow label="Localidad" value={user.citizen.city} />
              <DetailRow label="Provincia" value={user.citizen.province} />
              <DetailRow label="Nacionalidad" value={user.citizen.nationality} />
              {user.citizen.plate && (
                <DetailRow label="Patente habitual" value={user.citizen.plate} />
              )}
            </dl>
          </div>
        )}
      </div>

      {user.role === "permisionario" && (
        <div className="account-mp">
          <h3>Mercado Pago</h3>
          {user.mercadoPagoLinked ? (
            <p className="account-mp-status account-mp-status--linked">
              Cuenta vinculada
              {user.mercadoPagoLinkedAt && (
                <span className="account-mp-meta">
                  {" "}
                  · desde {formatDate(user.mercadoPagoLinkedAt)}
                </span>
              )}
            </p>
          ) : (
            <>
              <p className="account-mp-status">
                Todavía no vinculaste tu cuenta de Mercado Pago. Es necesario
                para cobrar permisos con pago digital.
              </p>
              <button
                type="button"
                className="btn-primary"
                disabled={linkingMp}
                onClick={() => void linkMercadoPago()}
              >
                {linkingMp ? "Redirigiendo…" : "Vincular Mercado Pago"}
              </button>
            </>
          )}
        </div>
      )}

      <form className="account-password-form" onSubmit={(e) => void submitPassword(e)}>
        <h3>Cambiar contraseña</h3>
        <div className="form-grid">
          <label>
            Contraseña actual
            <PasswordInput
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label>
            Nueva contraseña
            <PasswordInput
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
          <label>
            Repetir nueva contraseña
            <PasswordInput
              autoComplete="new-password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              minLength={6}
              required
            />
          </label>
        </div>
        <div className="action-buttons">
          <button type="submit" className="btn-primary" disabled={savingPwd}>
            {savingPwd ? "Guardando…" : "Actualizar contraseña"}
          </button>
        </div>
      </form>
    </section>
  );
}
