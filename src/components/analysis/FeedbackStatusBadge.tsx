interface FeedbackStatusBadgeProps {
  count: number;
}

export function FeedbackStatusBadge({ count }: FeedbackStatusBadgeProps) {
  if (count <= 0) return null;

  return (
    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
      {count}
    </span>
  );
}
