import { useState } from "react";
import { ChevronsUpDown, Circle, CircleCheck, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/faculty";
import { useClassStore } from "@/lib/stores/classStore";
import { useCourseStore } from "@/lib/stores/courseStore";
import { topicsForClass } from "@/lib/hooks/courseLookup";
import { cn } from "@/lib/hooks/utils";
import { friendlyError } from "@/lib/hooks/utils";
import { InlineError, destructiveBorder } from "@/components/common";

interface PerClass {
  classId: string;
  topicId: string;
  startsAt: string;
  endsAt: string;
}

type RowFieldErrors = {
  topic?: string;
  startsAt?: string;
  endsAt?: string;
};

export function CrossClassSessionCreator() {
  const { activeClasses, createSession } = useClassStore();
  const { courses, topics, ilos } = useCourseStore();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PerClass[]>([]);
  const [launchError, setLaunchError] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, RowFieldErrors>>({});
  const [launching, setLaunching] = useState(false);

  const toggleClass = (classId: string) => {
    setLaunchError("");
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[classId];
      return next;
    });
    setRows((prev) =>
      prev.some((r) => r.classId === classId)
        ? prev.filter((r) => r.classId !== classId)
        : [...prev, { classId, topicId: "", startsAt: "", endsAt: "" }],
    );
  };

  const updateRow = (classId: string, patch: Partial<PerClass>) => {
    setRowErrors((prev) => {
      const next = { ...prev };
      if (next[classId]) {
        const fieldErrors = { ...next[classId] };
        if ("topicId" in patch) delete fieldErrors.topic;
        if ("startsAt" in patch) delete fieldErrors.startsAt;
        if ("endsAt" in patch) delete fieldErrors.endsAt;
        if (Object.keys(fieldErrors).length === 0) {
          delete next[classId];
        } else {
          next[classId] = fieldErrors;
        }
      }
      return next;
    });
    setRows((prev) => prev.map((r) => (r.classId === classId ? { ...r, ...patch } : r)));
  };

  const handleLaunch = async () => {
    setLaunchError("");
    setRowErrors({});

    if (rows.length === 0) {
      setLaunchError("Pick at least one class.");
      return;
    }

    const errorsByClass: Record<string, RowFieldErrors> = {};

    for (const r of rows) {
      const cls = activeClasses.find((c) => c.id === r.classId);
      const crsTopics = topicsForClass(cls, courses, topics);
      const topic = crsTopics.find((t) => t.id === r.topicId);
      const errors: RowFieldErrors = {};

      if (!topic) {
        errors.topic = "Pick a topic.";
      }
      if (!r.startsAt) {
        errors.startsAt = "Pick a start date/time.";
      }
      if (!r.endsAt) {
        errors.endsAt = "Pick an end date/time.";
      }
      if (r.startsAt && r.endsAt && new Date(r.endsAt) <= new Date(r.startsAt)) {
        errors.endsAt = "End must be after start.";
      }
      if (r.endsAt && new Date(r.endsAt) <= new Date()) {
        errors.endsAt = "End time cannot be in the past.";
      }

      if (Object.keys(errors).length > 0) {
        errorsByClass[r.classId] = errors;
      }
    }

    if (Object.keys(errorsByClass).length > 0) {
      setRowErrors(errorsByClass);
      return;
    }

    setLaunching(true);
    try {
      await Promise.all(
        rows.map((r) => {
          const cls = activeClasses.find((c) => c.id === r.classId);
          const crsTopics = topicsForClass(cls, courses, topics);
          const topic = crsTopics.find((t) => t.id === r.topicId);
          if (!topic) return Promise.resolve();
          const sessionIlos = ilos.filter((i) => i.topicId === topic.id && !i.archived);
          return createSession({
            classId: r.classId,
            topic: topic.title,
            topicId: topic.id,
            startsAt: r.startsAt,
            endsAt: r.endsAt,
            iloIds: sessionIlos.map((i) => i.id),
          });
        }),
      );
      toast.success(`Launched ${rows.length} session(s).`);
      setRows([]);
    } catch (err) {
      setLaunchError(friendlyError(err, "Failed to launch sessions"));
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PlusCircle className="h-4 w-4 text-primary" /> Cross-class session creator
        </CardTitle>
        <CardDescription>
          Launch a session across multiple classes—each picks its own topic and schedule.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="block mb-2">Classes</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className={cn(
                  "w-full justify-between font-normal sm:w-[320px]",
                  launchError && destructiveBorder,
                )}
              >
                {rows.length > 0
                  ? `${rows.length} class${rows.length === 1 ? "" : "es"} selected`
                  : "Select classes"}
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search classes…" />
                <CommandList>
                  <CommandEmpty>No classes.</CommandEmpty>
                  <CommandGroup>
                    {activeClasses.map((cls) => {
                      const selected = rows.some((r) => r.classId === cls.id);
                      return (
                        <CommandItem
                          key={cls.id}
                          value={`${cls.courseDisplay} ${cls.section} ${cls.courseCode}`}
                          onSelect={() => toggleClass(cls.id)}
                        >
                          {selected ? (
                            <CircleCheck className="mr-2 h-4 w-4" />
                          ) : (
                            <Circle className="mr-2 h-4 w-4 text-muted-foreground/40" />
                          )}
                          {cls.courseCode} · {cls.section}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <InlineError errorMessage={launchError} />
        </div>

        {rows.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Per-class topic & schedule
            </Label>
            {rows.map((r) => {
              const cls = activeClasses.find((c) => c.id === r.classId);
              const crsTopics = topicsForClass(cls, courses, topics);
              const fieldErrors = rowErrors[r.classId];
              return (
                <div
                  key={r.classId}
                  className="space-y-2 rounded-md border border-border/60 bg-background/40 p-3"
                >
                  <div className="grid gap-2 lg:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto]">
                    <div />
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Topic
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Starts
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Ends
                    </div>
                    <div />
                  </div>
                  <div className="grid items-start gap-2 lg:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto]">
                    <div className="text-sm">
                      <p className="font-medium">
                        {cls?.courseCode} · {cls?.section}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {courses.find((crs) => crs.id === cls?.courseId)?.title}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Select
                        value={r.topicId}
                        onValueChange={(v) => updateRow(r.classId, { topicId: v })}
                      >
                        <SelectTrigger className={fieldErrors?.topic ? destructiveBorder : ""}>
                          <SelectValue
                            placeholder={crsTopics.length === 0 ? "No topics" : "Select topic"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {crsTopics.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              No topics for this course.
                            </div>
                          ) : (
                            crsTopics.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.title}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <DateTimePicker
                        value={r.startsAt}
                        onChange={(iso) => updateRow(r.classId, { startsAt: iso })}
                        className={fieldErrors?.startsAt ? destructiveBorder : ""}
                      />
                    </div>
                    <div className="space-y-1">
                      <DateTimePicker
                        value={r.endsAt}
                        onChange={(iso) => updateRow(r.classId, { endsAt: iso })}
                        className={fieldErrors?.endsAt ? destructiveBorder : ""}
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => toggleClass(r.classId)}
                      aria-label="Remove"
                      className="justify-self-end"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {fieldErrors && (
                    <div className="grid gap-2 justify-items-stretch lg:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto]">
                      <div />
                      <div className="w-full">
                        <InlineError errorMessage={fieldErrors?.topic} />
                      </div>
                      <div className="w-full">
                        <InlineError errorMessage={fieldErrors?.startsAt} />
                      </div>
                      <div className="w-full">
                        <InlineError errorMessage={fieldErrors?.endsAt} />
                      </div>
                      <div className="w-full min-w-[36px]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Button onClick={handleLaunch} className="w-full" disabled={launching}>
          {launching ? "Starting…" : "Start session"}
        </Button>
      </CardContent>
    </Card>
  );
}
