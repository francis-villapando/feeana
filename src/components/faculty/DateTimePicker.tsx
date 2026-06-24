import { useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/hooks/utils";

interface DateTimePickerProps {
  /** ISO string or empty */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
}

const HOURS_12 = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date & time",
  className,
}: DateTimePickerProps) {
  const date = useMemo(() => (value ? new Date(value) : undefined), [value]);

  const hour24 = date ? date.getHours() : 9;
  const displayHour = hour24 % 12 || 12;
  const displayHourStr = String(displayHour).padStart(2, "0");
  const minuteStr = date ? String(date.getMinutes()).padStart(2, "0") : "00";
  const period = hour24 < 12 ? "AM" : "PM";

  const to24 = (h12: number, p: string) => {
    if (h12 === 12) return p === "AM" ? 0 : 12;
    return p === "PM" ? h12 + 12 : h12;
  };

  const emit = (next: Date) => onChange(next.toISOString());

  const handleDate = (d: Date | undefined) => {
    if (!d) return;
    const next = new Date(d);
    next.setHours(to24(displayHour, period), parseInt(minuteStr, 10), 0, 0);
    emit(next);
  };
  const handleHour12 = (h12: string) => {
    const base = date ?? new Date();
    base.setHours(to24(parseInt(h12, 10), period), parseInt(minuteStr, 10), 0, 0);
    emit(base);
  };
  const handleMinute = (m: string) => {
    const base = date ?? new Date();
    base.setHours(to24(displayHour, period), parseInt(m, 10), 0, 0);
    emit(base);
  };
  const handlePeriod = (p: string) => {
    const base = date ?? new Date();
    base.setHours(to24(displayHour, p), parseInt(minuteStr, 10), 0, 0);
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
      <PopoverContent className="w-auto p-0" align="start" data-slot="popover-content">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDate}
          initialFocus
          className={cn("p-3 pointer-events-auto w-full")}
          classNames={{
            root: "w-full",
          }}
        />
        <div className="flex items-center gap-2 border-t border-border/60 p-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Select value={displayHourStr} onValueChange={handleHour12}>
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {HOURS_12.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select value={minuteStr} onValueChange={handleMinute}>
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
          <Select value={period} onValueChange={handlePeriod}>
            <SelectTrigger className="w-[72px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
