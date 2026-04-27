import { useMemo, useState } from "react";
import { Archive, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCourseStore } from "@/lib/courseStore";
import type { BloomLevel, Course, ILO, Topic } from "@/lib/types";
import { EntityFormDialog } from "./EntityFormDialog";

type EditState =
  | { kind: "course"; entity?: Course }
  | { kind: "topic"; entity?: Topic }
  | { kind: "ILO"; entity?: ILO }
  | null;

export function CourseManagementHub() {
  const {
    courses,
    topics,
    ilos,
    archiveCourse,
    restoreCourse,
    archiveTopic,
    restoreTopic,
    archiveILO,
    restoreILO,
  } = useCourseStore();
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState<EditState>(null);

  const filterFn = <T extends { archived: boolean }>(arr: T[]) =>
    arr.filter((x) => (showArchived ? true : !x.archived));

  const visibleCourses = useMemo(
    () =>
      filterFn(courses).filter(
        (c) =>
          c.code.toLowerCase().includes(query.toLowerCase()) ||
          c.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [courses, showArchived, query],
  );
  const visibleTopics = useMemo(
    () => filterFn(topics).filter((t) => t.title.toLowerCase().includes(query.toLowerCase())),
    [topics, showArchived, query],
  );
  const visibleIlos = useMemo(
    () =>
      filterFn(ilos).filter(
        (i) =>
          i.code.toLowerCase().includes(query.toLowerCase()) ||
          i.statement.toLowerCase().includes(query.toLowerCase()),
      ),
    [ilos, showArchived, query],
  );

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Course management hub</CardTitle>
            <CardDescription>
              CRUD courses, topics, and intended learning outcomes (soft delete).
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="archived-toggle"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="archived-toggle" className="text-xs">
                Show archived
              </Label>
            </div>
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-8 pl-7 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="courses">
          <TabsList>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="topics">Topics</TabsTrigger>
            <TabsTrigger value="ilos">ILOs</TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="mt-4 space-y-2">
            <ListHeader onAdd={() => setEdit({ kind: "course" })} addLabel="Add course" />
            {visibleCourses.length === 0 && <EmptyRow />}
            {visibleCourses.map((c) => (
              <Row
                key={c.id}
                archived={c.archived}
                primary={c.code}
                secondary={c.title}
                onEdit={() => setEdit({ kind: "course", entity: c })}
                onArchive={() => archiveCourse(c.id)}
                onRestore={() => restoreCourse(c.id)}
              />
            ))}
          </TabsContent>

          <TabsContent value="topics" className="mt-4 space-y-2">
            <ListHeader onAdd={() => setEdit({ kind: "topic" })} addLabel="Add topic" />
            {visibleTopics.length === 0 && <EmptyRow />}
            {visibleTopics.map((t) => {
              const course = courses.find((c) => c.id === t.courseId);
              return (
                <Row
                  key={t.id}
                  archived={t.archived}
                  primary={t.title}
                  secondary={course ? `${course.code}` : "—"}
                  onEdit={() => setEdit({ kind: "topic", entity: t })}
                  onArchive={() => archiveTopic(t.id)}
                  onRestore={() => restoreTopic(t.id)}
                />
              );
            })}
          </TabsContent>

          <TabsContent value="ilos" className="mt-4 space-y-2">
            <ListHeader onAdd={() => setEdit({ kind: "ILO" })} addLabel="Add ILO" />
            {visibleIlos.length === 0 && <EmptyRow />}
            {visibleIlos.map((i) => (
              <Row
                key={i.id}
                archived={i.archived}
                primary={`${i.code} · ${i.bloomLevel}`}
                secondary={i.statement}
                onEdit={() => setEdit({ kind: "ILO", entity: i })}
                onArchive={() => archiveILO(i.id)}
                onRestore={() => restoreILO(i.id)}
              />
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>

      {edit && <EntityFormDialog state={edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function ListHeader({ onAdd, addLabel }: { onAdd: () => void; addLabel: string }) {
  return (
    <div className="flex justify-end">
      <Button size="sm" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </Button>
    </div>
  );
}

function EmptyRow() {
  return (
    <div className="rounded-md border border-dashed border-border/60 bg-background/30 px-4 py-6 text-center text-xs text-muted-foreground">
      Nothing here yet.
    </div>
  );
}

function Row({
  archived,
  primary,
  secondary,
  onEdit,
  onArchive,
  onRestore,
}: {
  archived: boolean;
  primary: string;
  secondary: string;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2 ${
        archived ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{primary}</p>
          {archived && (
            <Badge variant="outline" className="border-muted text-[10px]">
              Archived
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{secondary}</p>
      </div>
      <div className="flex items-center gap-1">
        {!archived && (
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {archived ? (
          <Button size="icon" variant="ghost" onClick={onRestore} aria-label="Restore">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="icon" variant="ghost" onClick={onArchive} aria-label="Archive">
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
