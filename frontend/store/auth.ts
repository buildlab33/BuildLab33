import { create } from "zustand";

export interface User {
  id: string;
  email: string;
  username: string | null;
  name: string;
  role: string;
  theme: string;
  totp_enabled: boolean;
}

interface AuthState {
  user: User | null;
  setUser: (user: User) => void;
  clearAuth: () => void;
  // kept for backward-compat with any remaining callers — no-ops now
  setAuth: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,

  setUser: (user) => set({ user }),

  setAuth: (user) => set({ user }),

  clearAuth: () => set({ user: null }),
}));
