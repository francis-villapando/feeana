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

export type ActionType = "archive" | "delete" | "restore" | "confirm";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  actionType: ActionType;
  confirmLabel?: string;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  actionType,
  confirmLabel,
}: ConfirmationDialogProps) {
  
  // Default labels if not provided
  const label = confirmLabel || (
    actionType === "archive" ? "Archive" :
    actionType === "delete" ? "Delete" :
    actionType === "restore" ? "Restore" : "Confirm"
  );

  const isDestructive = actionType === "delete";

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
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className={isDestructive ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
