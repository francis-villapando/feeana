import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "./supabase";
import type { UserRole } from "./types";
import type { AuthUser } from "./types";
import type { User } from "@supabase/supabase-js";

interface AuthContextValue {
  user: AuthUser | null;
  supabaseUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasRole: (role: UserRole) => boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, name: string, role: UserRole) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUserRole(role: string | undefined): UserRole {
  return role === "faculty" ? "faculty" : "student";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const user = useMemo<AuthUser | null>(() => {
    if (!supabaseUser) return null;
    const meta = supabaseUser.user_metadata;
    return {
      id: supabaseUser.id,
      email: supabaseUser.email ?? "",
      name: meta?.full_name ?? meta?.name ?? supabaseUser.email?.split("@")[0] ?? "User",
      role: normalizeUserRole(meta?.role as string | undefined),
    };
  }, [supabaseUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Login failed");
    const meta = data.user.user_metadata;
    return {
      id: data.user.id,
      email: data.user.email ?? email,
      name: meta?.full_name ?? meta?.name ?? email.split("@")[0],
      role: normalizeUserRole(meta?.role as string | undefined),
    };
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string, role: UserRole) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role,
          },
        },
      });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error("Registration failed");
      return {
        id: data.user.id,
        email: data.user.email ?? email,
        name,
        role,
      };
    },
    [],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      supabaseUser,
      isAuthenticated: user !== null,
      isLoading,
      hasRole: (role: UserRole) => user?.role === role,
      login,
      register,
      logout,
    }),
    [user, supabaseUser, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}