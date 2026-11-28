// One queued model call: its step, tier and model, its items, how long it has waited, its estimated cost and why it waits, with
// "Run on my Task Runner" (pick) and Unpick for those who may.
import { LightningIcon } from "@phosphor-icons/react";
import { t } from "../../../../src/i18n/index.ts";
import type { ModelQueueCall, ModelQueueWhyCode, User } from "../../api/types";
import { span } from "../../lib/format";
import { formatCost } from "../../lib/trace";
import { Badge, type Tone } from "../atoms/Badge";
import { Button } from "../atoms/Button";
import { ItemRef } from "../molecules/ItemRef";

const WHY_TONE: Record<ModelQueueWhyCode, Tone> = { picked: "accent", session: "neutral", bound: "neutral", "bound-off": "warn", owner: "neutral", "owner-off": "warn", login: "neutral", "no-runner": "warn", "manual-only": "warn", busy: "neutral", "no-repo-access": "warn", "task-off": "warn", "items-off": "warn", behind: "neutral" };

/** `waited`: the call's wait as of now; `busy`: the pending write's key (`pick:<id>`, `unpick:<id>`). */
export function QueuedCallRow({ c, user, waited, busy, onPick, onUnpick }: { c: ModelQueueCall; user: User; waited: number; busy: string | null; onPick: () => void; onUnpick: () => void }) {
  const staff = user.role !== "viewer";
  const mine = !!c.picked?.login && c.picked.login.toLowerCase() === user.login.toLowerCase();
  const canUnpick = staff && !!c.picked && (mine || user.role === "operator");
  const cost = formatCost(c.estCostUsd);
  return (
    <li className="flex flex-col gap-2 border-b border-line px-4 py-2.5 last:border-0 md:flex-row md:items-start md:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{c.kind}</span>
          <Badge tone="accent">
            {c.tier} · {c.model}
          </Badge>
          {c.followUp && <Badge>{t("follow-up")}</Badge>}
          {c.gating && <Badge>{t("gating")}</Badge>}
        </div>
        <div className="mt-1 flex flex-col items-start gap-0.5">
          {c.items.map((i) => (
            <ItemRef key={`${i.repo}#${i.number}`} repo={i.repo} number={i.number} kind={i.kind} state={i.state} title={i.title} size="sm" className="w-fit max-w-full" />
          ))}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/65">
          <span className="num">{t("waited {time}", { time: span(waited) })}</span>
          <span className="num">{t("est. {cost}", { cost: cost ?? "–" })}</span>
          {c.why.code !== "picked" && <Badge tone={WHY_TONE[c.why.code]}>{c.why.text}</Badge>}
        </div>
        {c.lastError && <p className="mt-1 break-words text-xs text-bad">{c.lastError}</p>}
      </div>
      {(c.picked || (staff && c.pickable)) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {c.picked ? (
            <>
              <Badge tone="accent">{c.picked.login ? t("Picked by {login}", { login: c.picked.login }) : t("Picked")}</Badge>
              {canUnpick && (
                <Button size="sm" variant="ghost" loading={busy === `unpick:${c.id}`} onClick={onUnpick}>
                  {t("Unpick")}
                </Button>
              )}
            </>
          ) : (
            <Button icon={LightningIcon} variant="primary" size="sm" loading={busy === `pick:${c.id}`} onClick={onPick}>
              {t("Run on my Task Runner")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
