import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser, UserRole } from "./types";

const STORAGE_KEY = "feeana.auth.user";

interface MockCredential {
  email: string;
  password: string;
  user: AuthUser;
}

const CREDENTIALS: MockCredential[] = [
  {
    email: "admin@feeana.edu",
    password: "admin123",
    user: {
      id: "user-instructor",
      email: "admin@feeana.edu",
      name: "Prof. Reyes",
      role: "instructor",
    },
  },
  {
    email: "student@feeana.edu",
    password: "student123",
    user: {
      id: "user-student",
      email: "student@feeana.edu",
      name: "Juan Dela Cruz",
      role: "student",
    },
  },
];

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
  login: (email: string, password: string, role: UserRole) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as AuthUser);
    } catch {
      // ignore parse errors
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string, role: UserRole) => {
      const match = CREDENTIALS.find(
        (c) =>
          c.email.toLowerCase() === email.toLowerCase() &&
          c.password === password &&
          c.user.role === role,
      );
      if (!match) {
        throw new Error("Invalid credentials for selected role.");
      }
      setUser(match.user);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(match.user));
      }
      return match.user;
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      hasRole: (role: UserRole) => user?.role === role,
      login,
      logout,
    }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
