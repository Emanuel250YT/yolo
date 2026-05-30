export interface PersonalInfoForm {
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: "F" | "M" | "X";
  phone: string;
  address: string;
  city: string;
  province: string;
  nationality: string;
}

export const EMPTY_PERSONAL_INFO: PersonalInfoForm = {
  dni: "",
  firstName: "",
  lastName: "",
  birthDate: "",
  sex: "X",
  phone: "",
  address: "",
  city: "Salta",
  province: "Salta",
  nationality: "Argentina",
};

interface PersonalInfoFieldsProps {
  value: PersonalInfoForm;
  onChange: (value: PersonalInfoForm) => void;
}

export function PersonalInfoFields({ value, onChange }: PersonalInfoFieldsProps) {
  const set = (patch: Partial<PersonalInfoForm>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="form-grid">
      <div className="field">
        <label>DNI *</label>
        <input
          required
          value={value.dni}
          onChange={(e) => set({ dni: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Nombre *</label>
        <input
          required
          value={value.firstName}
          onChange={(e) => set({ firstName: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Apellido *</label>
        <input
          required
          value={value.lastName}
          onChange={(e) => set({ lastName: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Fecha de nacimiento *</label>
        <input
          required
          type="date"
          value={value.birthDate}
          onChange={(e) => set({ birthDate: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Sexo *</label>
        <select
          required
          value={value.sex}
          onChange={(e) => set({ sex: e.target.value as PersonalInfoForm["sex"] })}
        >
          <option value="F">Femenino</option>
          <option value="M">Masculino</option>
          <option value="X">Otro / Prefiero no decir</option>
        </select>
      </div>
      <div className="field">
        <label>Teléfono *</label>
        <input
          required
          value={value.phone}
          onChange={(e) => set({ phone: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Domicilio *</label>
        <input
          required
          value={value.address}
          onChange={(e) => set({ address: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Ciudad *</label>
        <input
          required
          value={value.city}
          onChange={(e) => set({ city: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Provincia *</label>
        <input
          required
          value={value.province}
          onChange={(e) => set({ province: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Nacionalidad *</label>
        <input
          required
          value={value.nationality}
          onChange={(e) => set({ nationality: e.target.value })}
        />
      </div>
    </div>
  );
}

export function validatePersonalInfo(p: PersonalInfoForm): string | null {
  if (!p.dni.trim()) return "El DNI es obligatorio.";
  if (!p.firstName.trim() || !p.lastName.trim()) {
    return "Nombre y apellido son obligatorios.";
  }
  if (!p.birthDate) return "La fecha de nacimiento es obligatoria.";
  if (!p.phone.trim()) return "El teléfono es obligatorio.";
  if (!p.address.trim()) return "El domicilio es obligatorio.";
  if (!p.city.trim()) return "La ciudad es obligatoria.";
  return null;
}
