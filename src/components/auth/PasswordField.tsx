import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { InlineError, destructiveBorder } from "@/components/common";

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete: string;
  placeholder?: string;
  passwordError?: string;
} & Omit<
  ComponentProps<typeof Input>,
  "id" | "type" | "value" | "onChange" | "autoComplete" | "placeholder"
>;

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  className,
  passwordError,
  ...props
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`pr-9 ${passwordError ? destructiveBorder : ""}`}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => setShow(!show)}
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="sr-only">{show ? "Hide password" : "Show password"}</span>
        </Button>
      </div>
      <InlineError errorMessage={passwordError} />
    </div>
  );
}
