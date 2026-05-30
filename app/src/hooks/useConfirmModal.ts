import { useCallback } from "react";
import { useToast } from "../components/Toast";

export function useConfirmModal() {
  const toast = useToast();

  const confirm = useCallback(
    (opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
    }) =>
      toast.confirm({
        ...opts,
        variant: "warning",
        confirmLabel: opts.confirmLabel ?? "Eliminar",
      }),
    [toast],
  );

  const warn = useCallback(
    (title: string, message: string) => {
      toast.warning(message, title);
    },
    [toast],
  );

  const confirmDanger = useCallback(
    (opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      showCancel?: boolean;
    }) => {
      if (opts.showCancel === false) {
        toast.warning(opts.message, opts.title);
        return Promise.resolve(true);
      }
      return toast.confirm({
        title: opts.title,
        message: opts.message,
        variant: "warning",
        confirmLabel: opts.confirmLabel ?? "Eliminar",
        cancelLabel: opts.cancelLabel ?? "Cancelar",
      });
    },
    [toast],
  );

  return { modal: null, confirm, warn, confirmDanger, close: () => {} };
}
