import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, BookOpenCheck, GraduationCap, LogIn, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/stores/auth";
import type { UserRole } from "@/lib/types/types";
import { ThemeToggle } from "@/components/common";
import { PasswordField } from "./PasswordField";
import { ForgotPasswordDialog } from "./ForgotPasswordDialog";
import { InlineError, destructiveBorder } from "../common";
import { friendlyError, isRateLimitError } from "@/lib/hooks/utils";
import { useCooldown } from "@/lib/hooks/useCooldown";

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
  const { login, register, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const roleMeta = ROLE_META[role];
  const Icon = roleMeta.icon;

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [accountExists, setAccountExists] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [resendError, setResendError] = useState("");
  const [resending, setResending] = useState(false);
  const {
    secondsLeft: resendSeconds,
    isActive: resendActive,
    startCooldown,
  } = useCooldown("cooldown_resend_confirmation", 60, email);

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

    setNameError("");
    setEmailError("");
    setPasswordError("");
    setConfirmError("");
    setSubmitError("");

    if (!email.trim()) {
      setEmailError("Email is required.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address.");
    }
    if (!password.trim()) {
      setPasswordError("Password is required.");
    }
    if (mode === "signup") {
      if (!name.trim()) {
        setNameError("Name is required.");
      }
      if (password.length < 6 && password.trim()) {
        setPasswordError("Password must be at least 6 characters.");
      } else if (password !== confirm) {
        setConfirmError("Passwords do not match.");
      }
    }

    const hasSignupErrors =
      mode === "signup" && (!name.trim() || password.length < 6 || password !== confirm);
    const hasRequiredErrors =
      !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password.trim();
    if (hasSignupErrors || hasRequiredErrors) return;

    if (role === "faculty" && !validateFacultyDomain(email)) {
      const domainHint = ALLOWED_FACULTY_DOMAIN
        ? `@${ALLOWED_FACULTY_DOMAIN}`
        : "the configured faculty domain";
      setEmailError(`Only ${domainHint} emails are allowed for faculty sign-up.`);
      return;
    }

    if (mode === "signup" && resendActive) {
      setAccountExists(true);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        const authUser = await login(email, password);
        if (authUser.role !== role) {
          throw new Error("Invalid email or password.");
        }
        toast.success(`Welcome, ${authUser.name}`);
        goHome(authUser.role);
      } else {
        const regResult = await register(email, password, name, role);
        if (regResult.alreadyExists) {
          startCooldown();
          setAccountExists(true);
        } else if (regResult.needsEmailConfirmation) {
          startCooldown(60, { force: true });
          toast.success("Check your email to confirm your account.");
          setMode("signin");
          setName("");
          setPassword("");
          setConfirm("");
        } else {
          toast.success(`Account created — welcome, ${regResult.name}`);
          goHome(regResult.role);
        }
      }
    } catch (err) {
      if (mode === "signup" && isRateLimitError(err)) {
        startCooldown();
        setAccountExists(true);
        return;
      }
      const msg = err instanceof Error ? err.message : "";
      const msgLower = msg.toLowerCase();
      if (
        msg === "EMAIL_ALREADY_EXISTS" ||
        msgLower.includes("already registered") ||
        msgLower.includes("already exists") ||
        msgLower.includes("user_already_exists")
      ) {
        startCooldown();
        setAccountExists(true);
      } else if (msgLower.includes("email not confirmed")) {
        setSubmitError(
          "Please confirm your email before signing in. Check your inbox for the confirmation link.",
        );
      } else if (isRateLimitError(err)) {
        startCooldown();
        setSubmitError("Too many requests. Please wait a minute before trying again.");
      } else {
        const friendly =
          msgLower.includes("invalid login credentials") ||
          msgLower.includes("invalid email or password")
            ? "Invalid email or password."
            : friendlyError(err);
        setSubmitError(friendly);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendActive || resending) return;
    setResendError("");
    setResending(true);
    try {
      await resendConfirmation(email);
      startCooldown(60, { force: true });
      toast.success("If your email isn't verified yet, a new confirmation link has been sent.");
    } catch (err) {
      if (isRateLimitError(err)) {
        startCooldown(60);
        setResendError("Too many requests. Please wait a minute before trying again.");
      } else {
        setResendError(friendlyError(err, "Could not send confirmation email."));
      }
    } finally {
      setResending(false);
    }
  };

  const clearAllErrors = () => {
    setEmailError("");
    setPasswordError("");
    setNameError("");
    setConfirmError("");
    setSubmitError("");
    setResendError("");
  };

  const handleSwitchToSignIn = () => {
    setAccountExists(false);
    clearAllErrors();
    setMode("signin");
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
                  <CardTitle className="text-xl">{roleMeta.title}</CardTitle>
                  <CardDescription>{roleMeta.description}</CardDescription>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </CardHeader>
          <CardContent>
            {accountExists ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  An account with <span className="font-medium text-foreground">{email}</span>{" "}
                  already exists.
                </p>
                <p className="text-xs text-muted-foreground">
                  If you haven't confirmed your email yet, check your inbox for the confirmation
                  link.
                </p>
                <div className="flex flex-col gap-2">
                  <Button onClick={handleSwitchToSignIn} className="w-full">
                    <LogIn className="h-4 w-4" /> Sign in
                  </Button>
                  <Button
                    onClick={handleResend}
                    variant="outline"
                    className="w-full"
                    disabled={resending || resendActive}
                  >
                    <Mail className="h-4 w-4" />
                    {resending
                      ? "Sending…"
                      : resendActive
                        ? `Resend in ${resendSeconds}s`
                        : "Resend confirmation email"}
                  </Button>
                  <InlineError errorMessage={resendError} />
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      className={nameError ? destructiveBorder : ""}
                      id="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setNameError("");
                      }}
                      placeholder="Juan Dela Cruz"
                    />
                    <InlineError errorMessage={nameError} />
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
                    className={emailError ? destructiveBorder : ""}
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError("");
                    }}
                    placeholder={
                      role === "faculty" && ALLOWED_FACULTY_DOMAIN
                        ? `you@${ALLOWED_FACULTY_DOMAIN}`
                        : "you@example.com"
                    }
                  />
                  <InlineError errorMessage={emailError} />
                </div>
                <PasswordField
                  id="password"
                  label="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError("");
                  }}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  placeholder="Enter your password"
                  passwordError={passwordError}
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
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      setConfirmError("");
                    }}
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    passwordError={confirmError}
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
                      ? "Signing in…"
                      : "Signing up…"
                    : mode === "signin"
                      ? "Sign in"
                      : "Sign up"}
                </Button>
                <InlineError errorMessage={submitError} />
              </form>
            )}

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => {
                      setAccountExists(false);
                      clearAllErrors();
                      setMode("signup");
                    }}
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
                    onClick={() => {
                      setAccountExists(false);
                      clearAllErrors();
                      setMode("signin");
                    }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              By continuing you accept the{" "}
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
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
