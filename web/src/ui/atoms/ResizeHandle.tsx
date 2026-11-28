import { PanelResizeHandle } from "react-resizable-panels";

/** The drag handle between two resizable panels: a hairline that turns accent while dragged or focused. `label` names it. */
export function ResizeHandle({ label }: { label: string }) {
  return (
    <PanelResizeHandle aria-label={label} className="group relative flex w-2 shrink-0 items-stretch justify-center focus-visible:outline-none">
      <span className="w-px bg-line group-hover:bg-ink/30 group-focus-visible:w-0.5 group-focus-visible:bg-accent-ink group-data-[resize-handle-active]:bg-accent-ink" />
    </PanelResizeHandle>
  );
}
