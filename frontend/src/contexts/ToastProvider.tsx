import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ToastContext, type ToastContextValue } from './toast-context';

type ToastItem = { id: number; message: string; variant: 'error' | 'info' };

const TOAST_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((toastId: number) => {
    const t = timersRef.current.get(toastId);
    if (t !== undefined) {
      window.clearTimeout(t);
      timersRef.current.delete(toastId);
    }
    setToasts((prev) => prev.filter((x) => x.id !== toastId));
  }, []);

  const push = useCallback(
    (message: string, variant: 'error' | 'info') => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
      const tid = window.setTimeout(() => remove(id), TOAST_MS);
      timersRef.current.set(id, tid);
    },
    [remove]
  );

  const showError = useCallback((message: string) => push(message, 'error'), [push]);
  const showInfo = useCallback((message: string) => push(message, 'info'), [push]);

  // Stable reference so toast list updates don’t re-render every useToast() consumer.
  const value = useMemo<ToastContextValue>(() => ({ showError, showInfo }), [showError, showInfo]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-viewport" aria-label="Notifications">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`toast toast--${t.variant}`}
              role="status"
              aria-live={t.variant === 'error' ? 'assertive' : 'polite'}
            >
              <span className="toast-message">{t.message}</span>
              <button
                type="button"
                className="toast-dismiss"
                onClick={() => remove(t.id)}
                aria-label="Dismiss notification"
              >
                <X size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}
