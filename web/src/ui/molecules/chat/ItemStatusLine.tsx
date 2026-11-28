import type { ItemChatState } from "../../../api/types";
import { ITEM_CHAT_STATE } from "../../../lib/status";
import { t } from "../../../../../src/i18n/index.ts";
import { cn } from "../../cn";

/** AutoCraft's status on an item in one line: the state's icon, the status and what comes next, clamped to two lines with the whole text in its tip. */
export function ItemStatusLine({ status, state, next, className }: { status: string; state: ItemChatState; next: string | null; className?: string }) {
  const { icon: Icon, tone, weight, word } = ITEM_CHAT_STATE[state];
  return (
    <p className={cn("flex items-start gap-2 text-sm", className)}>
      <span className="inline-flex h-5 shrink-0 items-center">
        <Icon aria-hidden weight={weight} className={cn("text-[14px]", tone)} />
      </span>
      <span className="sr-only">{t(word)}: </span>
      <span title={next ? `${status}. ${t("Next: {step}", { step: next })}` : status} className="line-clamp-2 min-w-0">
        <span className="font-medium text-ink">{status}</span>
        {next && <span className="text-ink/70">. {t("Next: {step}", { step: next })}</span>}
      </span>
    </p>
  );
}
