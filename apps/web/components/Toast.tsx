"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

// Global toast state (simple approach without context for now)
let toastListeners: Set<(toasts: Toast[]) => void> = new Set();
let toasts: Toast[] = [];

function notifyListeners() {
  toastListeners.forEach(listener => listener([...toasts]));
}

export function showToast(message: string, type: ToastType = "info", duration: number = 3000) {
  const id = `toast-${Date.now()}-${Math.random()}`;
  const toast: Toast = { id, message, type, duration };
  
  toasts = [...toasts, toast];
  notifyListeners();

  // Auto-remove after duration
  setTimeout(() => {
    removeToast(id);
  }, duration);
}

export function removeToast(id: string) {
  toasts = toasts.filter(t => t.id !== id);
  notifyListeners();
}

export function ToastContainer() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setCurrentToasts(newToasts);
    };
    
    toastListeners.add(listener);
    setCurrentToasts([...toasts]);
    
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {currentToasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto min-w-[300px] max-w-md p-4 rounded-lg shadow-lg border backdrop-blur-sm animate-in slide-in-from-right ${
            toast.type === "success"
              ? "bg-green-500/90 border-green-400 text-white"
              : toast.type === "error"
              ? "bg-red-500/90 border-red-400 text-white"
              : toast.type === "warning"
              ? "bg-yellow-500/90 border-yellow-400 text-white"
              : "bg-blue-500/90 border-blue-400 text-white"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/80 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

