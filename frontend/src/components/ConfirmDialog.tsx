import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' for destructive actions (delete, void, archive); 'primary' for
   *  ordinary confirmations. */
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Generic confirm/cancel prompt built on the shared Modal + Button. Intended
// for new or updated confirmation flows (e.g. "آیا از حذف این مورد مطمئن
// هستید؟") — existing bespoke dialogs like VoidPaymentDialog (which needs a
// reason textarea, not just yes/no) are left as they are.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'تایید',
  cancelLabel = 'انصراف',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            className="flex-1"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
        </>
      }
    >
      {null}
    </Modal>
  );
}
