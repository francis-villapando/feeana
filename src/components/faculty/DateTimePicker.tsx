import { useEffect, useMemo, useState } from "react";
import { addMinutes, format, isSameDay } from "date-fns";
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
import { dayMatcher, defaultTimeFrom, isAtOrBefore, toDate } from "@/lib/datetime";

interface DateTimePickerProps {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  minDateTime?: string | Date;
  maxDateTime?: string | Date;
  quickPresets?: boolean;
  disabled?: boolean;
}

const HOURS_12 = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MINUTE_STEP = 1;
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const QUICK_PRESETS = [
  { label: "+15m", minutes: 15 },
  { label: "+30m", minutes: 30 },
  { label: "+1h", minutes: 60 },
  { label: "+2h", minutes: 120 },
];

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date & time",
  className,
  minDateTime,
  maxDateTime,
  quickPresets = false,
  disabled = false,
}: DateTimePickerProps) {
  const initial = useMemo(() => (value ? new Date(value) : undefined), [value]);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initial);
  const [selectedHour, setSelectedHour] = useState<string | undefined>(
    initial ? String(initial.getHours() % 12 || 12).padStart(2, "0") : undefined,
  );
  const [selectedMinute, setSelectedMinute] = useState<string | undefined>(
    initial ? String(initial.getMinutes()).padStart(2, "0") : undefined,
  );
  const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>(
    initial ? (initial.getHours() < 12 ? "AM" : "PM") : undefined,
  );

  const min = useMemo(() => toDate(minDateTime), [minDateTime]);
  const max = useMemo(() => toDate(maxDateTime), [maxDateTime]);

  useEffect(() => {
    const d = value ? new Date(value) : undefined;
    setSelectedDate(d);
    setSelectedHour(d ? String(d.getHours() % 12 || 12).padStart(2, "0") : undefined);
    setSelectedMinute(d ? String(d.getMinutes()).padStart(2, "0") : undefined);
    setSelectedPeriod(d ? (d.getHours() < 12 ? "AM" : "PM") : undefined);
  }, [value]);

  const to24 = (h12: number, p: string) => {
    if (h12 === 12) return p === "AM" ? 0 : 12;
    return p === "PM" ? h12 + 12 : h12;
  };

  const emitIfComplete = (
    date: Date | undefined,
    hour: string | undefined,
    minute: string | undefined,
    period: string | undefined,
  ) => {
    if (date && hour && minute && period) {
      const next = new Date(date);
      next.setHours(to24(parseInt(hour, 10), period), parseInt(minute, 10), 0, 0);
      onChange(next.toISOString());
    }
  };

  const handleDate = (d: Date | undefined) => {
    if (!d) return;
    setSelectedDate(d);
    if (selectedHour && selectedMinute && selectedPeriod) {
      emitIfComplete(d, selectedHour, selectedMinute, selectedPeriod);
      return;
    }
    const now = new Date();
    let defaultTime: Date;
    if (min && isSameDay(d, min)) {
      defaultTime = defaultTimeFrom(min, MINUTE_STEP);
    } else if (isSameDay(d, now)) {
      defaultTime = now;
    } else {
      defaultTime = new Date(d);
      defaultTime.setHours(9, 0, 0, 0);
    }
    const hour = String(defaultTime.getHours() % 12 || 12).padStart(2, "0");
    const minute = String(defaultTime.getMinutes()).padStart(2, "0");
    const period = defaultTime.getHours() < 12 ? "AM" : "PM";
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setSelectedPeriod(period);
    emitIfComplete(d, hour, minute, period);
  };

  const handleHour12 = (h12: string) => {
    setSelectedHour(h12);
    emitIfComplete(selectedDate, h12, selectedMinute, selectedPeriod);
  };

  const handleMinute = (m: string) => {
    setSelectedMinute(m);
    emitIfComplete(selectedDate, selectedHour, m, selectedPeriod);
  };

  const handlePeriod = (p: string) => {
    setSelectedPeriod(p);
    emitIfComplete(selectedDate, selectedHour, selectedMinute, p);
  };

  const handleQuickPreset = (minutes: number) => {
    const anchor = min ?? new Date();
    const next = addMinutes(anchor, minutes);
    setSelectedDate(next);
    setSelectedHour(String(next.getHours() % 12 || 12).padStart(2, "0"));
    setSelectedMinute(String(next.getMinutes()).padStart(2, "0"));
    setSelectedPeriod(next.getHours() < 12 ? "AM" : "PM");
    onChange(next.toISOString());
  };

  const sameDayAsMin = Boolean(min && selectedDate && isSameDay(selectedDate, min));

  const isOptionDisabled = (hour?: string, minute?: string, period?: string) => {
    if (!sameDayAsMin || !min || !selectedDate) return false;
    const h = hour ?? selectedHour;
    const m = minute ?? selectedMinute;
    const p = period ?? selectedPeriod;
    if (!h || !m || !p) return false;
    const candidate = new Date(selectedDate);
    candidate.setHours(to24(parseInt(h, 10), p), parseInt(m, 10), 0, 0);
    return isAtOrBefore(candidate, min);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
          {value ? format(new Date(value), "PPP · p") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto border-border/60 bg-popover p-0"
        align="start"
        data-slot="popover-content"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDate}
          disabled={dayMatcher(min, max)}
          initialFocus
          className={cn("p-3 pointer-events-auto w-full")}
          classNames={{
            root: "w-full",
          }}
        />
        <div className="flex items-center gap-2 border-t border-border/60 p-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedHour ?? ""} onValueChange={handleHour12}>
            <SelectTrigger className="w-[80px]">
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {HOURS_12.map((h) => (
                <SelectItem key={h} value={h} disabled={isOptionDisabled(h)}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select value={selectedMinute ?? ""} onValueChange={handleMinute}>
            <SelectTrigger className="w-[80px]">
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {MINUTES.map((m) => (
                <SelectItem key={m} value={m} disabled={isOptionDisabled(undefined, m)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedPeriod ?? ""} onValueChange={handlePeriod}>
            <SelectTrigger className="w-[72px]">
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM" disabled={isOptionDisabled(undefined, undefined, "AM")}>
                AM
              </SelectItem>
              <SelectItem value="PM" disabled={isOptionDisabled(undefined, undefined, "PM")}>
                PM
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {quickPresets && (
          <div className="flex items-center gap-1.5 border-t border-border/60 p-3">
            <span className="mr-1 text-xs text-muted-foreground">Quick</span>
            {QUICK_PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => handleQuickPreset(p.minutes)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
