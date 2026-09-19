import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ViewSwitcherProps<T extends string> {
  views: { value: T; label: string }[];
  value: T;
  onValueChange: (value: T) => void;
}

export function ViewSwitcher<T extends string>({
  views,
  value,
  onValueChange,
}: ViewSwitcherProps<T>) {
  return (
    <>
      <TabsList className="hidden sm:inline-flex">
        {views.map((view) => (
          <TabsTrigger key={view.value} value={view.value}>
            {view.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <Select value={value} onValueChange={(v) => onValueChange(v as T)}>
        <SelectTrigger className="sm:hidden min-w-[60px] max-w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {views.map((view) => (
            <SelectItem key={view.value} value={view.value}>
              {view.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
