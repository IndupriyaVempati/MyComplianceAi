import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
export type ToastType = "success" | "error";

export interface ToastMessage {
  message: string;
  type: ToastType;
}

interface ToastContextType {
  show: (message: string, type?: ToastType) => void;
  hide: () => void;
  toast: ToastMessage | null;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const duration = 3000;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(t);
  }, [toast, duration]);

  const show = useCallback(
    (message: string, type: ToastType = "success") => setToast({ message, type }),
    []
  );

  const hide = useCallback(() => setToast(null), []);

  return (
    <ToastContext.Provider value={{ show, hide, toast }}>
      {children}
      <Toast toast={toast} onClose={hide} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// ── Component ─────────────────────────────────────────────────────────────────
/**
 * <Toast toast={toast} onClose={hide} />
 *
 * Renders a fixed top-right notification. Pass `null` to hide it.
 */
export function Toast({
  toast,
  onClose,
}: {
  toast: ToastMessage | null;
  onClose: () => void;
}) {
  if (!toast) return null;

  const isSuccess = toast.type === "success";

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
          borderRadius: "8px",
          background: isSuccess ? "#ECFDF5" : "#FEF2F2",
          borderLeft: isSuccess ? "4px solid #059669" : "4px solid #DC2626",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          color: isSuccess ? "#065F46" : "#991B1B",
          fontSize: "14px",
          fontWeight: 600,
          animation: "toastSlideIn 0.3s ease",
          minWidth: "260px",
          maxWidth: "420px",
        }}
      >
        <span style={{ flex: 1 }}>{toast.message}</span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: isSuccess ? "rgba(6, 95, 70, 0.5)" : "rgba(153, 27, 27, 0.5)",
            fontSize: "18px",
            lineHeight: 1,
            padding: "0 2px",
            transition: "color 0.2s ease"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = isSuccess ? "#065F46" : "#991B1B")}
          onMouseLeave={(e) => (e.currentTarget.style.color = isSuccess ? "rgba(6, 95, 70, 0.5)" : "rgba(153, 27, 27, 0.5)")}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <style>{`@keyframes toastSlideIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }`}</style>
    </>
  );
}
