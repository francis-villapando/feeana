import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Database,
  GraduationCap,
  ListChecks,
  Target,
} from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFeedbackStore } from "@/lib/feedbackStore";
import { useClassStore } from "@/lib/classStore";
import { MOCK_ILOS } from "@/lib/mockData";

export const Route = createFileRoute("/_instructor/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Feeana" },
      {
        name: "description",
        content:
          "Workspace KPIs at a glance: classes, sessions, and response volume.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { feedback } = useFeedbackStore();
  const { activeClasses, sessions } = useClassStore();

  const stats = useMemo(() => {
    const active = sessions.filter((s) => s.status === "active").length;
    const total = feedback.length;
    const pedagogical = feedback.filter((f) => f.isPedagogical).length;
    return { active, total, pedagogical };
  }, [feedback, sessions]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Workspace overview
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Diagnose learning gaps before they compound.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
          <Activity className="h-3 w-3" /> Live
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={<GraduationCap className="h-4 w-4" />}
          label="Active classes"
          value={activeClasses.length.toString()}
        />
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
        />
      </div>

      <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base">Your classes</CardTitle>
          <CardDescription>
            Jump into a class to manage its feedback collection sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {activeClasses.length === 0 && (
            <p className="text-sm text-muted-foreground">No classes yet.</p>
          )}
          {activeClasses.map((c) => (
            <Button
              key={c.id}
              asChild
              variant="outline"
              className="h-auto justify-between py-3"
            >
              <Link to="/classes/$classId" params={{ classId: c.id }}>
                <span className="text-left">
                  <span className="block text-sm font-medium">
                    {c.course} · {c.section}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {c.name}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>
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
