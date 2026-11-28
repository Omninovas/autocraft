import { cn } from "../cn";

/** A GitHub label as a pill: the name in a rounded outline, cut short with an ellipsis past 16 rem (the full name in its tip). */
export function LabelPill({ name, className }: { name: string; className?: string }) {
  return (
    <span title={name} className={cn("relative z-10 inline-flex h-5 max-w-[16rem] items-center rounded-full border border-line-strong px-2 text-2xs leading-none text-ink/80", className)}>
      <span className="truncate">{name}</span>
    </span>
  );
}
