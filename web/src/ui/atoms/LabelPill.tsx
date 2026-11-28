import { cn } from "../cn";

/** A GitHub label as a pill: the name in a rounded outline, cut short past 16 rem. */
export function LabelPill({ name, className }: { name: string; className?: string }) {
  return <span className={cn("inline-flex h-5 max-w-[16rem] items-center truncate rounded-full border border-line-strong px-2 text-2xs leading-none text-ink/80", className)}>{name}</span>;
}
