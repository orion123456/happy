import type { ToastState } from '../hooks/useToast';

interface NotificationProps {
  toasts: ToastState[];
  onClose: (id: number) => void;
}

export function Notification({ toasts, onClose }: NotificationProps) {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => onClose(toast.id)} aria-label="Закрыть уведомление">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
