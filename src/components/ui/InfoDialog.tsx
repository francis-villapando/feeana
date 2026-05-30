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

function renderHighlighted(text: string) {
  return text.split(/("(.*?)")/).map((part, i, arr) => {
    if (part.startsWith('"') && part.endsWith('"')) {
      const content = part.slice(1, -1);
      return (
        <span key={i} className="font-medium text-primary">
          {content}
        </span>
      );
    }
    if (part === "" || (i > 0 && arr[i - 1]?.startsWith('"'))) {
      return null;
    }
    return part;
  });
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
          <AlertDialogDescription>
            {renderHighlighted(description)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onAction}>{actionLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
