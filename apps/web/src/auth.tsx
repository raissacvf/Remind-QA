import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./lib/api";

interface User {
  id: string;
  email: string;
}
interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value: AuthValue = {
    user,
    loading,
    login: async (email, password) => setUser(await api<User>("/auth/login", { method: "POST", body: { email, password } })),
    register: async (email, password) => setUser(await api<User>("/auth/register", { method: "POST", body: { email, password } })),
    logout: async () => {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}
