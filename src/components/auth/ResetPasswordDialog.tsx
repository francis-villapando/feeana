import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/stores/auth";
import { PasswordField } from "./PasswordField";
import { useNavigate } from "@tanstack/react-router";
import { InlineError } from "../common";
import { friendlyError } from "@/lib/hooks/utils";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordDialog({ open, onOpenChange }: ResetPasswordDialogProps) {
  const { user, isPasswordRecovery, updatePassword, clearPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [submitError, setSubmitError] = useState("");

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
      setPassword("");
      setConfirm("");
      onOpenChange(false);
      if (isPasswordRecovery) {
        clearPasswordRecovery();
        navigate({ to: user?.role === "student" ? "/auth/student" : "/auth/faculty" });
      }
    } catch (err) {
      setSubmitError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Reset password
          </DialogTitle>
          <DialogDescription>Enter your new password below.</DialogDescription>
        </DialogHeader>
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
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearPasswordRecovery();
                onOpenChange(false);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset password
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
