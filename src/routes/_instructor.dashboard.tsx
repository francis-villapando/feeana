import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Database,
  GraduationCap,
  ListChecks,
  PlusCircle,
  Target,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFeedbackStore } from "@/lib/feedbackStore";
import { MOCK_COURSE, MOCK_ILOS, MOCK_SESSIONS } from "@/lib/mockData";

export const Route = createFileRoute("/_instructor/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Feeana" },
      {
        name: "description",
        content:
          "Instructor control center: pick an ILO, start feedback collection, and review session activity.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { feedback } = useFeedbackStore();
  const [selectedIlo, setSelectedIlo] = useState<string>("");
  const [topic, setTopic] = useState("");

  const stats = useMemo(() => {
    const active = MOCK_SESSIONS.filter((s) => s.status === "active").length;
    const total = feedback.length;
    const pedagogical = feedback.filter((f) => f.isPedagogical).length;
    return { active, total, pedagogical };
  }, [feedback]);

  const handleStart = () => {
    if (!topic.trim()) {
      toast.error("Enter a topic before starting collection.");
      return;
    }
    if (!selectedIlo) {
      toast.error("Link an ILO before starting collection.");
      return;
    }
    toast.success(`Feedback collection started for "${topic}"`);
    setTopic("");
    setSelectedIlo("");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {MOCK_COURSE.code} · {MOCK_COURSE.title}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Instructor Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Diagnose learning gaps before they compound.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
          <Activity className="h-3 w-3" /> Live
        </Badge>
      </div>

      {/* KPI bento */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiTile
          icon={<Database className="h-4 w-4" />}
          label="Active sessions"
          value={stats.active.toString()}
        />
        <KpiTile
          icon={<ListChecks className="h-4 w-4" />}
          label="Total responses"
          value={stats.total.toString()}
          hint={`${stats.pedagogical} pedagogical`}
        />
        <KpiTile
          icon={<Target className="h-4 w-4" />}
          label="ILOs tracked"
          value={MOCK_ILOS.length.toString()}
          hint="Across 1 course"
        />
      </div>

      {/* Control center + sessions */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlusCircle className="h-4 w-4 text-primary" /> Start feedback collection
            </CardTitle>
            <CardDescription>
              Link a topic to one of your ILOs and open a session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="topic">
                Topic
              </label>
              <input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="e.g. Functions & Scope"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Linked ILO
              </label>
              <Select value={selectedIlo} onValueChange={setSelectedIlo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an ILO" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_ILOS.map((ilo) => (
                    <SelectItem key={ilo.id} value={ilo.id}>
                      <span className="font-mono text-xs text-muted-foreground">
                        {ilo.code}
                      </span>{" "}
                      <span className="ml-1">[{ilo.bloomLevel}]</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedIlo && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {MOCK_ILOS.find((i) => i.id === selectedIlo)?.statement}
                </p>
              )}
            </div>
            <Button onClick={handleStart} className="w-full">
              <GraduationCap className="h-4 w-4" /> Start collection
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base">Sessions</CardTitle>
            <CardDescription>
              Active and archived feedback collections.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead>Topic</TableHead>
                  <TableHead>ILOs</TableHead>
                  <TableHead>Responses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_SESSIONS.map((s) => {
                  const count = feedback.filter((f) => f.sessionId === s.id).length;
                  return (
                    <TableRow key={s.id} className="border-border/60">
                      <TableCell className="font-medium">{s.topic}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.iloIds.map((id) => (
                            <Badge
                              key={id}
                              variant="outline"
                              className="font-mono text-[10px]"
                            >
                              {MOCK_ILOS.find((i) => i.id === id)?.code}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{count}</TableCell>
                      <TableCell>
                        <Badge
                          variant={s.status === "active" ? "default" : "secondary"}
                          className={
                            s.status === "active"
                              ? "bg-primary/15 text-primary hover:bg-primary/20"
                              : ""
                          }
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" asChild>
                          <Link
                            to="/analysis/$sessionId"
                            params={{ sessionId: s.id }}
                          >
                            Analyze <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
            {icon}
          </span>
        </div>
        <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
