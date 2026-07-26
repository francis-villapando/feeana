interface InlineErrorProps {
  errorMessage?: string;
}

export function InlineError({ errorMessage }: InlineErrorProps) {


  return (
    <div className="text-sm text-destructive">
      <span className="text-sm text-red-500">{errorMessage}</span>
    </div>
  );
}