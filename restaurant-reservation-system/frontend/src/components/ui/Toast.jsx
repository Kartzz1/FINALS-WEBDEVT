import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";

const ToastContext = createContext(null);
const DISMISS_MS = 5000;
const MAX_VISIBLE = 3;
const ICONS = { success: "check", error: "alert", info: "info" };

// Short-lived confirmations ("Reservation cancelled"). Errors that need a
// decision stay inline next to the form instead.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (kind, message) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), DISMISS_MS);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (message) => show("success", message),
      error: (message) => show("error", message),
      info: (message) => show("info", message),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.kind}`}>
            <Icon name={ICONS[toast.kind]} size={18} />
            <p>{toast.message}</p>
            <button type="button" className="icon-button" onClick={() => dismiss(toast.id)} aria-label="Dismiss message">
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
