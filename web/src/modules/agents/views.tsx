// The Agents page: one list of model calls in three parts, Running, Waiting (the queued calls with why each waits) and Finished
// (newest first, keyset-paged), narrowed by the filters in the URL (runner, person, repo, step, state), and a detail panel with the
// rendered prompt and the output. Operators and maintainers also filter the calls a model's safety filter refused, with their
// counts per prompt, repo, model and Task Runner user.
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dialog as Sheet } from "radix-ui";
import { CaretDownIcon, CaretRightIcon, FunnelIcon, XIcon } from "@phosphor-icons/react";
import { useApi, usePagedQuery, useQuery } from "../../api/client";
import type { AgentRun, AgentRunDetail, AgentRunFilter, AgentRunRefusal, AgentRunState, ModelQueue, ModelQueueFilter, RefusalGroup, RefusalWindow } from "../../api/types";
import { t } from "../../../../src/i18n/index.ts";
import { useUser } from "../../shell/UserContext";
import { can } from "../../registry/permissions";
import { Chip } from "../../ui/atoms/Chip";
import { Segmented } from "../../ui/molecules/Segmented";
import type { ViewProps } from "../../registry/types";
import { nowMs, num, span } from "../../lib/format";
import { formatCost } from "../../lib/trace";
import { useUrlState, useWrite } from "../../lib/hooks";
import { TimeAgo } from "../../ui/atoms/TimeAgo";
import { useNow } from "../../lib/useNow";
import { Badge, type Tone } from "../../ui/atoms/Badge";
import { Button } from "../../ui/atoms/Button";
import { EmptyState } from "../../ui/atoms/EmptyState";
import { ErrorLine } from "../../ui/atoms/ErrorLine";
import { Block } from "../../ui/molecules/Block";
import { Dialog } from "../../ui/molecules/Dialog";
import { QuickSelect } from "../../ui/molecules/QuickSelect";
import { RemoteVia } from "../../ui/molecules/RemoteVia";
import { ItemRef } from "../../ui/molecules/ItemRef";
import { Page } from "../../ui/organisms/Page";
import { QueuedCallRow } from "../../ui/organisms/QueuedCallRow";
import { cn } from "../../ui/cn";
import { TranscriptLinks } from "./transcript";

const STATE_TONE: Record<AgentRunState, Tone> = { running: "accent", done: "ok", failed: "bad" };
const STATE_LABEL: Record<AgentRunState, string> = { running: "Running", done: "Done", failed: "Failed" };

const tokensOf = (r: AgentRun) => (r.inputTokens === null && r.outputTokens === null ? null : (r.inputTokens ?? 0) + (r.outputTokens ?? 0));
const elapsed = (r: AgentRun) => span((r.endedAt ? Date.parse(r.endedAt) : nowMs()) - Date.parse(r.startedAt));

/** The items a run works on, with "+N more" past the ones the API lists. */
function Items({ r, max = 3, expandable }: { r: AgentRun; max?: number; expandable?: boolean }) {
  const [all, setAll] = useState(false);
  if (expandable) max = all ? r.items.length : max;
  const shown = r.items.slice(0, max);
  const more = r.itemCount - shown.length;
  return (
    <span className="flex flex-col items-start gap-0.5">
      {shown.map((i) => (
        <ItemRef key={`${i.repo}#${i.number}`} repo={i.repo} number={i.number} kind={i.kind} state={i.state} title={i.title} size="sm" className="relative z-10 w-fit max-w-full" />
      ))}
      {more > 0 &&
        (expandable && !all && r.items.length > shown.length ? (
          <button onClick={() => setAll(true)} className="relative z-10 text-xs text-accent-ink hover:underline max-md:min-h-11">
            {t("+{n} more", { n: num(more) })}
          </button>
        ) : (
          <span className="text-xs text-ink/50">{t("+{n} more", { n: num(more) })}</span>
        ))}
    </span>
  );
}

const who = (r: AgentRun, compact?: boolean): ReactNode => (r.provider === "jev" ? "Jev" : r.via ? <RemoteVia via={r.via} compact={compact} /> : "–");

// ---- filters -------------------------------------------------------------------

/** `state` in the URL: one part of the list, or the finished calls that failed. */
type StateFilter = "running" | "waiting" | "finished" | "failed";
const STATES: { value: StateFilter; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "waiting", label: "Waiting" },
  { value: "finished", label: "Finished" },
  { value: "failed", label: "Failed" },
];

type Filters = { runner?: string; person?: string; repo?: string; step?: string; state?: StateFilter; refused: boolean; window?: RefusalWindow };

/** The page's filters as the URL holds them; runner, person and refused calls are for operators and maintainers. */
function useFilters(staff: boolean): Filters & { update: (p: Record<string, string | null>) => void } {
  const { state: f, update } = useUrlState();
  const state = STATES.some((s) => s.value === f.state) ? (f.state as StateFilter) : undefined;
  const refused = staff && f.refused === "1";
  return {
    ...(staff && f.runner && { runner: f.runner }), ...(staff && f.person && { person: f.person }), ...(f.repo && { repo: f.repo }), ...(f.step && { step: f.step }),
    ...(state && { state }), refused, ...(refused && { window: (f.window as RefusalWindow | undefined) ?? "7d" }), update,
  };
}

/** A value in the URL that the lists lack still shows as picked. */
const options = (all: string, values: Iterable<string>, current: string | undefined): [string, string][] => {
  const vs = [...new Set([...values, ...(current ? [current] : [])])].sort((a, b) => a.localeCompare(b));
  return [["", all], ...vs.map((v): [string, string] => [v, v])];
};

function FilterSelects({ f, seen, staff }: { f: ReturnType<typeof useFilters>; seen: { runners: string[]; people: string[]; steps: string[] }; staff: boolean }) {
  const repos = useQuery("agents-repos", (a) => a.repos());
  const set = (key: string) => (v: string) => f.update({ [key]: v || null });
  return (
    <>
      {staff && <QuickSelect label={t("Task Runner")} prefix value={f.runner ?? ""} onChange={set("runner")} options={options(t("Any Task Runner"), seen.runners, f.runner)} />}
      {staff && <QuickSelect label={t("Person")} prefix value={f.person ?? ""} onChange={set("person")} options={options(t("Anyone"), seen.people, f.person)} />}
      <QuickSelect label={t("Repository")} value={f.repo ?? ""} onChange={set("repo")} options={options(t("All repositories"), repos.data ?? [], f.repo)} />
      <QuickSelect label={t("Step")} prefix value={f.step ?? ""} onChange={set("step")} options={options(t("Any step"), seen.steps, f.step)} />
    </>
  );
}

const WINDOWS: RefusalWindow[] = ["24h", "7d", "30d"];
const WINDOW_LABEL: Record<RefusalWindow, string> = { "24h": "24 hours", "7d": "7 days", "30d": "30 days" };

// ---- refused calls -------------------------------------------------------------

function GroupTable({ title, rows, code }: { title: string; rows: RefusalGroup[]; code?: boolean }) {
  const shown = rows.slice(0, 8);
  return (
    <table className="num w-full text-sm">
      <caption className="pb-1 text-left text-xs font-semibold text-ink/65">{title}</caption>
      <thead className="text-xs text-ink/55">
        <tr>
          <th scope="col" className="sr-only">{title}</th>
          <th scope="col" className="h-7 w-16 px-2 text-right font-medium">{t("Refused")}</th>
          <th scope="col" className="h-7 w-16 px-2 text-right font-medium">{t("Failed")}</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((g) => (
          <tr key={String(g.key)} className="border-t border-line">
            <th scope="row" className={cn("max-w-0 truncate py-1 pr-2 text-left font-normal", code && g.key !== null && "code text-xs")} title={g.key ?? undefined}>
              {g.key ?? <span className="text-ink/50">{t("none")}</span>}
            </th>
            <td className="px-2 text-right">{num(g.n)}</td>
            <td className={cn("px-2 text-right", g.failed > 0 ? "text-bad" : "text-ink/50")}>{num(g.failed)}</td>
          </tr>
        ))}
        {rows.length > shown.length && (
          <tr className="border-t border-line">
            <td colSpan={3} className="py-1 text-xs text-ink/50">{t("{n} more", { n: num(rows.length - shown.length) })}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Counts of the refused calls in the range, so a cause they share stands out. */
function RefusalCounts({ window }: { window: RefusalWindow }) {
  const q = useQuery(`agents-refusals:${window}`, (a) => a.agents.refusals(window));
  const b = q.data;
  return (
    <div className="border-b border-line px-4 py-3">
      <ErrorLine error={q.error?.message} />
      {b && (
        <>
          <p className="num text-sm" aria-live="polite">
            {t("{n} refused in the last {range}", { n: num(b.total), range: t(WINDOW_LABEL[window]) })}
            {b.failed > 0 && <span className="text-bad"> · {t("{n} with no other Task Runner or tier", { n: num(b.failed) })}</span>}
            {b.capped && <span className="text-ink/55"> · {t("counts cover the newest {n}", { n: num(b.total) })}</span>}
          </p>
          {b.total > 0 && (
            <div className="mt-3 grid items-start gap-x-6 gap-y-4 md:grid-cols-2">
              <GroupTable title={t("Prompt")} rows={b.byPrompt} code />
              <GroupTable title={t("Repo")} rows={b.byRepo} />
              <GroupTable title={t("Model")} rows={b.byModel} />
              <GroupTable title={t("Task Runner user")} rows={b.byLogin} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** What became of a refused call: its retry's state (linked to that run), or that nothing else could take it. */
function RetryOutcome({ refusal }: { refusal: AgentRunRefusal }) {
  if (refusal.outcome === "failed") return <Badge tone="bad">{t("Not retried")}</Badge>;
  if (!refusal.retry) return <span className="text-xs text-ink/55">{t("Retried")}</span>;
  return (
    <Link to={`/agents/${refusal.retry.id}${location.search}`} className="relative z-10 inline-flex items-center max-md:min-h-11">
      <Badge tone={STATE_TONE[refusal.retry.state]}>{t(STATE_LABEL[refusal.retry.state])}</Badge>
      <span className="sr-only"> ({t("retry, run {id}", { id: refusal.retry.id })})</span>
    </Link>
  );
}

// ---- the three parts ---------------------------------------------------------

/** A run's row: its step links to the detail panel; its items, and the other controls, sit above that link. */
function RunRow({ r, selected, children, meta }: { r: AgentRun; selected: boolean; children?: ReactNode; meta: ReactNode }) {
  return (
    <li className={cn("relative border-t border-line px-4 py-2.5 first:border-t-0 hover:bg-ink/[0.03]", selected && "bg-accent/10")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {r.state !== "running" && <Badge tone={STATE_TONE[r.state]}>{t(STATE_LABEL[r.state])}</Badge>}
        <Link to={`/agents/${r.id}${location.search}`} aria-current={selected || undefined} className="code text-sm font-medium after:absolute after:inset-0">
          {r.step}
        </Link>
        <Badge tone="accent">{r.model}</Badge>
        <span className="relative z-10 min-w-0">{who(r, true)}</span>
        <span className="num relative z-10 ml-auto text-xs text-ink/70">{meta}</span>
      </div>
      <div className="mt-1">
        <Items r={r} max={2} />
      </div>
      {children}
    </li>
  );
}

function Running({ rows, error, loaded, selected }: { rows: AgentRun[]; error?: string; loaded: boolean; selected?: number }) {
  useNow(rows.length ? 1000 : undefined);
  return (
    <Block flush title={<>{t("Running")} {loaded && <span className="num ml-1 font-normal text-ink/50">{rows.length}</span>}</>}>
      <ErrorLine error={error} className="p-4" />
      {loaded && rows.length === 0 && <EmptyState>{t("No agent is running.")}</EmptyState>}
      <ul>
        {rows.map((r) => (
          <RunRow key={r.id} r={r} selected={selected === r.id} meta={<>{elapsed(r)} · {tokensOf(r) === null ? "–" : t("{n} tok", { n: num(tokensOf(r)!) })}</>}>
            {r.progress && <p className="mt-1 text-xs text-ink/55 [overflow-wrap:anywhere]">{r.progress}</p>}
          </RunRow>
        ))}
      </ul>
    </Block>
  );
}

function Waiting({ q, user }: { q: { data?: ModelQueue; error?: { message: string } }; user: ViewProps["user"] }) {
  const api = useApi();
  const write = useWrite();
  // Waits keep counting between refetches, from the moment this reply arrived.
  const base = useMemo(() => nowMs(), [q.data]);
  const now = useNow(q.data?.calls.length ? 30_000 : undefined);
  const d = q.data;
  return (
    <Block
      flush
      title={<>{t("Waiting")} {d && <span className="num ml-1 font-normal text-ink/50">{d.calls.length}</span>}</>}
      aside={d && user.role !== "viewer" && (d.me.canPick || d.me.picks > 0) ? <span className="num">{t("My picks {n}/{max}", { n: d.me.picks, max: d.me.pickMax })}</span> : undefined}
    >
      <ErrorLine error={q.error?.message ?? write.error} className="px-4 pt-3" />
      {d && !d.calls.length && <EmptyState>{t("No model call is waiting.")}</EmptyState>}
      <ul>
        {d?.calls.map((c) => (
          <QueuedCallRow key={c.id} c={c} user={user} waited={c.waitedMs + Math.max(0, now - base)} busy={write.busy}
            onPick={() => void write.run(`pick:${c.id}`, () => api.modelQueue.pick(c.id))} onUnpick={() => void write.run(`unpick:${c.id}`, () => api.modelQueue.unpick(c.id))} />
        ))}
      </ul>
    </Block>
  );
}

function Finished({ f, recent, selected }: { f: Filters; recent: ReturnType<typeof useRecent>; selected?: number }) {
  return (
    <Block flush title={t("Finished")} aside={t("newest first")}>
      {f.window && <RefusalCounts window={f.window} />}
      <ErrorLine error={recent.error} className="p-4" />
      <ul>
        {recent.rows.map((r) => (
          <RunRow key={r.id} r={r} selected={selected === r.id} meta={<>{formatCost(r.costUsd) ?? "–"} · {t("took {time}", { time: elapsed(r) })} · <TimeAgo iso={r.endedAt ?? r.startedAt} /></>}>
            {f.refused && r.refusal && (
              <div className="relative z-10 mt-1 flex items-center gap-1.5 text-xs text-ink/60">
                {t("Retry")} <RetryOutcome refusal={r.refusal} />
              </div>
            )}
          </RunRow>
        ))}
      </ul>
      {!recent.loading && recent.rows.length === 0 && <EmptyState>{f.refused ? t("No refused runs in this range.") : t("No runs match.")}</EmptyState>}
      {(recent.more || recent.loading) && (
        <div className="border-t border-line p-3">
          <Button size="sm" loading={recent.loading} disabled={!recent.more} onClick={recent.loadMore}>
            {t("Load more")}
          </Button>
        </div>
      )}
    </Block>
  );
}

function useRecent(filter: Omit<AgentRunFilter, "cursor">, on: boolean) {
  const q = usePagedQuery(`agents-recent:${on ? JSON.stringify(filter) : "off"}`, (api, cursor) => (on ? api.agents.list({ ...filter, cursor }) : Promise.resolve({ runs: [], nextCursor: null })), (p) => p.nextCursor);
  return { rows: q.pages?.flatMap((p) => p.runs) ?? [], loading: q.loading || q.loadingMore, error: q.error?.message, more: q.hasMore, loadMore: q.loadMore };
}

// ---- detail --------------------------------------------------------------------

function Collapsible({ title, text, empty, open: initial = false }: { title: string; text: string | null; empty: string; open?: boolean }) {
  const [open, setOpen] = useState(initial);
  const Icon = open ? CaretDownIcon : CaretRightIcon;
  return (
    <div>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-7 items-center gap-1 text-xs font-semibold text-ink/65 max-md:min-h-11">
        <Icon className="text-[13px]" />
        {title}
        {text !== null && <span className="num font-normal text-ink/45">{num(text.length)} characters</span>}
      </button>
      {open &&
        (text === null ? (
          <p className="mt-1 text-sm text-ink/55">{empty}</p>
        ) : (
          <pre className="code mt-1 max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded border border-line bg-sunken p-3 text-xs leading-relaxed">{text}</pre>
        ))}
    </div>
  );
}

export function RunDetailBody({ id }: { id: number }) {
  const q = useQuery<AgentRunDetail>(`agent-${id}`, (a) => a.agents.get(id));
  const r = q.data;
  useNow(r && !r.endedAt ? 1000 : undefined);
  if (!r) return <div className="p-4">{q.error ? <ErrorLine error={q.error.message} /> : <span className="text-sm text-ink/50">Loading.</span>}</div>;
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATE_TONE[r.state]}>{STATE_LABEL[r.state]}</Badge>
        <span className="code text-sm font-medium">{r.step}</span>
        <Badge tone="accent">{r.model}</Badge>
        <span className="text-sm text-ink/70">{who(r)}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink/55">Prompt</dt>
        <dd>
          <Link to={`/prompts#${r.promptId}`} className="code text-accent-ink hover:underline">
            {r.promptId}
          </Link>{" "}
          <span className="code text-xs text-ink/50">{r.promptVersion}</span>
        </dd>
        <dt className="text-ink/55">Started</dt>
        <dd className="num">
          <TimeAgo iso={r.startedAt} /> · {r.endedAt ? `took ${elapsed(r)}` : `running for ${elapsed(r)}`}
        </dd>
        <dt className="text-ink/55">Tokens</dt>
        <dd className="num">
          {r.inputTokens === null ? "–" : `${num(r.inputTokens)} in`} / {r.outputTokens === null ? "–" : `${num(r.outputTokens)} out`}
          {r.cacheReadTokens !== null && ` · cache ${num(r.cacheReadTokens)} read, ${num(r.cacheWriteTokens ?? 0)} written`}
        </dd>
        <dt className="text-ink/55">Job</dt>
        <dd>
          {r.jobId === null ? (
            "–"
          ) : (
            <Link to={`/pipeline/${r.jobId}`} className="num text-accent-ink hover:underline">
              Job {r.jobId}
            </Link>
          )}
        </dd>
        <dt className="text-ink/55">Items</dt>
        <dd>
          <Items r={r} max={8} expandable />
        </dd>
        {r.refusal && (
          <>
            <dt className="text-ink/55">{t("Refused")}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span>{r.refusal.outcome === "failed" ? t("by the model's safety filter; no other Task Runner or tier could take the call") : t("by the model's safety filter; retried")}</span>
              {r.refusal.retry && (
                <Link to={`/agents/${r.refusal.retry.id}${location.search}`} className="inline-flex items-center gap-1.5 text-accent-ink hover:underline max-md:min-h-11">
                  <span className="num">{t("Run {id}", { id: r.refusal.retry.id })}</span>
                  <Badge tone={STATE_TONE[r.refusal.retry.state]}>{t(STATE_LABEL[r.refusal.retry.state])}</Badge>
                </Link>
              )}
            </dd>
          </>
        )}
      </dl>
      {r.summary && <p className="rounded border border-line px-3 py-2 text-sm">{r.summary}</p>}
      {r.error && <p className="rounded border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">{r.error}</p>}
      {!r.textsHidden && (
        <>
          <Collapsible title="Prompt" text={r.prompt} empty="Prompt text removed after ten years." />
          <Collapsible title="Output" text={r.output} empty={r.state === "running" ? "Still running." : "Output removed after ten years."} open />
          <TranscriptLinks runId={r.id} transcripts={r.transcripts ?? []} off={!!r.transcriptsOff && !!r.via} />
        </>
      )}
    </div>
  );
}

export function DetailPanel({ params }: ViewProps) {
  const id = params.id ? Number(params.id) : null;
  const nav = useNavigate();
  if (id === null) return <div className="p-6 text-sm text-ink/50">Pick a run to see its prompt and output.</div>;
  return (
    <div className="h-full overflow-y-auto">
      <div className="flex h-10 items-center gap-2 border-b border-line px-4">
        <h2 className="num text-sm font-semibold">Run {id}</h2>
        <button onClick={() => nav(`/agents${location.search}`)} aria-label="Close" className="ml-auto text-ink/50 hover:text-ink">
          <XIcon />
        </button>
      </div>
      <RunDetailBody id={id} />
    </div>
  );
}

// ---- page ----------------------------------------------------------------------

export function AgentsView({ params, user }: ViewProps) {
  const id = params.id ? Number(params.id) : undefined;
  const staff = can(useUser(), "staff");
  const f = useFilters(staff);
  const [sheet, setSheet] = useState(false);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const show = (part: "running" | "waiting" | "finished") => (f.refused ? part === "finished" : !f.state || f.state === part || (part === "finished" && f.state === "failed"));
  const common = { ...(f.runner && { runner: f.runner }), ...(f.person && { person: f.person }), ...(f.repo && { repo: f.repo }), ...(f.step && { step: f.step }) };
  const running = useQuery(`agents-running:${JSON.stringify(common)}`, (a) => a.agents.list({ state: "running", ...common, limit: 100 }), { enabled: show("running") });
  const wf: ModelQueueFilter = common;
  const waiting = useQuery(`model-queue:${JSON.stringify(wf)}`, (a) => a.modelQueue.get(wf), { enabled: show("waiting") });
  const recent = useRecent({ state: f.state === "failed" ? "failed" : "finished", ...common, limit: 50, ...(f.refused && { refused: true, window: f.window }) }, show("finished"));
  const mine = useQuery("runners", (a) => a.runners.list(), { enabled: staff });
  const runs = [...(running.data?.runs ?? []), ...recent.rows];
  // The filters offer what the lists have shown since the page opened, so narrowing one filter keeps the others' choices.
  const seenRef = useRef({ runners: new Set<string>(), people: new Set<string>([user.login]), steps: new Set<string>() });
  const add = (set: Set<string>, vs: (string | undefined)[]) => vs.forEach((v) => v && set.add(v));
  add(seenRef.current.runners, [...(mine.data?.runners ?? []).map((r) => r.label ?? undefined), ...runs.map((r) => r.via?.runner)]);
  add(seenRef.current.people, [...runs.map((r) => r.via?.login), ...(waiting.data?.calls ?? []).map((c) => c.picked?.login)]);
  add(seenRef.current.steps, [...runs.map((r) => r.step), ...(waiting.data?.calls ?? []).map((c) => c.step)]);
  const seen = { runners: [...seenRef.current.runners], people: [...seenRef.current.people], steps: [...seenRef.current.steps] };
  const narrowed = [f.runner, f.person, f.repo, f.step].filter(Boolean).length;
  const setState = (s: StateFilter | null) => f.update({ state: s, refused: null, window: null });
  return (
    <Page title={t("Agents")}>
      <div className="mt-3 flex items-start gap-2">
        <div className="-ml-4 flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 pl-4 md:ml-0 md:flex-wrap md:pl-0" role="group" aria-label={t("State")}>
          <Chip active={!f.state && !f.refused} onClick={() => setState(null)} className="shrink-0 max-md:h-11">{t("All")}</Chip>
          {STATES.map((s) => (
            <Chip key={s.value} active={f.state === s.value && !f.refused} onClick={() => setState(s.value)} className="shrink-0 max-md:h-11"
              count={s.value === "running" && running.data && show("running") ? num(running.data.runs.length) : s.value === "waiting" && waiting.data && show("waiting") ? num(waiting.data.calls.length) : undefined}>
              {t(s.label)}
            </Chip>
          ))}
          {staff && (
            <Chip active={f.refused} onClick={() => f.update({ refused: f.refused ? null : "1", window: null, state: null })} className="shrink-0 max-md:h-11">
              {t("Refused")}
            </Chip>
          )}
        </div>
        <Button ref={filtersButton} icon={FunnelIcon} onClick={() => setSheet(true)} className="h-11 shrink-0 md:hidden" aria-haspopup="dialog">
          {narrowed ? t("Filters ({n})", { n: narrowed }) : t("Filters")}
        </Button>
      </div>
      <div className="mt-2 hidden flex-wrap gap-2 md:flex" role="group" aria-label={t("Filters")}>
        <FilterSelects f={f} seen={seen} staff={staff} />
      </div>
      <Dialog open={sheet} onClose={() => setSheet(false)} title={t("Filters")} variant="side" returnFocusRef={filtersButton}>
        <div className="flex flex-col gap-3">
          <FilterSelects f={f} seen={seen} staff={staff} />
        </div>
        <Button variant="primary" className="mt-4 h-11 w-full" onClick={() => setSheet(false)}>
          {t("Done")}
        </Button>
      </Dialog>
      {f.refused && (
        <Segmented
          label={t("Time range")}
          value={f.window ?? "7d"}
          options={WINDOWS.map((w) => ({ value: w, label: t(WINDOW_LABEL[w]) }))}
          onChange={(w) => f.update({ window: w === "7d" ? null : w })}
          className="mt-3"
        />
      )}
      <div className="mt-4 space-y-4">
        {show("running") && <Running rows={running.data?.runs ?? []} error={running.error?.message} loaded={!!running.data} selected={id} />}
        {show("waiting") && <Waiting q={waiting} user={user} />}
        {show("finished") && <Finished f={f} recent={recent} selected={id} />}
      </div>
    </Page>
  );
}

export function PhoneAgents(props: ViewProps) {
  const nav = useNavigate();
  const id = props.params.id ? Number(props.params.id) : null;
  return (
    <>
      <AgentsView {...props} />
      <Sheet.Root open={id !== null} onOpenChange={(o) => !o && nav(`/agents${location.search}`)}>
        <Sheet.Portal>
          <Sheet.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Sheet.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-lg border-t border-line bg-panel" aria-describedby={undefined}>
            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
              <Sheet.Title className="num text-sm font-semibold">{t("Run {id}", { id: id ?? "" })}</Sheet.Title>
              <Sheet.Close aria-label={t("Close")} className="ml-auto flex size-11 items-center justify-center text-ink/60">
                <XIcon />
              </Sheet.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{id !== null && <RunDetailBody id={id} />}</div>
          </Sheet.Content>
        </Sheet.Portal>
      </Sheet.Root>
    </>
  );
}
