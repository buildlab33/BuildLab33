"use client";
import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "#0d1117",
          border: "1px solid #1e293b",
          color: "#f8fafc",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
        },
        classNames: {
          success: "!border-success/30",
          error: "!border-error/30",
          warning: "!border-warning/30",
          info: "!border-info/30",
        },
      }}
    />
  );
}

export { toast } from "sonner";
