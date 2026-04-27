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
const USERS_KEY = "feeana.auth.users";

interface MockCredential {
  email: string;
  password: string;
  user: AuthUser;
}

const SEEDED: MockCredential[] = [
  {
    email: "admin@feeana.edu",
    password: "admin123",
    user: {
      id: "user-faculty",
      email: "admin@feeana.edu",
      name: "Prof. Reyes",
      role: "faculty",
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

interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
  login: (email: string, password: string, role: UserRole) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readUsers(): RegisteredUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as RegisteredUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: RegisteredUser[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as AuthUser);
    } catch {
      // ignore
    }
  }, []);

  const persist = useCallback((u: AuthUser) => {
    setUser(u);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string, role: UserRole) => {
      const lower = email.toLowerCase().trim();
      const seeded = SEEDED.find(
        (c) => c.email.toLowerCase() === lower && c.password === password && c.user.role === role,
      );
      if (seeded) {
        persist(seeded.user);
        return seeded.user;
      }
      const users = readUsers();
      const match = users.find(
        (u) => u.email.toLowerCase() === lower && u.password === password && u.role === role,
      );
      if (!match) throw new Error("Invalid credentials for selected role.");
      const auth: AuthUser = {
        id: match.id,
        email: match.email,
        name: match.name,
        role: match.role,
      };
      persist(auth);
      return auth;
    },
    [persist],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const lower = input.email.toLowerCase().trim();
      if (SEEDED.some((c) => c.email.toLowerCase() === lower)) {
        throw new Error("An account with that email already exists.");
      }
      const users = readUsers();
      if (users.some((u) => u.email.toLowerCase() === lower)) {
        throw new Error("An account with that email already exists.");
      }
      const newUser: RegisteredUser = {
        id: `user-${Date.now()}`,
        name: input.name.trim(),
        email: lower,
        password: input.password,
        role: input.role,
      };
      writeUsers([...users, newUser]);
      const auth: AuthUser = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      };
      persist(auth);
      return auth;
    },
    [persist],
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
      register,
      logout,
    }),
    [user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
