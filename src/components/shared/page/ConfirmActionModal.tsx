import type { ReactNode } from 'react';
import AppIcon from '../icons/AppIcon';

interface ConfirmActionModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  isLoading = false,
}: ConfirmActionModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className='fixed inset-0 z-[60] flex items-end justify-center bg-background-overlay/72 p-4 backdrop-blur-[2px] sm:items-center'
      onClick={onClose}
      role='presentation'
    >
      <div
        className='w-full max-w-[460px] rounded-[20px] border border-border-soft/60 bg-surface-card p-5 shadow-[0_32px_74px_-36px_rgba(15,23,42,0.58)]'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-3 flex items-start justify-between gap-3'>
          <h3 className='m-0 text-base font-semibold text-text-primary'>{title}</h3>
          <button
            type='button'
            className='inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-subtle text-text-primary transition duration-fast hover:bg-surface-muted'
            onClick={onClose}
            disabled={isLoading}
            aria-label='Close'
          >
            <AppIcon name='close' className='h-4 w-4' aria-hidden='true' />
          </button>
        </div>

        {description ? (
          <p className='m-0 text-sm leading-6 text-text-secondary'>{description}</p>
        ) : null}

        <div className='mt-4 flex items-center justify-end gap-2'>
          <button
            type='button'
            className='inline-flex min-h-10 items-center justify-center rounded-lg bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition duration-fast hover:bg-surface-muted'
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type='button'
            className='inline-flex min-h-10 items-center justify-center rounded-lg bg-danger px-4 text-sm font-semibold text-danger-foreground transition duration-fast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmActionModal;
