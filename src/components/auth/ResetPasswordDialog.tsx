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
import { InlineError } from "../common";
import { unchangedFields } from "@/lib/hooks/utils";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordDialog({ open, onOpenChange }: ResetPasswordDialogProps) {
  const { updatePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentError, setCurrentError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCurrentError("");
    setPasswordError("");
    setConfirmError("");
    setSubmitError("");

    if (!current) {
      setCurrentError("Enter your current password.");
      return;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setConfirmError("Passwords do not match.");
      return;
    }
    if (
      unchangedFields([{ label: "password", oldValue: current, newValue: password }]).length === 1
    ) {
      setPasswordError("New password can't be the same as your old password.");
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      toast.success("Password updated successfully.");
      setPassword("");
      setConfirm("");
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const isNetwork =
        !navigator.onLine ||
        msg.toLowerCase().includes("failed to fetch") ||
        msg.toLowerCase().includes("network error");
      setSubmitError(
        isNetwork
          ? "Could not connect to the server. Please check your internet connection or try again later."
          : msg || "Something went wrong.",
      );
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
            id="current-password"
            label="Current password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              setCurrentError("");
            }}
            autoComplete="current-password"
            placeholder="Your current password"
            passwordError={currentError}
          />
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
              onClick={() => onOpenChange(false)}
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
