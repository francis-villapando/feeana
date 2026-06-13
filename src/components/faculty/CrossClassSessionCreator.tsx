import { useState } from "react";
import { Check, ChevronsUpDown, Circle, CircleCheck, PlusCircle, Trash2 } from "lucide-react";
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
import { useClassStore } from "@/lib/classStore";
import { useCourseStore } from "@/lib/courseStore";
import { topicsForClass } from "@/lib/courseLookup";
import { cn } from "@/lib/utils";

interface PerClass {
  classId: string;
  topicId: string;
  startsAt: string;
  endsAt: string;
}

export function CrossClassSessionCreator() {
  const { activeClasses, createSession } = useClassStore();
  const { courses, topics } = useCourseStore();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PerClass[]>([]);

  const toggleClass = (classId: string) => {
    setRows((prev) =>
      prev.some((r) => r.classId === classId)
        ? prev.filter((r) => r.classId !== classId)
        : [...prev, { classId, topicId: "", startsAt: "", endsAt: "" }],
    );
  };

  const updateRow = (classId: string, patch: Partial<PerClass>) => {
    setRows((prev) => prev.map((r) => (r.classId === classId ? { ...r, ...patch } : r)));
  };

  const handleLaunch = () => {
    if (rows.length === 0) {
      toast.error("Pick at least one class.");
      return;
    }
    for (const r of rows) {
      const cls = activeClasses.find((cls) => cls.id === r.classId);
      const crsTopics = topicsForClass(cls, courses, topics);
      const topic = crsTopics.find((t) => t.id === r.topicId);
      if (!topic) {
        toast.error(`Pick a topic for ${cls?.courseDisplay} · ${cls?.section}.`);
        return;
      }
      if (!r.startsAt || !r.endsAt) {
        toast.error("Every class needs a start and end time.");
        return;
      }
      if (new Date(r.endsAt) <= new Date(r.startsAt)) {
        toast.error("End must be after start for each class.");
        return;
      }
    }
    let count = 0;
    for (const r of rows) {
      const cls = activeClasses.find((cls) => cls.id === r.classId);
      const crsTopics = topicsForClass(cls, courses, topics);
      const topic = crsTopics.find((t) => t.id === r.topicId);
      if (!topic) continue;
      createSession({
        classId: r.classId,
        topic: topic.title,
        topicId: topic.id,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
      });
      count++;
    }
    toast.success(`Launched ${count} session(s).`);
    setRows([]);
  };

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PlusCircle className="h-4 w-4 text-primary" /> Cross-class session creator
        </CardTitle>
        <CardDescription>
          Launch a session across multiple classes — each picks its own topic and
          schedule.
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
                className="w-full justify-between font-normal sm:w-[320px]"
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
        </div>

        {rows.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Per-class topic & schedule
            </Label>
            {rows.map((r) => {
              const cls = activeClasses.find((cls) => cls.id === r.classId);
              const crsTopics = topicsForClass(cls, courses, topics);
              return (
                <div
                  key={r.classId}
                  className="grid items-end gap-2 rounded-md border border-border/60 bg-background/40 p-3 lg:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto]"
                >
                  <div className="text-sm">
                    <p className="font-medium">
                      {cls?.courseCode} · {cls?.section}
                    </p>
                    <p className="text-xs text-muted-foreground">{courses.find((crs) => crs.code === cls?.courseCode)?.title}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider">Topic</Label>
                    <Select
                      value={r.topicId}
                      onValueChange={(v) => updateRow(r.classId, { topicId: v })}
                    >
                      <SelectTrigger>
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
                    <Label className="text-[10px] uppercase tracking-wider">Starts</Label>
                    <DateTimePicker
                      value={r.startsAt}
                      onChange={(iso) => updateRow(r.classId, { startsAt: iso })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider">Ends</Label>
                    <DateTimePicker
                      value={r.endsAt}
                      onChange={(iso) => updateRow(r.classId, { endsAt: iso })}
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
              );
            })}
          </div>
        )}

        <Button onClick={handleLaunch} className="w-full">
          Start session
        </Button>
      </CardContent>
    </Card>
  );
}
