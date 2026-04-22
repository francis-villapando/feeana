import { useState } from "react";
import { Check, ChevronsUpDown, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { useClassStore } from "@/lib/classStore";
import { cn } from "@/lib/utils";

interface PerClass {
  classId: string;
  startsAt: string;
  endsAt: string;
}

export function CrossClassFeedbackCreator() {
  const { activeClasses, createSession } = useClassStore();
  const [topic, setTopic] = useState("");
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PerClass[]>([]);

  const toggleClass = (classId: string) => {
    setRows((prev) =>
      prev.some((r) => r.classId === classId)
        ? prev.filter((r) => r.classId !== classId)
        : [...prev, { classId, startsAt: "", endsAt: "" }],
    );
  };

  const updateRow = (classId: string, patch: Partial<PerClass>) => {
    setRows((prev) =>
      prev.map((r) => (r.classId === classId ? { ...r, ...patch } : r)),
    );
  };

  const handleLaunch = () => {
    if (!topic.trim()) {
      toast.error("Topic is required.");
      return;
    }
    if (rows.length === 0) {
      toast.error("Pick at least one class.");
      return;
    }
    for (const r of rows) {
      if (!r.startsAt || !r.endsAt) {
        toast.error("Every class needs a start and end time.");
        return;
      }
      if (new Date(r.endsAt) <= new Date(r.startsAt)) {
        toast.error("End must be after start for each class.");
        return;
      }
    }
    rows.forEach((r) =>
      createSession({
        classId: r.classId,
        topic,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
      }),
    );
    toast.success(`Launched "${topic}" in ${rows.length} class(es).`);
    setTopic("");
    setRows([]);
  };

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PlusCircle className="h-4 w-4 text-primary" /> Cross-class feedback
          creator
        </CardTitle>
        <CardDescription>
          Launch the same topic across multiple classes with their own schedules.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="x-topic">Topic</Label>
            <Input
              id="x-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Recursion fundamentals"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Classes</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
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
                      {activeClasses.map((c) => {
                        const selected = rows.some((r) => r.classId === c.id);
                        return (
                          <CommandItem
                            key={c.id}
                            value={`${c.course} ${c.section} ${c.name}`}
                            onSelect={() => toggleClass(c.id)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selected ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {c.course} · {c.section}{" "}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {c.name}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Schedules per class
            </Label>
            {rows.map((r) => {
              const cls = activeClasses.find((c) => c.id === r.classId);
              return (
                <div
                  key={r.classId}
                  className="grid items-end gap-2 rounded-md border border-border/60 bg-background/40 p-3 lg:grid-cols-[1.2fr_1fr_1fr_auto]"
                >
                  <div className="text-sm">
                    <p className="font-medium">
                      {cls?.course} · {cls?.section}
                    </p>
                    <p className="text-xs text-muted-foreground">{cls?.name}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider">
                      Starts
                    </Label>
                    <DateTimePicker
                      value={r.startsAt}
                      onChange={(iso) =>
                        updateRow(r.classId, { startsAt: iso })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider">
                      Ends
                    </Label>
                    <DateTimePicker
                      value={r.endsAt}
                      onChange={(iso) => updateRow(r.classId, { endsAt: iso })}
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleClass(r.classId)}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <Button onClick={handleLaunch} className="w-full">
          Launch collection
        </Button>
      </CardContent>
    </Card>
  );
}
