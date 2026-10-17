import { useEffect, useId, useRef } from "react";
import Icon from "./Icon.jsx";

// Built on the native <dialog>: it traps keyboard focus, restores focus on
// close, and closes on Escape. Content renders only while open, so forms start fresh.
export default function Modal({ open, title, onClose, busy = false, size = "md", children }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`modal${size === "sm" ? " modal-sm" : size === "lg" ? " modal-lg" : ""}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        // A click on the dim backdrop lands on the dialog element itself.
        if (event.target === dialogRef.current && !busy) onClose();
      }}
    >
      {open && (
        <div className="modal-body">
          <div className="modal-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Close dialog">
              <Icon name="close" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
