import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  message: string;
  title?: string;
  variant: ToastVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  duration?: number;
}

interface ToastContextValue {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ToastVariant;
  }) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const confirmResolvers = useRef<Map<number, (v: boolean) => void>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (item: Omit<ToastItem, "id">) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { ...item, id }]);
      if (!item.onConfirm && item.duration !== 0) {
        const ms = item.duration ?? (item.variant === "error" ? 6000 : 4000);
        window.setTimeout(() => dismiss(id), ms);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message, title) =>
        push({ message, title, variant: "success" }),
      error: (message, title) => push({ message, title, variant: "error" }),
      info: (message, title) => push({ message, title, variant: "info" }),
      warning: (message, title) =>
        push({ message, title, variant: "warning" }),
      confirm: (opts) =>
        new Promise<boolean>((resolve) => {
          const id = push({
            title: opts.title,
            message: opts.message,
            variant: opts.variant ?? "warning",
            confirmLabel: opts.confirmLabel ?? "Confirmar",
            cancelLabel: opts.cancelLabel ?? "Cancelar",
            duration: 0,
            onConfirm: () => {
              confirmResolvers.current.delete(id);
              dismiss(id);
              resolve(true);
            },
            onCancel: () => {
              confirmResolvers.current.delete(id);
              dismiss(id);
              resolve(false);
            },
          });
          confirmResolvers.current.set(id, resolve);
        }),
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.variant}`} role="alert">
            {t.title && <strong className="toast-title">{t.title}</strong>}
            <p className="toast-message">{t.message}</p>
            {t.onConfirm ? (
              <div className="toast-actions">
                <button
                  type="button"
                  className="btn-small btn-ghost"
                  onClick={t.onCancel}
                >
                  {t.cancelLabel ?? "Cancelar"}
                </button>
                <button
                  type="button"
                  className={`btn-small toast-confirm toast-confirm--${t.variant}`}
                  onClick={t.onConfirm}
                >
                  {t.confirmLabel ?? "Confirmar"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="toast-close"
                aria-label="Cerrar"
                onClick={() => dismiss(t.id)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
