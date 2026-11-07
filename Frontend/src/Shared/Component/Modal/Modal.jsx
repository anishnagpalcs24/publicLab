import React, { useEffect } from "react";
import { X } from "lucide-react";
import "./Modal.scss";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="pl-modal-backdrop"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`pl-modal pl-modal--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pl-modal__header">
          <h3>{title}</h3>
          <button
            type="button"
            className="pl-modal__close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="pl-modal__body">{children}</div>

        {footer && <div className="pl-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
