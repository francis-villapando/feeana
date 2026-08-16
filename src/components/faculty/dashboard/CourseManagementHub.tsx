import { useMemo, useState, useEffect, useRef } from "react";
import {
  Archive,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  BookOpen,
  ListChecks,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useCourseStore } from "@/lib/stores/courseStore";
import { DuplicateError, ConflictError } from "@/lib/services/courseService";
import type { Course, ILO, Topic } from "@/lib/types/types";
import { EntityFormDialog } from "./EntityFormDialog";
import { useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { friendlyError } from "@/lib/hooks/utils";
import { ConfirmationDialog, type ActionType } from "@/components/faculty";

type EditState =
  | { kind: "course"; entity?: Course }
  | { kind: "topic"; entity?: Topic; initialCourseId?: string }
  | { kind: "ILO"; entity?: ILO; initialCourseId?: string; initialTopicId?: string }
  | null;

type ConfirmState = {
  title: string;
  description: string;
  onConfirm: () => void;
  actionType: ActionType;
  confirmLabel?: string;
} | null;

function confirmSuccessLabel(title: string): string {
  const [verb, ...rest] = title.split(" ");
  const past =
    verb === "Archive" ? "archived" : verb === "Restore" ? "restored" : verb.toLowerCase();
  const label = `${rest.join(" ")} ${past}.`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

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
    refreshAll,
  } = useCourseStore();

  const [showArchived, setShowArchived] = useState(() => {
    const saved = localStorage.getItem("feeana_show_archived");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("feeana_show_archived", String(showArchived));
  }, [showArchived]);

  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState<EditState>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [confirmError, setConfirmError] = useState("");
  const [focusedId, setFocusedId] = useState<string | undefined>(undefined);

  const search = useSearch({ strict: false }) as { focus?: string; t?: number };
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!search.focus) return;
    setFocusedId(search.focus);

    let courseId = "";
    const ilo = ilos.find((i) => i.id === search.focus);
    if (ilo) {
      courseId = ilo.courseId;
    } else {
      const topic = topics.find((t) => t.id === search.focus);
      if (topic) {
        courseId = topic.courseId;
      } else {
        const course = courses.find((crs) => crs.id === search.focus);
        if (course) courseId = course.id;
      }
    }

    if (!courseId) {
      toast.error("This item has been deleted.");
      window.history.replaceState(null, "", "/dashboard");
      return;
    }

    if (!expandedItems.includes(courseId)) {
      setExpandedItems((prev) => [...prev, courseId]);
    }

    setTimeout(() => {
      const el = document.getElementById(`entity-${search.focus}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    setTimeout(() => setFocusedId(undefined), 2000);
  }, [search.focus, search.t]);

  const filterFn = <T extends { archived: boolean }>(arr: T[]) =>
    arr.filter((x) => (showArchived ? true : !x.archived));

  const filteredHierarchy = useMemo(() => {
    const q = query.toLowerCase();

    const visibleIlos = filterFn(ilos).filter(
      (i) => i.statement.toLowerCase().includes(q) || i.bloomLevel.toLowerCase().includes(q),
    );

    const visibleTopics = filterFn(topics).filter((t) => {
      const matches = t.title.toLowerCase().includes(q);
      const hasVisibleIlo = visibleIlos.some((i) => i.topicId === t.id);
      return matches || hasVisibleIlo;
    });

    const visibleCourses = filterFn(courses).filter((crs) => {
      const matches = crs.code.toLowerCase().includes(q) || crs.title.toLowerCase().includes(q);
      const hasVisibleTopic = visibleTopics.some((t) => t.courseId === crs.id);
      return matches || hasVisibleTopic;
    });

    return {
      courses: visibleCourses,
      topics: visibleTopics,
      ilos: visibleIlos,
    };
  }, [courses, topics, ilos, query, showArchived]);

  const handleAction = (
    title: string,
    description: string,
    onConfirm: () => void,
    actionType: ActionType,
    confirmLabel?: string,
  ) => {
    setConfirmError("");
    setConfirm({ title, description, onConfirm, actionType, confirmLabel });
  };

  return (
    <Card
      className="border-border/60 bg-card/70 backdrop-blur-xl flex flex-col h-full w-full max-w-full min-w-0"
      ref={containerRef}
    >
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Course management hub</CardTitle>
            <CardDescription>
              Manage curriculum hierarchy: Course &gt; Topic &gt; ILO.
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
            <Button size="sm" onClick={() => setEdit({ kind: "course" })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Course
            </Button>
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses, topics, or ILOs..."
            className="h-8 pl-7 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {filteredHierarchy.courses.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 bg-background/30 px-4 py-12 text-center text-sm text-muted-foreground">
            No results found matching your search.
          </div>
        ) : (
          <Accordion
            type="multiple"
            value={expandedItems}
            onValueChange={setExpandedItems}
            className="space-y-2"
          >
            {filteredHierarchy.courses.map((course) => (
              <AccordionItem
                key={course.id}
                value={course.id}
                id={`entity-${course.id}`}
                className={`border border-border/60 rounded-lg bg-background/40 px-1 overflow-hidden transition-all duration-1000 ${
                  course.archived ? "opacity-60" : ""
                } ${focusedId === course.id ? "ring-2 ring-primary ring-inset" : ""}`}
              >
                <div className="group/course flex items-center w-full">
                  <AccordionTrigger className="hover:no-underline py-3 pl-3 pr-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3 text-left overflow-hidden flex-1 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/30">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">{course.code}</span>
                          {course.archived && (
                            <Badge variant="outline" className="text-[10px] h-4">
                              Archived
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground truncate block">
                          {course.title}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <div className="flex items-center gap-1 shrink-0 pr-3">
                    {course.archived ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(
                              "Restore course",
                              `Restore the "${course.code}" course?`,
                              () => restoreCourse(course.id),
                              "restore",
                            );
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEdit({ kind: "course", entity: course });
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(
                              "Archive course",
                              `Archive the "${course.code}" course?`,
                              () => archiveCourse(course.id),
                              "archive",
                            );
                          }}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <AccordionContent className="pt-0 px-3 pb-3 border-t border-border/20 pt-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Topics
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEdit({ kind: "topic", initialCourseId: course.id });
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add topic
                    </Button>
                  </div>

                  <div className="space-y-3 pl-4 border-l-2 border-border/40 ml-4">
                    {filteredHierarchy.topics.filter((t) => t.courseId === course.id).length ===
                    0 ? (
                      <p className="text-xs text-muted-foreground py-2 italic">No topics yet.</p>
                    ) : (
                      filteredHierarchy.topics
                        .filter((t) => t.courseId === course.id)
                        .map((topic) => (
                          <div key={topic.id} className="space-y-2" id={`entity-${topic.id}`}>
                            <div
                              className={`flex items-center justify-between gap-3 p-2 rounded-md bg-background/60 border border-border/40 group transition-all duration-1000 ${
                                topic.archived ? "opacity-60" : ""
                              } ${focusedId === topic.id ? "ring-2 ring-primary ring-inset" : ""}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <ListChecks className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                                <span className="text-xs font-medium truncate">{topic.title}</span>
                                {topic.archived && (
                                  <Badge variant="outline" className="text-[9px] h-3.5 px-1">
                                    Archived
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {!topic.archived && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => setEdit({ kind: "topic", entity: topic })}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    if (topic.archived) {
                                      handleAction(
                                        "Restore topic",
                                        `Restore the "${topic.title}" topic?`,
                                        () => restoreTopic(topic.id),
                                        "restore",
                                      );
                                    } else {
                                      handleAction(
                                        "Archive topic",
                                        `Archive the "${topic.title}" topic?`,
                                        () => archiveTopic(topic.id),
                                        "archive",
                                      );
                                    }
                                  }}
                                >
                                  {topic.archived ? (
                                    <RotateCcw className="h-3 w-3" />
                                  ) : (
                                    <Archive className="h-3 w-3" />
                                  )}
                                </Button>

                                {!topic.archived && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-primary"
                                    onClick={() =>
                                      setEdit({
                                        kind: "ILO",
                                        initialCourseId: course.id,
                                        initialTopicId: topic.id,
                                      })
                                    }
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div className="grid gap-2 pl-6">
                              {filteredHierarchy.ilos
                                .filter((i) => i.topicId === topic.id)
                                .map((ilo) => (
                                  <div
                                    key={ilo.id}
                                    id={`entity-${ilo.id}`}
                                    className={`flex items-center justify-between gap-3 p-2 rounded-md bg-background/20 border border-border/20 group/ilo transition-all duration-1000 ${
                                      ilo.archived ? "opacity-60" : ""
                                    } ${focusedId === ilo.id ? "ring-2 ring-primary ring-inset" : ""}`}
                                  >
                                    <div className="flex gap-2 min-w-0">
                                      <Target className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Badge
                                            variant="secondary"
                                            className="text-[9px] px-1 h-3.5 font-normal uppercase tracking-tighter"
                                          >
                                            {ilo.bloomLevel}
                                          </Badge>
                                          {ilo.archived && (
                                            <Badge
                                              variant="outline"
                                              className="text-[9px] h-3.5 px-1"
                                            >
                                              Archived
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-[11px] leading-relaxed text-muted-foreground break-words">
                                          {ilo.statement}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {!ilo.archived && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5"
                                          onClick={() => setEdit({ kind: "ILO", entity: ilo })}
                                        >
                                          <Pencil className="h-2.5 w-2.5" />
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={() => {
                                          const label =
                                            ilo.statement.length > 50
                                              ? ilo.statement.slice(0, 50) + "..."
                                              : ilo.statement;
                                          if (ilo.archived) {
                                            handleAction(
                                              "Restore ILO",
                                              `Restore the "${label}" ILO?`,
                                              () => restoreILO(ilo.id),
                                              "restore",
                                            );
                                          } else {
                                            handleAction(
                                              "Archive ILO",
                                              `Archive the "${label}" ILO?`,
                                              () => archiveILO(ilo.id),
                                              "archive",
                                            );
                                          }
                                        }}
                                      >
                                        {ilo.archived ? (
                                          <RotateCcw className="h-2.5 w-2.5" />
                                        ) : (
                                          <Archive className="h-2.5 w-2.5" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>

      {edit && <EntityFormDialog state={edit} onClose={() => setEdit(null)} />}

      {confirm && (
        <ConfirmationDialog
          isOpen={!!confirm}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            setConfirmError("");
            try {
              await confirm.onConfirm();
              toast.success(confirmSuccessLabel(confirm.title));
              setConfirm(null);
            } catch (e) {
              if (e instanceof DuplicateError) {
                setConfirmError(e.message);
                await refreshAll();
              } else if (e instanceof ConflictError) {
                setConfirmError(e.message);
                await refreshAll();
              } else {
                setConfirmError(friendlyError(e, "Action failed"));
              }
            }
          }}
          title={confirm.title}
          description={confirm.description}
          actionType={confirm.actionType}
          confirmLabel={confirm.confirmLabel}
          errorMessage={confirmError}
        />
      )}
    </Card>
  );
}
