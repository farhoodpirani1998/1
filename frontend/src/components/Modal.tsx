import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  footer?: ReactNode;
  /** Hide the built-in × button — useful when the footer already offers a cancel action. */
  hideCloseButton?: boolean;
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

// Generic modal shell matching the overlay/panel look already used by
// RecordPaymentModal and VoidPaymentDialog (fixed inset-0, bg-ink/40
// backdrop, white rounded-xl panel). Those two keep their own markup
// untouched — this is offered as a shared building block for new or
// updated dialogs so every modal in the app converges on one visual
// pattern (backdrop blur, Esc-to-close, focus-safe overlay click).
export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  hideCloseButton = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        onClick={(e) => e.stopPropagation()}
        className={`fade-in w-full ${SIZE_CLASS[size]} rounded-xl bg-white p-6 shadow-pop dark:bg-navy-dark dark:border dark:border-white/10`}
      >
        {(title || !hideCloseButton) && (
          <div className="mb-1 flex items-start justify-between gap-3">
            {title && (
              <h3 id="modal-title" className="text-base font-bold text-ink dark:text-paper">
                {title}
              </h3>
            )}
            {!hideCloseButton && (
              <button
                onClick={onClose}
                aria-label="بستن"
                className="-mt-1 -ml-1 shrink-0 rounded-lg p-1 text-ink/40 transition-colors hover:bg-paper hover:text-ink dark:text-paper/40 dark:hover:bg-white/10 dark:hover:text-paper"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            )}
          </div>
        )}
        {description && <p className="mb-4 text-sm text-ink/60 dark:text-paper/60">{description}</p>}
        <div className={title || description ? 'mt-4' : ''}>{children}</div>
        {footer && <div className="mt-5 flex gap-2">{footer}</div>}
      </div>
    </div>
  );
}
