import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface InfoDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  actionLabel?: string;
  onAction: () => void;
}

export function InfoDialog({
  isOpen,
  title,
  description,
  actionLabel = "OK",
  onAction,
}: InfoDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => !o && onAction()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onAction}>{actionLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
