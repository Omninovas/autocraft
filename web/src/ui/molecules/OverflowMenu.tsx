// A row's overflow menu: a three-dots trigger and a list of actions. Keyboard and focus come from the menu primitive.
import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";
import { DotsThreeIcon, type Icon } from "@phosphor-icons/react";
import { cn } from "../cn";

export interface OverflowAction {
  key: string;
  label: string;
  icon?: Icon;
  tone?: "bad";
  onSelect: () => void;
}

const menuCls = "z-50 min-w-[200px] rounded-md border border-line-strong bg-raised p-1 shadow-[0_12px_32px_rgba(0,0,0,0.28)] animate-rise";
const itemCls = "flex h-8 cursor-default items-center gap-2.5 rounded px-2 text-sm outline-none data-[highlighted]:bg-ink/[0.07] max-md:h-11";

/** `label` names the trigger for assistive technology ("Actions for Canvas"). `trigger` replaces the three dots with a button of the caller's. */
export function OverflowMenu({ label, actions, className, trigger }: { label: string; actions: OverflowAction[]; className?: string; trigger?: ReactNode }) {
  if (!actions.length) return null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {trigger ?? <button type="button" aria-label={label} className={cn("relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded text-ink/60 outline-none hover:bg-ink/[0.07] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 data-[state=open]:bg-ink/[0.07] max-md:size-11", className)}>
          <DotsThreeIcon size={20} weight="bold" />
        </button>}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} collisionPadding={8} className={menuCls}>
          {actions.map(({ key, label: text, icon: Ico, tone, onSelect }) => (
            <DropdownMenu.Item key={key} className={cn(itemCls, tone === "bad" && "text-bad")} onSelect={onSelect}>
              {Ico && <Ico size={16} aria-hidden />}
              {text}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
