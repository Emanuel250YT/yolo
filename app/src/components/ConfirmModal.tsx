import { useEffect } from "react";

export type ConfirmModalVariant = "confirm" | "warning" | "error";

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  variant?: ConfirmModalVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  variant = "confirm",
  confirmLabel,
  cancelLabel = "Cancelar",
  showCancel = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const resolvedConfirm =
    confirmLabel ??
    (variant === "confirm" ? "Confirmar" : "Entendido");

  return (
    <div className="app-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className={`app-modal app-modal--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="app-modal-header">
          <h3 id="app-modal-title">{title}</h3>
        </header>
        <div className="app-modal-body">
          {message.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <footer className="app-modal-footer">
          {showCancel && (
            <button type="button" className="btn-ghost" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className={
              variant === "confirm"
                ? "btn-primary btn-danger-soft"
                : variant === "warning"
                  ? "btn-primary btn-danger-soft"
                  : "btn-primary"
            }
            onClick={onConfirm}
          >
            {resolvedConfirm}
          </button>
        </footer>
      </div>
    </div>
  );
}
