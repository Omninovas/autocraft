// Home: the Task Runner line, then the reader's own items (started, approved, held or asked), most recently updated first, with
// the conversation's last line. Viewers see what waits for a maintainer.
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CaretRightIcon, WarningCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import { t } from "../../../../../src/i18n/index.ts";
import { useApi, useQuery } from "../../../api/client";
import type { HomeAction, HomeProblem, MaintainRow, MaintainRunnerLine } from "../../../api/types";
import { useUser } from "../../../shell/UserContext";
import { Pending } from "../../../ui/atoms/Pending";
import { Button } from "../../../ui/atoms/Button";
import { ErrorLine } from "../../../ui/atoms/ErrorLine";
import { ConfirmButton } from "../../../ui/molecules/ConfirmButton";
import { useWrite } from "../../../lib/hooks";
import { messageTime } from "../../../lib/format";
import { cn } from "../../../ui/cn";
import { ItemRef } from "../../../ui/molecules/ItemRef";
import { GithubButton } from "../../../ui/atoms/GithubButton";
import { githubItemUrl } from "../../../lib/links";
import type { ViewProps } from "../../../registry/types";

const calls = (n: number) => (n === 1 ? t("1 call running") : t("{n} calls running", { n }));
const others = (n: number) => (n === 0 ? t("no others available") : n === 1 ? t("1 other available") : t("{n} others available", { n }));

/** One line about the reader's Task Runners; it opens the Runner page. */
function RunnerLine({ r }: { r: MaintainRunnerLine }) {
  const online = r.mine.filter((m) => m.online);
  const running = online.reduce((s, m) => s + m.running, 0);
  const [dot, text, action]: [string, string, string | null] = online.length
    ? ["bg-ok", online.length === 1 ? t("Your Task Runner: {name} online, {calls}", { name: online[0]!.name, calls: calls(running) }) : t("{n} Task Runners online, {calls}", { n: online.length, calls: calls(running) }), null]
    : r.mine.length
      ? ["bg-warn", r.mine.length === 1 ? t("Your Task Runner {name} is offline · {others}", { name: r.mine[0]!.name, others: others(r.others) }) : t("Your Task Runners are offline · {others}", { others: others(r.others) }), null]
      : r.others
        ? ["bg-warn", t("0 Task Runners connected · {others}", { others: others(r.others) }), t("Set up a Task Runner")]
        : ["bg-bad", t("0 Task Runners connected"), t("Set up a Task Runner")];
  return (
    <Link to="/runner" className="flex min-h-11 items-center gap-2.5 rounded-xl border border-line bg-raised px-3.5 py-2.5 text-sm hover:bg-ink/[0.04]">
      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", dot)} />
      <span className="min-w-0 flex-1">
        {text}
        {action && <span className="font-semibold text-accent-ink"> · {action}</span>}
      </span>
      <CaretRightIcon aria-hidden className="shrink-0 text-ink/60" />
    </Link>
  );
}

const OWN_SHOWN = 8;

/** One of the reader's items: the item, the conversation's last line, and a dot when that line is a question to the reader. */
function OwnRow({ r }: { r: MaintainRow }) {
  const ask = !!r.last?.question;
  const by = r.last?.by ?? "AutoCraft";
  return (
    <li className="relative flex items-start gap-2.5 py-3 pl-2.5 pr-3 transition-colors duration-fast hover:bg-ink/[0.03]">
      <span aria-hidden className={cn("mt-[6px] size-2 shrink-0 rounded-full", ask ? "bg-accent" : "bg-transparent")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <ItemRef repo={r.repo} number={r.number} kind={r.kind} state={r.state ?? "open"} title={r.title} stretch github={false} className="min-w-0 flex-1 font-medium" />
          <time dateTime={r.updatedAt} className="num mt-0.5 shrink-0 whitespace-nowrap text-xs text-ink/70">{messageTime(r.updatedAt)}</time>
          <GithubButton href={githubItemUrl(r.repo, r.number, r.kind)} label={t("Open {ref} on GitHub", { ref: `${r.repo}#${r.number}` })} className="mt-[calc((1lh-1.75rem)/2)]" />
        </div>
        <p className={cn("mt-1 line-clamp-2 pl-6 text-sm", ask ? "font-medium text-accent-ink" : "text-ink/70")}>
          {ask && <span className="sr-only">{t("Question for you:")} </span>}
          <span className={ask ? undefined : "text-ink"}>{by === "AutoCraft" ? "AutoCraft" : `@${by}`}</span>: {r.last?.text ?? r.line}
        </p>
      </div>
    </li>
  );
}

function OwnItems({ rows, total }: { rows: MaintainRow[]; total: number }) {
  const title = t("My items");
  return (
    <section aria-labelledby="home-own" className="flex flex-col gap-1">
      <h2 id="home-own" className="mb-1 mt-4 text-md font-semibold">
        {title}
      </h2>
      {rows.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-raised">
          {rows.slice(0, OWN_SHOWN).map((r) => (
            <OwnRow key={`${r.repo}#${r.number}`} r={r} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-line px-3 py-3 text-sm text-ink/70">{t("Nothing started or approved by you.")}</p>
      )}
      {total > rows.length && <Link to="/items?filter=mine" className="mt-1 inline-flex min-h-11 w-fit items-center gap-1 self-center rounded px-3 text-sm font-medium text-accent-ink hover:underline">
        {t("Show more")} <CaretRightIcon aria-hidden />
      </Link>}
    </section>
  );
}

function List({ title, rows }: { title: string; rows: MaintainRow[] }) {
  if (!rows.length) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <h2 className="mt-2 text-sm font-semibold text-ink/70">{title}</h2>
      <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
        {rows.map((r) => (
          <li key={`${r.repo}#${r.number}`} className="relative px-3 py-2.5 hover:bg-ink/[0.025]">
            <ItemRef repo={r.repo} number={r.number} kind={r.kind} state="open" title={r.title} stretch />
            <p className="mt-0.5 pl-6 text-sm text-ink/70">{r.line}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The row's action, through the same registered control or endpoint its page uses; `onDone` gets the result line. */
function ProblemAction({ a, title, onDone }: { a: HomeAction; title: string; onDone: (line: string) => void }) {
  const api = useApi();
  const write = useWrite();
  const run = () => void write.run("go", async () => {
    switch (a.kind) {
      case "resume-breaker": {
        const r = await api.controls.run({ control: "resume-breaker", key: a.key });
        if (!r.ok) throw new Error(r.line);
        return onDone(r.line);
      }
      case "release-author": {
        const r = await api.pipeline.releaseAuthor(a.author);
        return onDone(r.released === 1 ? t("Released 1 item of {author}.", { author: a.author }) : t("Released {n} items of {author}.", { n: r.released, author: a.author }));
      }
      case "ack-deadline":
        await api.pipeline.ackDeadline(a.step);
        return onDone(t("Acknowledged: {title}", { title }));
      default:
        await api.githubApp.ackForeignInstalls();
        return onDone(t("Acknowledged: {title}", { title }));
    }
  });
  const busy = write.busy === "go";
  const label = a.kind === "resume-breaker" ? t("Resume") : t("Acknowledge");
  return (
    <div className="relative z-10 flex shrink-0 flex-col items-end gap-1">
      {a.kind === "release-author"
        ? <ConfirmButton idle="secondary" label={t("Release")} confirmLabel={t("Release for {author}", { author: a.author })} target={title} loading={busy} onConfirm={run} />
        : <Button size="sm" loading={busy} onClick={run} aria-label={`${label} ${title}`} className="max-md:h-11">{label}</Button>}
      <ErrorLine error={write.error} className="max-w-[16rem] text-right text-2xs" />
    </div>
  );
}

/** Problems: stopped steps, held authors, failing checks, fixes that gave up. Each opens what it names; its action sits beside it. */
function Attention({ rows }: { rows: HomeProblem[] }) {
  const [said, setSaid] = useState("");
  const list = useRef<HTMLUListElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // The region stays when the last row goes, so its result is still read out.
  const region = <p aria-live="polite" className="sr-only">{said}</p>;
  if (!rows.length) return <>{region}</>;
  const title = t("Needs attention");
  // After an action the result is announced and focus moves to the next row's link, or to the heading after the last row.
  const done = (i: number) => (line: string) => {
    setSaid(line);
    const next = list.current?.querySelectorAll<HTMLAnchorElement>(":scope > li > div > a")[i + 1];
    (next ?? heading.current)?.focus();
  };
  return (
    <>
    {region}
    <section aria-label={title} className="flex flex-col gap-1">
      <h2 ref={heading} tabIndex={-1} className="mt-2 text-sm font-semibold text-ink/70 outline-none">
        {title} <span className="num font-normal">({rows.length})</span>
      </h2>
      <ul ref={list} className="divide-y divide-line rounded-lg border border-line bg-panel">
        {rows.map((p, i) => (
          <li key={`${p.kind}${p.to}${p.title}`} className="relative flex items-start gap-3 px-3 py-3 hover:bg-ink/[0.025]">
            {p.kind === "stopped" ? <XCircleIcon weight="fill" aria-label={t("Stopped")} className="mt-[3px] shrink-0 text-bad" /> : <WarningCircleIcon weight="fill" aria-label={t("Warning")} className="mt-[3px] shrink-0 text-warn" />}
            <div className="min-w-0 flex-1">
              <Link to={p.to} className="text-sm font-medium after:absolute after:inset-0 hover:underline">
                {p.title}
              </Link>
              {p.detail && <div className="mt-0.5 text-xs text-ink/70">{p.detail}</div>}
            </div>
            {p.action ? <ProblemAction a={p.action} title={p.title} onDone={done(i)} /> : <CaretRightIcon aria-hidden className="mt-1 shrink-0 text-ink/50" />}
          </li>
        ))}
      </ul>
    </section>
    </>
  );
}

export function HomeView(_: ViewProps) {
  const user = useUser();
  const { data, error } = useQuery("maintain-home", (a) => a.maintain.home());
  if (!data) return <Pending error={error} />;
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[784px] flex-col gap-3 px-4 pb-12 pt-5 md:px-8 md:pt-8">
        <h1 className="text-xl font-semibold tracking-[-0.01em] md:text-2xl">{t("Home")}</h1>
        {data.runner && <RunnerLine r={data.runner} />}
        <Attention rows={data.attention} />
        {user.role === "viewer" ? <List title={t("Recently updated")} rows={data.recent} /> : <OwnItems rows={data.mine} total={data.mineTotal} />}
      </div>
    </div>
  );
}
