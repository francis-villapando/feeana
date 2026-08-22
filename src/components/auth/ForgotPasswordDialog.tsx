import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/stores/auth";
import type { UserRole } from "@/lib/types/types";
import { friendlyError, isRateLimitError } from "@/lib/hooks/utils";
import { useCooldown } from "@/lib/hooks/useCooldown";
import { InlineError, destructiveBorder } from "../common";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
  role?: UserRole;
}

export function ForgotPasswordDialog({
  open,
  onOpenChange,
  defaultEmail,
  role,
}: ForgotPasswordDialogProps) {
  const { forgotPassword } = useAuth();
  const { secondsLeft, isActive, startCooldown } = useCooldown("cooldown_forgot_password", 60);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!open) setSent(false);
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setSubmitError("");
    if (!email.trim()) {
      setEmailError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const redirectTo = role ? `${window.location.origin}/auth/${role}` : window.location.origin;
      await forgotPassword(email, redirectTo);
      startCooldown();
      setSent(true);
    } catch (err) {
      if (isRateLimitError(err)) {
        startCooldown();
        setSubmitError("Too many requests. Please wait a minute before trying again.");
      } else {
        setSubmitError(friendlyError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Forgot password
          </DialogTitle>
          <DialogDescription>
            Enter your email address and we'll send you a link to reset your password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              className={emailError ? destructiveBorder : ""}
              id="reset-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError("");
                setSent(false);
              }}
              placeholder="you@example.com"
            />
            <InlineError errorMessage={emailError} />
          </div>
          <InlineError errorMessage={submitError} />
          {sent && (
            <p className="flex items-start gap-2 text-sm text-primary">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Reset link sent to {email}. If it doesn't arrive within a few minutes, check your spam
              folder.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || isActive}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isActive
                ? `Resend link in ${secondsLeft}s`
                : sent
                  ? "Resend link"
                  : "Send reset link"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
