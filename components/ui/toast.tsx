"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 3200);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      {message && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[3000] -translate-x-1/2 rounded-[10px] bg-forest-deep px-5 py-3 text-sm font-medium text-white shadow-xl"
        >
          {message}
        </div>
      )}
    </ToastContext>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
