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
import { isRateLimitError } from "../hooks/utils";

interface AuthContextValue {
  user: AuthUser | null;
  supabaseUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasRole: (role: UserRole) => boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (
    email: string,
    password: string,
    name: string,
    role: UserRole,
  ) => Promise<
    AuthUser & { needsEmailConfirmation: boolean; alreadyExists: boolean; confirmed: boolean }
  >;
  resendConfirmation: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string, redirectTo?: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
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
      setSupabaseUser((prev) => {
        if (prev?.id === session?.user?.id) return prev;
        return session?.user ?? null;
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const user = useMemo<AuthUser | null>(() => {
    if (!supabaseUser) return null;
    const userMeta = supabaseUser.user_metadata;
    return {
      id: supabaseUser.id,
      email: supabaseUser.email ?? "",
      name: userMeta?.full_name ?? userMeta?.name ?? supabaseUser.email?.split("@")[0] ?? "User",
      role: normalizeUserRole(userMeta?.role as string | undefined),
    };
  }, [supabaseUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Login failed");

    setSupabaseUser(data.user);

    const userMeta = data.user.user_metadata;
    return {
      id: data.user.id,
      email: data.user.email ?? email,
      name: userMeta?.full_name ?? userMeta?.name ?? email.split("@")[0],
      role: normalizeUserRole(userMeta?.role as string | undefined),
    };
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string, role: UserRole) => {
      const normalizedEmail = email.trim().toLowerCase();

      const duplicateResult = {
        id: "",
        email: normalizedEmail,
        name,
        role,
        needsEmailConfirmation: false,
        alreadyExists: true,
        confirmed: false,
      };

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: name,
            role,
          },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/confirm?role=${role}`
              : undefined,
        },
      });

      if (error) {
        const msg = error.message?.toLowerCase() ?? "";
        const code = (error as { code?: string }).code?.toLowerCase() ?? "";
        const isDuplicate =
          msg.includes("already registered") ||
          msg.includes("already exists") ||
          msg.includes("user_already_exists") ||
          code === "user_already_exists" ||
          code === "email_exists" ||
          error.status === 422;

        const isRateLimit = isRateLimitError(error);

        if (isDuplicate || isRateLimit) {
          return duplicateResult;
        }
        throw new Error(error.message);
      }

      if (!data.user) throw new Error("Registration failed");

      if (!Array.isArray(data.user.identities) || data.user.identities.length === 0) {
        return duplicateResult;
      }

      if (data.session?.user) {
        setSupabaseUser(data.session.user);
      }

      return {
        id: data.user.id,
        email: data.user.email ?? normalizedEmail,
        name,
        role,
        needsEmailConfirmation: !data.session,
        alreadyExists: false,
        confirmed: false,
      };
    },
    [],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSupabaseUser(null);
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/auth/confirm` : undefined;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
    if (error) throw new Error(error.message);
  }, []);

  const forgotPassword = useCallback(async (email: string, redirectTo?: string) => {
    const url =
      redirectTo ??
      (typeof window !== "undefined" ? `${window.location.origin}/auth/reset-password` : undefined);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: url,
    });
    if (error) throw new Error(error.message);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
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
      resendConfirmation,
      forgotPassword,
      updatePassword,
    }),
    [
      user,
      supabaseUser,
      isLoading,
      login,
      register,
      logout,
      resendConfirmation,
      forgotPassword,
      updatePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
