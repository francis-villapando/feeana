import { useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  /** ISO string or empty */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date & time",
  className,
}: DateTimePickerProps) {
  const date = useMemo(() => (value ? new Date(value) : undefined), [value]);
  const hour = date ? String(date.getHours()).padStart(2, "0") : "09";
  const minute = date ? String(date.getMinutes()).padStart(2, "0") : "00";

  const emit = (next: Date) => onChange(next.toISOString());

  const handleDate = (d: Date | undefined) => {
    if (!d) return;
    const next = new Date(d);
    next.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
    emit(next);
  };
  const handleHour = (h: string) => {
    const base = date ?? new Date();
    base.setHours(parseInt(h, 10), parseInt(minute, 10), 0, 0);
    emit(base);
  };
  const handleMinute = (m: string) => {
    const base = date ?? new Date();
    base.setHours(parseInt(hour, 10), parseInt(m, 10), 0, 0);
    emit(base);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start font-normal",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
          {date ? format(date, "PPP · p") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDate}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="flex items-center gap-2 border-t border-border/60 p-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Select value={hour} onValueChange={handleHour}>
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {HOURS.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select value={minute} onValueChange={handleMinute}>
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {MINUTES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
