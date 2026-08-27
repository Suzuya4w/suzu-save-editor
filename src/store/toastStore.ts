import { createStore } from 'solid-js/store';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: ToastMessage[];
}

const [toastState, setToastState] = createStore<ToastState>({
  toasts: []
});

let idCounter = 0;

export const useToastStore = () => toastState;

export const addToast = (message: string, type: ToastType) => {
  const id = idCounter++;
  setToastState('toasts', (t) => [...t, { id, message, type }]);
  setTimeout(() => {
    removeToast(id);
  }, 3000);
};

export const removeToast = (id: number) => {
  setToastState('toasts', (t) => t.filter((toast) => toast.id !== id));
};
