import { ActionModal } from '@/js/components/ui/ActionModal';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive style for delete/unload actions */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** App-styled confirmation popup (replaces window.confirm). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <ActionModal
      elevated
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button className="panoptes-btn-secondary w-full" disabled={busy} onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button
            className={`w-full ${danger ? 'panoptes-btn-primary bg-error hover:bg-error/90' : 'panoptes-btn-primary'}`}
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      }
      onClose={onCancel}
      open={open}
      title={title}
    >
      <p className="text-sm text-on-surface-variant">{message}</p>
    </ActionModal>
  );
}
