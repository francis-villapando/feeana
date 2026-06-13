import { Copy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Class } from "@/lib/types";

export function ClassDetailsCard({
  cls,
  studentCount,
  onCopy,
  onArchive,
}: {
  cls: Class;
  studentCount: number;
  onCopy: () => void;
  onArchive: () => void;
}) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-base">Class details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <DetailRow label="Course" value={<span className="ml-1">{cls.course}</span>} />
        <DetailRow label="Section" value={cls.section} />
        <DetailRow
          label="Students"
          value={
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {studentCount}
            </span>
          }
        />
        <button
          type="button"
          onClick={onCopy}
          className="flex w-full items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs hover:border-primary/40"
        >
          <span className="text-muted-foreground">Code</span>
          <span className="flex items-center gap-2 font-mono text-sm tracking-wider">
            {cls.code}
            <Copy className="h-3 w-3 text-muted-foreground" />
          </span>
        </button>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="w-full"
          onClick={onArchive}
        >
          Archive class
        </Button>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
