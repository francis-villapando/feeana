import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InlineError } from "@/components/common";
import { cn, friendlyError } from "@/lib/hooks/utils";
import { parseFeedbackFile, type ParsedFeedbackFile } from "@/lib/utils/feedbackParser";
import { useFeedbackStore } from "@/lib/stores/feedbackStore";

const ACCEPTED_EXTENSIONS = [".csv", ".tsv", ".txt"];

interface BulkFeedbackImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  /** Raw texts already stored for the session; exact matches are skipped. */
  existingTexts: string[];
  onImported: (count: number) => void;
}

export function BulkFeedbackImportModal({
  isOpen,
  onClose,
  sessionId,
  existingTexts,
  onImported,
}: BulkFeedbackImportModalProps) {
  const { addBulkFeedback } = useFeedbackStore();
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [fileName, setFileName] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMode("file");
      setFileName(null);
      setContent("");
      setDragging(false);
      setImporting(false);
      setError(null);
    }
  }, [isOpen]);

  const parsed = useMemo<ParsedFeedbackFile | null>(
    () => (content.trim() ? parseFeedbackFile(content, new Set(existingTexts)) : null),
    [content, existingTexts],
  );

  const readFile = useCallback(async (file: File) => {
    if (!ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setError("Unsupported file type — use .csv, .tsv, or .txt");
      return;
    }
    setFileName(file.name);
    setContent(await file.text());
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void readFile(file);
    },
    [readFile],
  );

  const handleImport = async () => {
    if (!parsed || parsed.items.length === 0 || importing) return;
    setImporting(true);
    setError(null);
    try {
      const inserted = await addBulkFeedback(sessionId, parsed.items);
      toast.success(`Imported ${inserted.length} feedback item(s)`);
      onImported(inserted.length);
      onClose();
    } catch (err) {
      setError(friendlyError(err, "Import failed."));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onInteractOutside={(e) => importing && e.preventDefault()}
        onEscapeKeyDown={(e) => importing && e.preventDefault()}
        className="flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-lg flex-col gap-0 overflow-hidden border border-border/80 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:rounded-2xl"
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-4">
          <DialogTitle>Import feedback</DialogTitle>
          <DialogDescription>
            Bulk-insert raw student feedback into this session from a CSV/TSV file or pasted text.
          </DialogDescription>
        </DialogHeader>

        <div className="chart-tooltip-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {(["file", "paste"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m);
                  setFileName(null);
                  setContent("");
                  setError(null);
                }}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  mode === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "file" ? "Upload file" : "Paste text"}
              </button>
            ))}
          </div>

          {mode === "file" ? (
            fileName ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                  {fileName}
                </span>
                <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Change
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Remove file"
                  onClick={() => {
                    setFileName(null);
                    setContent("");
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload feedback file"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/40 hover:border-primary/50 hover:bg-muted/60",
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Upload className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  Drop a file here or click to browse
                </p>
                <p className="text-xs text-muted-foreground">.csv, .tsv, or .txt</p>
              </div>
            )
          ) : (
            <Textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setError(null);
              }}
              placeholder={"Paste one feedback per line, or CSV/TSV with a text column…"}
              className="min-h-[140px] max-h-[220px] resize-y"
              aria-label="Pasted feedback text"
            />
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = "";
            }}
          />

          {parsed && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">{parsed.items.length}</span> ready
                  to import
                </span>
                <span>
                  <span className="font-semibold text-foreground">{parsed.totalRows}</span> row(s)
                  found
                </span>
                {parsed.ignoredRows > 0 && (
                  <span>
                    <span className="font-semibold text-foreground">{parsed.ignoredRows}</span>{" "}
                    duplicate/empty skipped
                  </span>
                )}
              </div>
              {parsed.items.length > 0 && (
                <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border/60 bg-muted/40 p-3">
                  {parsed.items.slice(0, 5).map((item, i) => (
                    <li key={i} className="break-words text-xs text-foreground">
                      &ldquo;{item}&rdquo;
                    </li>
                  ))}
                  {parsed.items.length > 5 && (
                    <li className="text-xs text-muted-foreground">
                      …and {parsed.items.length - 5} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          <InlineError errorMessage={error} />
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-muted/20 px-6 py-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={importing}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!parsed || parsed.items.length === 0 || importing}
            className="w-full gap-2 sm:w-auto"
          >
            {importing && <Loader2 className="h-4 w-4 animate-spin" />}
            {importing ? "Importing…" : "Import feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
