import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { RegisterStepper } from "../components/RegisterStepper";
import type { RegisterRole } from "../types";

const STEPS = ["Tipo de cuenta", "Tus datos", "Acceso"] as const;

const ROLE_OPTIONS: { id: RegisterRole; label: string; desc: string }[] = [
  {
    id: "conductor",
    label: "Conductor",
    desc: "Opcional. Reservá lugares con hasta 30 min de anticipación.",
  },
  {
    id: "permisionario",
    label: "Permisionario",
    desc: "Podés registrarte; la cuenta queda inactiva hasta el alta municipal.",
  },
  {
    id: "admin",
    label: "Administrador",
    desc: "Podés registrarte; la cuenta queda inactiva hasta el alta municipal.",
  },
];

const emptyCitizen = {
  dni: "",
  birthDate: "",
  sex: "" as "" | "F" | "M" | "X",
  firstName: "",
  lastName: "",
  phone: "",
  address: "",
  city: "Salta",
  province: "Salta",
  nationality: "Argentina",
  plate: "",
};

export function RegisterPage() {
  const { register, setSessionFromResponse } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<Awaited<
    ReturnType<typeof api.authConfig>
  > | null>(null);
  const [role, setRole] = useState<RegisterRole>("conductor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [name, setName] = useState("");
  const [legajo, setLegajo] = useState("");
  const [zone, setZone] = useState("microcentro");
  const [citizen, setCitizen] = useState(emptyCitizen);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.authConfig().then(setConfig).catch(() => null);
  }, []);

  const step2Title = useMemo(() => {
    if (role === "conductor") return "Datos ciudadanos";
    return "Datos de la cuenta";
  }, [role]);

  const stepLabels: [string, string, string] = useMemo(
    () => [STEPS[0], step2Title, STEPS[2]],
    [step2Title],
  );

  function validateStep1(): string | null {
    return null;
  }

  function validateStep2(): string | null {
    if (role === "conductor") {
      if (!/^\d{7,8}$/.test(citizen.dni.trim())) {
        return "Ingresá un DNI válido (7 u 8 dígitos).";
      }
      if (!citizen.birthDate) return "La fecha de nacimiento es obligatoria.";
      if (!citizen.sex) return "Seleccioná el sexo.";
      if (!citizen.firstName.trim() || !citizen.lastName.trim()) {
        return "Nombre y apellido son obligatorios.";
      }
      if (!citizen.phone.trim()) return "El teléfono es obligatorio.";
      if (!citizen.address.trim()) return "El domicilio es obligatorio.";
      if (!citizen.city.trim()) return "La localidad es obligatoria.";
      return null;
    }
    if (!name.trim()) return "El nombre completo es obligatorio.";
    if (role === "permisionario" && !legajo.trim()) {
      return "El legajo es obligatorio para permisionarios.";
    }
    return null;
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
    const err =
      step === 1
        ? validateStep1()
        : step === 2
          ? validateStep2()
          : null;
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

  function handleRoleChange(next: RegisterRole) {
    setRole(next);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const err = validateStep3();
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    try {
      const res = await register({
        role,
        email,
        password,
        name: role === "conductor" ? undefined : name,
        legajo: role === "permisionario" ? legajo : undefined,
        zone: role === "permisionario" ? zone : undefined,
        citizen:
          role === "conductor"
            ? { ...citizen, sex: citizen.sex as "F" | "M" | "X" }
            : undefined,
      });

      if (res.token) {
        setSessionFromResponse(res.token, res.user!);
        navigate("/", { replace: true });
        return;
      }

      setSuccess(
        res.message ??
          "Registro recibido. Tu cuenta quedó pendiente de habilitación.",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthLayout
        title="Crear cuenta"
        alternate={{
          label: "¿Ya tenés cuenta?",
          to: "/login",
          linkText: "Iniciar sesión",
        }}
      >
        <div className="success-banner">
          <p>{success}</p>
          <Link to="/login" className="btn-primary btn-block">
            Ir a iniciar sesión
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle={`Paso ${step} de 3`}
      alternate={{
        label: "¿Ya tenés cuenta?",
        to: "/login",
        linkText: "Iniciar sesión",
      }}
    >
      <RegisterStepper step={step} labels={stepLabels} />

      <form
        onSubmit={step === 3 ? handleSubmit : (e) => e.preventDefault()}
        className="form-standard register-wizard"
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
                      name="role"
                      value={opt.id}
                      checked={role === opt.id}
                      onChange={() => handleRoleChange(opt.id)}
                    />
                    <span className="role-label">{opt.label}</span>
                    <span className="role-desc">{opt.desc}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {role !== "conductor" && (
              <p className="info-banner warn" role="status">
                {config?.message ??
                  "Tu cuenta quedará inactiva. Al iniciar sesión verás el estado hasta que la Municipalidad te habilite."}
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="wizard-panel">
            <h2 className="wizard-panel-title">{step2Title}</h2>

            {role === "conductor" ? (
              <>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="dni">DNI *</label>
                    <input
                      id="dni"
                      required
                      inputMode="numeric"
                      pattern="\d{7,8}"
                      maxLength={8}
                      value={citizen.dni}
                      onChange={(e) =>
                        setCitizen({ ...citizen, dni: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="birthDate">Fecha de nacimiento *</label>
                    <input
                      id="birthDate"
                      type="date"
                      required
                      value={citizen.birthDate}
                      onChange={(e) =>
                        setCitizen({ ...citizen, birthDate: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="sex">Sexo *</label>
                    <select
                      id="sex"
                      required
                      value={citizen.sex}
                      onChange={(e) =>
                        setCitizen({
                          ...citizen,
                          sex: e.target.value as "F" | "M" | "X",
                        })
                      }
                    >
                      <option value="" disabled>
                        Seleccionar
                      </option>
                      <option value="F">Femenino</option>
                      <option value="M">Masculino</option>
                      <option value="X">Otro / No binario</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="nationality">Nacionalidad</label>
                    <input
                      id="nationality"
                      value={citizen.nationality}
                      onChange={(e) =>
                        setCitizen({ ...citizen, nationality: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="firstName">Nombre *</label>
                    <input
                      id="firstName"
                      required
                      value={citizen.firstName}
                      onChange={(e) =>
                        setCitizen({ ...citizen, firstName: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="lastName">Apellido *</label>
                    <input
                      id="lastName"
                      required
                      value={citizen.lastName}
                      onChange={(e) =>
                        setCitizen({ ...citizen, lastName: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="phone">Teléfono *</label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={citizen.phone}
                    onChange={(e) =>
                      setCitizen({ ...citizen, phone: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="address">Domicilio *</label>
                  <input
                    id="address"
                    required
                    value={citizen.address}
                    onChange={(e) =>
                      setCitizen({ ...citizen, address: e.target.value })
                    }
                  />
                </div>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="city">Localidad *</label>
                    <input
                      id="city"
                      required
                      value={citizen.city}
                      onChange={(e) =>
                        setCitizen({ ...citizen, city: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="province">Provincia</label>
                    <input
                      id="province"
                      value={citizen.province}
                      onChange={(e) =>
                        setCitizen({ ...citizen, province: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="plate">Patente habitual (opcional)</label>
                  <input
                    id="plate"
                    value={citizen.plate}
                    onChange={(e) =>
                      setCitizen({
                        ...citizen,
                        plate: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="name">Nombre completo *</label>
                  <input
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                {role === "permisionario" && (
                  <>
                    <div className="field">
                      <label htmlFor="legajo">Legajo *</label>
                      <input
                        id="legajo"
                        required
                        value={legajo}
                        onChange={(e) => setLegajo(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="zone">Zona / cuadra</label>
                      <input
                        id="zone"
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="wizard-panel">
            <h2 className="wizard-panel-title">Datos de acceso</h2>
            <p className="wizard-panel-desc">
              Creá tu correo y contraseña para ingresar al sistema.
            </p>
            <div className="field">
              <label htmlFor="reg-email">Correo electrónico *</label>
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="reg-pass">Contraseña *</label>
                <input
                  id="reg-pass"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="reg-pass2">Repetir contraseña *</label>
                <input
                  id="reg-pass2"
                  type="password"
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

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="wizard-actions">
          {step > 1 && (
            <button
              type="button"
              className="btn-ghost"
              onClick={goBack}
              disabled={loading}
            >
              Atrás
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={goNext}
            >
              Siguiente
            </button>
          ) : (
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? "Creando cuenta…" : "Crear cuenta"}
            </button>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
