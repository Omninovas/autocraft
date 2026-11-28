import { ChatCircleDotsIcon, CheckCircleIcon, CircleIcon, CircleNotchIcon, PauseCircleIcon, type Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { ImplementationStateName, ItemChat, ItemChatState, MaintainItem } from "../api/types";
import { tk } from "../../../src/i18n/index.ts";
import type { Tone } from "../ui/atoms/Badge";

/** An implementation attempt's state as the item page and the Queue show it. */
export const IMPLEMENTATION_STATE: Record<ImplementationStateName, { label: string; tone: Tone }> = {
  planning: { label: "Planning", tone: "accent" },
  asked: { label: "Question asked", tone: "warn" },
  planned: { label: "Planned", tone: "accent" },
  implementing: { label: "Writing the change", tone: "accent" },
  checking: { label: "AutoCraft's checks", tone: "accent" },
  fixing: { label: "Follow-up on findings", tone: "accent" },
  opening: { label: "Opening the PR", tone: "accent" },
  "pr-opened": { label: "PR opened", tone: "ok" },
  revising: { label: "Revising the PR", tone: "accent" },
  stuck: { label: "Stuck", tone: "bad" },
  merged: { label: "Merged", tone: "merged" },
  closed: { label: "Closed", tone: "neutral" },
  failed: { label: "Failed", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** AutoCraft's state on an item as its status line draws it: icon, colour, icon weight and the word a screen reader hears. */
export const ITEM_CHAT_STATE: Record<ItemChatState, { icon: PhosphorIcon; tone: string; weight: "fill" | "bold" | "regular"; word: string }> = {
  running: { icon: CircleNotchIcon, tone: "text-accent-ink animate-spin", weight: "bold", word: tk("running") },
  waiting: { icon: ChatCircleDotsIcon, tone: "text-warn", weight: "fill", word: tk("waiting") },
  held: { icon: PauseCircleIcon, tone: "text-ink/70", weight: "fill", word: tk("held") },
  done: { icon: CheckCircleIcon, tone: "text-ok", weight: "fill", word: tk("done") },
  idle: { icon: CircleIcon, tone: "text-ink/60", weight: "regular", word: tk("not started") },
};

/** The status line of an item: the chat's own once it has one, else the item's workflow status. */
export function itemChatStatus(chat: ItemChat | undefined, m: MaintainItem): { status: string | null; state: ItemChatState; next: string | null } {
  if (chat?.status) return { status: chat.status, state: chat.state, next: chat.next };
  const x = m.status;
  const state: ItemChatState = !x ? "idle" : x.held ? "held" : x.asked || x.rec || x.unclear ? "waiting" : x.live ? "running" : "idle";
  return { status: x?.headline || null, state, next: null };
}
