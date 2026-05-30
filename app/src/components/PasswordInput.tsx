import { useState, type InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className={`password-field${className ? ` ${className}` : ""}`}>
      <input {...props} type={show ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        tabIndex={-1}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        onClick={() => setShow((v) => !v)}
      >
        {show ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 3l18 18M10.58 10.58A2 2 0 0012 15a2 2 0 002.42-2.42M9.88 4.24A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7.5a11.62 11.62 0 01-4.12 5.17M6.11 6.11A11.83 11.83 0 001 12.5C2.73 16.39 7 19.5 12 19.5a11.6 11.6 0 004.24-.78"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M1 12.5C2.73 8.11 7 5 12 5s9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S2.73 16.89 1 12.5z"
              stroke="currentColor"
              strokeWidth="1.75"
            />
            <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.75" />
          </svg>
        )}
      </button>
    </div>
  );
}
