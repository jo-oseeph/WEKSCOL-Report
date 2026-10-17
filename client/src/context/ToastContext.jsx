import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const idRef = useRef(0);

  const showToast = useCallback((message, duration = 4000) => {
    window.clearTimeout(timerRef.current);
    idRef.current += 1;
    setToast({ id: idRef.current, message, duration });
    timerRef.current = window.setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="app-toast-region" role="status" aria-live="polite">
        {toast ? (
          <div className="app-toast" key={toast.id}>
            <p className="app-toast__message">{toast.message}</p>
            <span
              className="app-toast__progress"
              style={{ animationDuration: `${toast.duration}ms` }}
            />
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider.");
  return context;
}