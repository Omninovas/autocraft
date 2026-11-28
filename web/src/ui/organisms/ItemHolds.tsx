import { useState } from "react";
import { PauseCircleIcon } from "@phosphor-icons/react";
import type { MaintainItem, MaintainReply, RepoName } from "../../api/types";
import { t } from "../../../../src/i18n/index.ts";
import { Button } from "../atoms/Button";
import { cn } from "../cn";

export type ItemControl = { control: "release-outside"; repo: RepoName; number: number } | { control: "resume-breaker"; key: string };

/** An item's outside-author hold and paused steps as rows above the composer, each with its registered control (Release, Resume) when the reader may press it. */
export function ItemHolds({ m, onControl }: { m: Pick<MaintainItem, "repo" | "number" | "outside" | "breakers">; onControl: (body: ItemControl) => Promise<MaintainReply> }) {
  const [reply, setReply] = useState<MaintainReply | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (id: string, body: ItemControl) => {
    setBusy(id);
    try {
      setReply(await onControl(body));
    } catch (e) {
      setReply({ ok: false, lines: [e instanceof Error ? e.message : String(e)] });
    } finally {
      setBusy(null);
    }
  };
  const rows = [
    ...(m.outside
      ? [
          {
            id: "outside",
            line:
              m.outside.reason === "surge"
                ? t("Held: {author} is outside the team and opened this during a surge.", { author: m.outside.author })
                : t("Held: {author} is outside the team and over the daily limit.", { author: m.outside.author }),
            action: m.outside.canRelease ? { label: t("Release"), go: () => run("outside", { control: "release-outside", repo: m.repo, number: m.number }) } : null,
          },
        ]
      : []),
    ...m.breakers.map((b) => ({
      id: b.key,
      line: b.reason ? t("Paused by the {key} breaker: {reason}", { key: b.key, reason: b.reason }) : t("Paused by the {key} breaker", { key: b.key }),
      action: b.canResume ? { label: t("Resume"), go: () => run(b.key, { control: "resume-breaker", key: b.key }) } : null,
    })),
  ];
  if (!rows.length && !reply) return null;
  return (
    <div className="mx-auto w-full max-w-[784px] px-3 md:px-6">
      {rows.length > 0 && (
        <ul aria-label={t("Holds")} className="mb-2 flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-warn/60 bg-warn/10 px-3 py-2 text-sm">
              <PauseCircleIcon aria-hidden weight="fill" className="shrink-0 text-warn" />
              <span className="min-w-0 flex-1">{r.line}</span>
              {r.action && (
                <Button size="lg" loading={busy === r.id} onClick={() => void r.action!.go()}>
                  {r.action.label}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div aria-live="polite">
        {reply?.lines.map((l) => (
          <p key={l} className={cn("mb-2 text-sm", reply.ok ? "text-ink/80" : "text-bad")}>
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}
