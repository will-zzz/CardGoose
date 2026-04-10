import { createContext } from 'react';

export type ToastContextValue = {
  showError: (message: string) => void;
  showInfo: (message: string) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);
