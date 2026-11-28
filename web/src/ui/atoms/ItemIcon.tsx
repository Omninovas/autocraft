import { CheckCircleIcon, CircleIcon, GitMergeIcon, GitPullRequestIcon, RadioButtonIcon, ShieldWarningIcon, type Icon as PhosphorIcon, type IconProps } from "@phosphor-icons/react";
import type { ItemKind, ItemState } from "../../api/types";
import { t } from "../../../../src/i18n/index.ts";
import { cn } from "../cn";
import { Tooltip } from "./Tooltip";

/** An item's kind, or a security finding (a row that is not a GitHub item). */
export type IconKind = ItemKind | "finding";

/** Phosphor has no draft pull request glyph: the pull request shape with a dotted line to the target branch, drawn like Phosphor's bold set. */
const GitPullRequestDraftIcon = ({ size = "1em", color = "currentColor", className, ...rest }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={size} height={size} fill="none" stroke={color} strokeWidth={24} strokeLinecap="round" className={className} {...(rest as object)}>
    <circle cx="72" cy="64" r="26" />
    <circle cx="72" cy="192" r="26" />
    <circle cx="200" cy="192" r="26" />
    <path d="M72 90v76" />
    <path d="M200 160V70" strokeDasharray="1 36" />
  </svg>
);

/** Phosphor icon, colour and name for an item, as GitHub shows its state. */
function look(kind: IconKind | null | undefined, state: ItemState | null | undefined, draft: boolean | undefined): [PhosphorIcon | typeof GitPullRequestDraftIcon, string, string] {
  if (kind === "pr") {
    if (state === "merged") return [GitMergeIcon, "text-merged", t("Merged pull request")];
    if (state === "closed") return [GitPullRequestIcon, "text-bad", t("Closed pull request")];
    return draft ? [GitPullRequestDraftIcon, "text-ink/60", t("Draft pull request")] : [GitPullRequestIcon, "text-ok", t("Open pull request")];
  }
  if (kind === "issue") return state === "closed" ? [CheckCircleIcon, "text-merged", t("Closed issue")] : [RadioButtonIcon, "text-ok", t("Open issue")];
  if (kind === "finding") return [ShieldWarningIcon, "text-warn", t("Security finding")];
  return [CircleIcon, "text-ink/45", t("Item")];
}

/** The item's kind and state as a plain icon, named in its tip, as tall as one text line (`1lh`) so it sits with the text, also on wrapped titles. */
export function ItemIcon({ kind, state, draft, className, tip = true }: { kind?: IconKind | null; state?: ItemState | null; draft?: boolean; className?: string; /** false leaves out the tip (inside another tip). */ tip?: boolean }) {
  const [Icon, tone, what] = look(kind, state, draft);
  return (
    <Tooltip title={tip ? what : undefined} align="start">
      <span role="img" aria-label={what} className={cn("inline-flex h-[1lh] shrink-0 items-center", tone, className)}>
        <Icon aria-hidden size="1.2em" weight="bold" />
      </span>
    </Tooltip>
  );
}
