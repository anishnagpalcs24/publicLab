import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import "./Toast.scss";

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastItem({ id, type = "info", title, message, onClose, duration = 4500 }) {
  const Icon = ICONS[type] || Info;

  useEffect(() => {
    if (!duration || duration <= 0) return;
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  return (
    <div className={`pl-toast pl-toast--${type}`} role="alert" aria-live="assertive">
      <div className="pl-toast__icon">
        <Icon size={18} />
      </div>
      <div className="pl-toast__content">
        {title && <div className="pl-toast__title">{title}</div>}
        <div className="pl-toast__message">{message}</div>
      </div>
      <button
        type="button"
        className="pl-toast__close"
        onClick={() => onClose(id)}
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onClose }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="pl-toast-container" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
}

export default ToastContainer;
