import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InlineError } from "@/components/common";

export type ActionType = "archive" | "restore" | "confirm";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  actionType: ActionType;
  confirmLabel?: string;
  errorMessage?: string;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  actionType,
  confirmLabel,
  errorMessage,
}: ConfirmationDialogProps) {
  // Default labels if not provided
  const label =
    confirmLabel ||
    (actionType === "archive" ? "Archive" : actionType === "restore" ? "Restore" : "Confirm");

  const renderDescription = (text: string) => {
    const first = text.indexOf('"');
    const last = text.lastIndexOf('"');
    if (first !== -1 && last > first) {
      return (
        <>
          {text.slice(0, first)}
          <span className="text-primary font-medium">{text.slice(first + 1, last)}</span>
          {text.slice(last + 1)}
        </>
      );
    }
    return text;
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {renderDescription(description)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <InlineError errorMessage={errorMessage} />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
