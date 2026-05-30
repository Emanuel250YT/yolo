import { useCallback, useState } from "react";
import type { ConfirmModalVariant } from "../components/ConfirmModal";

interface ModalConfig {
  title: string;
  message: string;
  variant: ConfirmModalVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function useConfirmModal() {
  const [modal, setModal] = useState<ModalConfig | null>(null);

  const close = useCallback(() => setModal(null), []);

  const confirm = useCallback(
    (opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
    }) =>
      new Promise<boolean>((resolve) => {
        setModal({
          title: opts.title,
          message: opts.message,
          variant: "confirm",
          confirmLabel: opts.confirmLabel ?? "Eliminar",
          cancelLabel: opts.cancelLabel ?? "Cancelar",
          showCancel: true,
          onConfirm: () => {
            close();
            resolve(true);
          },
          onCancel: () => {
            close();
            resolve(false);
          },
        });
      }),
    [close],
  );

  const warn = useCallback(
    (title: string, message: string) => {
      setModal({
        title,
        message,
        variant: "warning",
        confirmLabel: "Entendido",
        showCancel: false,
        onConfirm: close,
        onCancel: close,
      });
    },
    [close],
  );

  const confirmDanger = useCallback(
    (opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      showCancel?: boolean;
    }) =>
      new Promise<boolean>((resolve) => {
        setModal({
          title: opts.title,
          message: opts.message,
          variant: "warning",
          confirmLabel: opts.confirmLabel ?? "Eliminar",
          cancelLabel: opts.cancelLabel ?? "Cancelar",
          showCancel: opts.showCancel ?? true,
          onConfirm: () => {
            close();
            resolve(true);
          },
          onCancel: () => {
            close();
            resolve(false);
          },
        });
      }),
    [close],
  );

  return { modal, confirm, warn, confirmDanger, close };
}
