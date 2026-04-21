import {
  createFileRoute,
  Link,
  notFound,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { ArrowLeft, Copy, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateSessionForm } from "@/components/CreateSessionForm";
import { MOCK_CLASSES } from "@/lib/mockData";
import { useClassStore } from "@/lib/classStore";

export const Route = createFileRoute("/_instructor/classes/$classId")({
  loader: ({ params }) => {
    // Loader uses static seed; live store handles created classes at runtime.
    const cls = MOCK_CLASSES.find((c) => c.id === params.classId);
    return { seed: cls ?? null };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.seed
          ? `${loaderData.seed.course} · ${loaderData.seed.section} — Feeana`
          : "Class — Feeana",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Class not found</h1>
      <Button asChild variant="ghost" className="mt-4">
        <Link to="/home">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
      </Button>
    </div>
  ),
  component: ClassLayout,
});

function ClassLayout() {
  const { classId } = Route.useParams();
  const { getClass } = useClassStore();
  const cls = getClass(classId);
  const location = useLocation();

  if (!cls) {
    throw notFound();
  }

  // Determine active tab from URL path
  const isTrend = location.pathname.endsWith("/trend");
  const isAnalysis = location.pathname.includes("/analysis/");

  const copy = () => {
    navigator.clipboard.writeText(cls.code);
    toast.success("Class code copied");
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/home">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
      </Button>

      {/* Banner */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <CreateSessionForm classId={cls.id} />
        <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base">{cls.name}</CardTitle>
            <CardDescription>Class details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow label="Course" value={cls.course} />
            <DetailRow label="Section" value={cls.section} />
            <DetailRow
              label="Students"
              value={
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {cls.studentCount}
                </span>
              }
            />
            <button
              type="button"
              onClick={copy}
              className="flex w-full items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs hover:border-primary/40"
            >
              <span className="text-muted-foreground">Code</span>
              <span className="flex items-center gap-2 font-mono text-sm tracking-wider">
                {cls.code}
                <Copy className="h-3 w-3 text-muted-foreground" />
              </span>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Tabs (only show on tab routes, not analysis) */}
      {!isAnalysis && (
        <div className="border-b border-border/60">
          <nav className="-mb-px flex gap-1">
            <TabLink
              to="/classes/$classId"
              params={{ classId: cls.id }}
              active={!isTrend}
            >
              Feedback collection sessions
            </TabLink>
            <TabLink
              to="/classes/$classId/trend"
              params={{ classId: cls.id }}
              active={isTrend}
            >
              Trend
            </TabLink>
          </nav>
        </div>
      )}

      <Outlet />
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function TabLink({
  to,
  params,
  active,
  children,
}: {
  to: "/classes/$classId" | "/classes/$classId/trend";
  params: { classId: string };
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      params={params}
      className={
        active
          ? "border-b-2 border-primary px-4 py-2.5 text-sm font-medium text-primary"
          : "border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}
