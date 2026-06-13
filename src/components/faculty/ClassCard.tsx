import { Link } from "@tanstack/react-router";
import { ArrowRight, Copy, MessageSquare, Users } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClassStore } from "@/lib/classStore";
import type { Class } from "@/lib/types";

export function ClassCard({ cls }: { cls: Class }) {
  const { sessionsForClass, studentCountForClass } = useClassStore();
  const sessions = sessionsForClass(cls.id);
  const activeCount = sessions.filter((s) => s.status === "active").length;
  const studentCount = studentCountForClass(cls.id);

  const copyCode = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(cls.code);
    toast.success("Class code copied");
  };

  return (
    <Card className="group relative overflow-hidden border-border/60 bg-card/70 backdrop-blur-xl transition hover:border-primary/40">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl transition group-hover:bg-primary/20" />
      <CardHeader className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{cls.name}</CardTitle>
            <CardDescription>
              {cls.course} · Section {cls.section}
            </CardDescription>
          </div>
          {!cls.archived && (
            <Badge variant="outline" className="whitespace-nowrap border-primary/30 text-primary">
              {activeCount} active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {studentCount}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" /> {sessions.length} sessions
          </span>
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="flex w-full items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs hover:border-primary/40"
        >
          <span className="text-muted-foreground">Code</span>
          <span className="flex items-center gap-2 font-mono text-sm tracking-wider">
            {cls.code}
            <Copy className="h-3 w-3 text-muted-foreground" />
          </span>
        </button>
        <Button asChild variant="ghost" size="sm" className="w-full justify-between">
          <Link to="/$classId" params={{ classId: cls.id }}>
            Open class
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
