import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../db/supabase";
import type { UserRole } from "../types/types";
import type { AuthUser } from "../types/types";
import type { User } from "@supabase/supabase-js";

interface AuthContextValue {
  user: AuthUser | null;
  supabaseUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  hasRole: (role: UserRole) => boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (
    email: string,
    password: string,
    name: string,
    role: UserRole,
  ) => Promise<AuthUser & { needsEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
  forgotPassword: (email: string, redirectTo?: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUserRole(role: string | undefined): UserRole {
  return role === "faculty" ? "faculty" : "student";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      }
      setSupabaseUser((prev) => {
        if (prev?.id === session?.user?.id) return prev;
        return session?.user ?? null;
      });
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
      if (data.user.identities?.length === 0) {
        throw new Error("This email is already registered.");
      }
      return {
        id: data.user.id,
        email: data.user.email ?? email,
        name,
        role,
        needsEmailConfirmation: !data.session,
      };
    },
    [],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const forgotPassword = useCallback(async (email: string, redirectTo?: string) => {
    const url = redirectTo ?? (typeof window !== "undefined" ? window.location.origin : undefined);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: url,
    });
    if (error) throw new Error(error.message);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      supabaseUser,
      isAuthenticated: user !== null,
      isLoading,
      isPasswordRecovery,
      hasRole: (role: UserRole) => user?.role === role,
      login,
      register,
      logout,
      forgotPassword,
      updatePassword,
      clearPasswordRecovery,
    }),
    [user, supabaseUser, isLoading, isPasswordRecovery, login, register, logout, forgotPassword, updatePassword, clearPasswordRecovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
