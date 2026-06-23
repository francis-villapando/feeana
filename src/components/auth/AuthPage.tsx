import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, BookOpenCheck, GraduationCap, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/stores/auth";
import type { UserRole } from "@/lib/types/types";
import { ThemeToggle } from "@/components/common";
import { PasswordField } from "./PasswordField";
import { ForgotPasswordDialog } from "./ForgotPasswordDialog";

const ALLOWED_FACULTY_DOMAIN = import.meta.env.VITE_FACULTY_DOMAIN as string | undefined;

const ROLE_META: Record<
  UserRole,
  { title: string; description: string; icon: typeof GraduationCap }
> = {
  faculty: {
    title: "Faculty portal",
    description: "Sign in or create your faculty account.",
    icon: GraduationCap,
  },
  student: {
    title: "Student portal",
    description: "Sign in or create your student account.",
    icon: BookOpenCheck,
  },
};

type Mode = "signin" | "signup";

export function AuthPage({ role }: { role: UserRole }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const meta = ROLE_META[role];
  const Icon = meta.icon;

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const goHome = (r: UserRole) => {
    navigate({ to: r === "faculty" ? "/home" : "/student/home" });
  };

  const validateFacultyDomain = (email: string): boolean => {
    if (!ALLOWED_FACULTY_DOMAIN) return true;
    const domain = email.split("@")[1]?.toLowerCase();
    return domain === ALLOWED_FACULTY_DOMAIN.toLowerCase();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Email and password are required.");
      return;
    }

    if (role === "faculty" && !validateFacultyDomain(email)) {
      const domainHint = ALLOWED_FACULTY_DOMAIN
        ? `@${ALLOWED_FACULTY_DOMAIN}`
        : "the configured faculty domain";
      toast.error(`Only ${domainHint} emails are allowed for faculty sign-up.`);
      return;
    }

    if (mode === "signup") {
      if (!name.trim()) {
        toast.error("Please enter your name.");
        return;
      }
      if (password.length < 6) {
        toast.error("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirm) {
        toast.error("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        const u = await login(email, password);
        if (u.role !== role) {
          throw new Error("Invalid email or password.");
        }
        toast.success(`Welcome, ${u.name}`);
        goHome(u.role);
      } else {
        const u = await register(email, password, name, role);
        if (u.needsEmailConfirmation) {
          toast.success("Check your email to confirm your account.");
          setMode("signin");
          setName("");
          setEmail("");
          setPassword("");
          setConfirm("");
        } else {
          toast.success(`Account created — welcome, ${u.name}`);
          goHome(u.role);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle className="text-xl">{meta.title}</CardTitle>
                  <CardDescription>{meta.description}</CardDescription>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Juan Dela Cruz"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email
                  {role === "faculty" && mode === "signup" && ALLOWED_FACULTY_DOMAIN && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (must be @{ALLOWED_FACULTY_DOMAIN})
                    </span>
                  )}
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    role === "faculty" && ALLOWED_FACULTY_DOMAIN
                      ? `you@${ALLOWED_FACULTY_DOMAIN}`
                      : "you@example.com"
                  }
                />
              </div>
              <PasswordField
                id="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="Enter your password"
              />
              {mode === "signin" && (
                <div className="text-right text-xs">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-primary hover:underline"
                    onClick={() => setForgotOpen(true)}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              {mode === "signup" && (
                <PasswordField
                  id="confirm"
                  label="Confirm password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                />
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {mode === "signin" ? (
                  <LogIn className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {submitting
                  ? mode === "signin"
                    ? "Signing in..."
                    : "Signing up..."
                  : mode === "signin"
                    ? "Sign in"
                    : "Sign up"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setMode("signup")}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setMode("signin")}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              By continuing you accept the{" "}
              <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Privacy policy
              </a>
              .
            </p>
          </CardContent>
        </Card>
        <ForgotPasswordDialog
          open={forgotOpen}
          onOpenChange={setForgotOpen}
          defaultEmail={email}
          role={role}
        />
      </div>
    </div>
  );
}
