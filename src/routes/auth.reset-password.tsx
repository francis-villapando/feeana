import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2, Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLandingCard, PasswordField } from "@/components/auth";
import { InlineError } from "@/components/common";
import { useAuth } from "@/lib/stores/auth";
import { friendlyError } from "@/lib/hooks/utils";

type ResetSearch = { role?: "faculty" | "student" };

export const Route = createFileRoute("/auth/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetSearch => ({
    role: search.role === "faculty" || search.role === "student" ? search.role : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Reset password — Feeana" },
      { name: "description", content: "Set a new password for your Feeana account." },
    ],
  }),
  component: ResetPasswordPage,
});

type Status = "resolving" | "form" | "success" | "invalid";

function ResetPasswordPage() {
  const { role } = Route.useSearch();
  const { updatePassword } = useAuth();
  const [status, setStatus] = useState<Status>("resolving");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = hashParams.get("type");
    if (hashParams.get("error")) {
      setStatus("invalid");
    } else if (hashParams.get("access_token") && (type === "recovery" || !type)) {
      setStatus("form");
    } else {
      setStatus("invalid");
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setConfirmError("");
    setSubmitError("");

    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setConfirmError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      toast.success("Password updated successfully.");
      setStatus("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("different from the old password") || msg.includes("same_password")) {
        setPasswordError("New password can't be the same as your old password.");
      } else {
        setSubmitError(friendlyError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const signInLink = role === "faculty" ? "/auth/faculty" : "/auth/student";

  if (status === "form") {
    return (
      <AuthLandingCard
        icon={Lock}
        title="Reset password"
        description="Enter your new password below."
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <PasswordField
            id="new-password"
            label="Type new password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError("");
            }}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            passwordError={passwordError}
          />
          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setConfirmError("");
            }}
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            passwordError={confirmError}
          />
          <InlineError errorMessage={submitError} />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Update Password
          </Button>
        </form>
      </AuthLandingCard>
    );
  }

  if (status === "success") {
    return (
      <AuthLandingCard
        icon={CheckCircle2}
        iconClassName="bg-primary/15 text-primary ring-primary/30"
        title="Password Updated"
        description="Your password has been reset successfully."
      >
        <div className="space-y-4 text-center">
          <Button asChild className="w-full">
            <Link to={signInLink}>
              <LogIn className="h-4 w-4" /> Go to Sign In
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Your password has been updated. You can sign in above, or safely close this tab and sign
            in using your previous window.
          </p>
        </div>
      </AuthLandingCard>
    );
  }

  if (status === "invalid") {
    return (
      <AuthLandingCard
        icon={AlertCircle}
        iconClassName="bg-destructive/15 text-destructive ring-destructive/30"
        title="Reset link is invalid or has expired"
        description="This password reset link is invalid or was already used. Request a new one from the sign-in page."
      >
        <div className="text-center">
          <Button asChild className="w-full">
            <Link to={signInLink}>
              <LogIn className="h-4 w-4" /> Back to Sign In
            </Link>
          </Button>
        </div>
      </AuthLandingCard>
    );
  }

  return (
    <AuthLandingCard icon={Lock} title="Reset password">
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Validating your reset link…
      </div>
    </AuthLandingCard>
  );
}
