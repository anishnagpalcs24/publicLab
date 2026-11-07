import React, { createContext, useContext, useState, useCallback } from "react";
import ToastContainer from "../Component/Toast/Toast.jsx";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({ message, type = "info", title, duration = 4500 }) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type, title, duration }]);
    return id;
  }, []);

  const success = useCallback((message, title) => {
    return showToast({ message, title, type: "success" });
  }, [showToast]);

  const error = useCallback((message, title) => {
    return showToast({ message, title, type: "error" });
  }, [showToast]);

  const warning = useCallback((message, title) => {
    return showToast({ message, title, type: "warning" });
  }, [showToast]);

  const info = useCallback((message, title) => {
    return showToast({ message, title, type: "info" });
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

const defaultToast = {
  showToast: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
  removeToast: () => {},
};

export function useToast() {
  const context = useContext(ToastContext);
  return context || defaultToast;
}

export default ToastContext;
