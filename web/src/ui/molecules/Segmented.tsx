import { useId } from "react";
import { cn } from "../cn";
import { Tooltip } from "../atoms/Tooltip";

/** A pick-one row of chips. An option's `tip` shows as its tooltip and is its accessible description. */
export function Segmented<T extends string>({ value, options, onChange, label, className }: { value: T; options: { value: T; label: string; count?: number; tip?: string }[]; onChange: (v: T) => void; label: string; className?: string }) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap items-center gap-1", className)}>
      {options.map((o) => (
        <Tooltip key={o.value} content={o.tip}>
          <button role="radio" aria-checked={value === o.value} aria-describedby={o.tip ? `${id}-${o.value}` : undefined} data-active={value === o.value} className="chip max-md:h-11" onClick={() => onChange(o.value)}>
            {o.label}
            {o.count !== undefined && <span className="opacity-60">{o.count}</span>}
            {o.tip && (
              <span id={`${id}-${o.value}`} hidden>
                {o.tip}
              </span>
            )}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
