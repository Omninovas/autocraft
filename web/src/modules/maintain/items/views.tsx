// Items: a browser over every item of the visible repos. One search box takes words and qualifiers (src/core/item-query.ts),
// kept in the URL as `q`; a paste that names items becomes an `items:` term. The views row sets the whole query, the Filters panel
// changes one qualifier each, and the active qualifiers show as removable chips. The server filters, sorts and pages. On desktop a
// row click opens the item beside the list (`open=<repo>/<n>`). People who may send commands tick items, which brings up the
// command bar at the bottom; the ticks are the command's items, kept across pages and searches, and the bar takes only the
// command's words. The command runs for each item on its own.
import { useEffect, useId, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent, type ReactNode, type Ref, type RefObject } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CaretDownIcon, ChatCircleIcon, CheckCircleIcon, CircleDashedIcon, DiscordLogoIcon, FunnelIcon, GitPullRequestIcon, RadioButtonIcon, UsersThreeIcon, XCircleIcon, XIcon } from "@phosphor-icons/react";
import { t } from "../../../../../src/i18n/index.ts";
import {
  AUTOCRAFT_STATES, DEFAULT_QUERY, itemOfValue, itemsTerm, KINDS, PRESETS, PRIORITIES, parseItemQuery, presetOf, splitWords, termValues, tokens, withTerm,
  type QueryKey, type QueryTerm,
} from "../../../../../src/core/item-query.ts";
import { itemsIn, listForm, parse } from "../../../../../src/workflow/parse.ts";
import { useApi, useQuery } from "../../../api/client";
import { usePageProject } from "../../../api/scope";
import type { BrowseAutocraft, BrowseRow, MaintainCommandResult } from "../../../api/types";
import { githubItemUrl, itemPath } from "../../../lib/links";
import { num } from "../../../lib/format";
import { useUser } from "../../../shell/UserContext";
import { useIsPhone } from "../../../shell/useMedia";
import { Badge, type Tone } from "../../../ui/atoms/Badge";
import { Button } from "../../../ui/atoms/Button";
import { Chip } from "../../../ui/atoms/Chip";
import { GithubButton } from "../../../ui/atoms/GithubButton";
import { Input } from "../../../ui/atoms/Input";
import { LabelPill } from "../../../ui/atoms/LabelPill";
import { Pending } from "../../../ui/atoms/Pending";
import { Select } from "../../../ui/atoms/Select";
import { TimeAgo } from "../../../ui/atoms/TimeAgo";
import { ItemRef } from "../../../ui/molecules/ItemRef";
import { Pager } from "../../../ui/molecules/Pager";
import { SearchField } from "../../../ui/molecules/SearchField";
import { Segmented } from "../../../ui/molecules/Segmented";
import { cn } from "../../../ui/cn";
import type { ViewProps } from "../../../registry/types";
import { OPEN_PARAM, openItemAttrs, parseOpenItem, useOpenItem } from "./openItem";

const PAGE = 50;
/** Items in one command, as the server takes them (src/dash/api/commands.ts). */
const ITEMS_MAX = 100;
/** Labels a phone row shows before "+n". */
const PHONE_LABELS = 2;
const refOf = (r: { repo: string; number: number }) => `${r.repo}#${r.number}`;
/** Parameters from before the search box; a new query drops them. */
const LEGACY = ["filter", "show", "discord", "area", "sort"];

/** Links from before the search box (`filter=`, `show=`, `discord=1`, `area=`) as a query; null when the URL has none of them. */
function legacyQuery(p: URLSearchParams): string | null {
  const show = p.get("show");
  const parts = [show === "closed" ? "is:closed" : show === "merged" ? "is:merged" : show === "backlog" ? "autocraft:backlog" : "is:open"];
  const flags: Record<string, string> = { mine: "is:mine", outside: "is:outside-held", duplicates: "is:duplicate", security: "is:security", stuck: "is:stuck" };
  for (const f of (p.get("filter") ?? "").split(",")) if (flags[f]) parts.push(flags[f]!);
  if (p.get("discord") === "1") parts.push("discord:mentioned");
  if (p.get("area")) parts.push(`area:${p.get("area")}`);
  if (p.get("sort") === "priority") parts.push("sort:priority");
  // `is:mine` lists done items too, as Home's own items do.
  if (parts.includes("is:mine") && !show) parts.shift();
  return parts.length > 1 || show || parts[0] === "is:mine" ? parts.join(" ") : null;
}

/** Search parameters as text, with `:`, `,` and `/` left readable: `?q=is:open+label:bug&open=photocraft/12`. */
const readable = (p: URLSearchParams) => p.toString().replace(/%3A/gi, ":").replace(/%2C/gi, ",").replace(/%2F/gi, "/");

/** The query, page and opened item in the URL. Other parameters (`repo`, `open`) stay. */
function useBrowseUrl() {
  const loc = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const q = params.get("q") ?? legacyQuery(params) ?? DEFAULT_QUERY;
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const meaning = params.get("by") === "meaning";
  const write = (next: URLSearchParams) => {
    const search = readable(next);
    navigate({ pathname: loc.pathname, search: search ? `?${search}` : "" });
  };
  const go = (next: { q?: string; offset?: number; meaning?: boolean }) => {
    const nq = (next.q ?? q).trim();
    const nm = next.meaning ?? meaning;
    const no = (next.q !== undefined && nq !== q) || nm !== meaning ? 0 : next.offset ?? offset;
    const p = new URLSearchParams(loc.search);
    for (const k of ["q", "by", "offset", ...LEGACY]) p.delete(k);
    if (nq !== DEFAULT_QUERY) p.set("q", nq);
    if (nm) p.set("by", "meaning");
    if (no) p.set("offset", String(no));
    write(p);
  };
  return { q, offset, meaning, opened: parseOpenItem(params.get(OPEN_PARAM)), go };
}

const AUTOCRAFT_WORD: Record<BrowseAutocraft, { label: string; tone: Tone } | null> = {
  running: { label: "Working", tone: "accent" },
  waiting: { label: "Waiting", tone: "warn" },
  stopped: { label: "Stopped by the rule", tone: "neutral" },
  held: { label: "Held", tone: "neutral" },
  backlog: { label: "Backlog", tone: "neutral" },
  done: { label: "Done", tone: "ok" },
  none: null,
};
const AUTOCRAFT_TITLE: Record<BrowseAutocraft, string> = {
  running: "AutoCraft is working on it", waiting: "AutoCraft waits for a person", stopped: "Stopped by the automatic merge rule; a maintainer's yes takes it over", held: "Held", backlog: "In the Backlog", done: "AutoCraft is done with it", none: "Not started",
};
const priorityTone = (p: string): Tone => (p === "P0" ? "bad" : p === "P1" ? "warn" : "neutral");

function Ci({ ci }: { ci: BrowseRow["ci"] }) {
  if (!ci) return null;
  const [Icon, cls, label] = ci === "green" ? [CheckCircleIcon, "text-ok", t("CI passed")] : ci === "red" ? [XCircleIcon, "text-bad", t("CI failed")] : [CircleDashedIcon, "text-warn", t("CI running")];
  return (
    <span role="img" aria-label={label} title={label} className={cn("relative z-10 inline-flex items-center", cls)}>
      <Icon weight="bold" />
    </span>
  );
}

/** A row's tick box: 44 px on phones, 32 px on desktop, above the row's stretched item link. */
function Tick({ id, label, checked, disabled, onChange, inputRef }: { id?: string; label: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void; inputRef?: Ref<HTMLInputElement> }) {
  return (
    <label className={cn("relative z-10 -my-2 -ml-2 flex size-11 shrink-0 items-center justify-center md:-my-1 md:size-8", !disabled && "cursor-pointer")}>
      <input id={id} ref={inputRef} type="checkbox" className="size-4 cursor-pointer accent-accent disabled:cursor-default" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
    </label>
  );
}

/** The list header's tick: every row of this page the reader may run commands on; mixed while only some are ticked. */
function SelectAll({ refs, picked, onPick, boxRef }: { refs: string[]; picked: ReadonlySet<string>; onPick: (refs: string[], on: boolean) => void; boxRef: RefObject<HTMLInputElement> }) {
  const id = useId();
  const on = refs.filter((r) => picked.has(r)).length;
  const all = refs.length > 0 && on === refs.length;
  useEffect(() => {
    if (boxRef.current) boxRef.current.indeterminate = on > 0 && !all;
  }, [on, all, boxRef]);
  return (
    <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-sm text-ink/80">
      <Tick id={id} inputRef={boxRef} label={t("Select all shown")} checked={all} disabled={!refs.length} onChange={() => onPick(refs, !all)} />
      <label htmlFor={id} className={cn(refs.length ? "cursor-pointer" : "opacity-50")}>
        {t("Select all shown")}
      </label>
    </div>
  );
}

/** Line 2 of a row: AutoCraft's state and markers, then size, CI, counts and the linked item, then the labels. */
function Facts({ r, children }: { r: BrowseRow; children?: ReactNode }) {
  const word = AUTOCRAFT_WORD[r.autocraft];
  const size = r.size ? t("Size {s}", { s: r.size }) : "";
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-6 text-xs text-ink/70">
      {r.asksYou && <Badge tone="accent">{t("Asks you")}</Badge>}
      {word && (
        <span title={t(AUTOCRAFT_TITLE[r.autocraft])} className="relative z-10">
          <Badge tone={word.tone}>{t(word.label)}</Badge>
        </span>
      )}
      {r.priority && <Badge tone={priorityTone(r.priority)}>{r.priority}</Badge>}
      {r.duplicate && <Badge tone="warn">{t("Duplicate")}</Badge>}
      {r.size && (
        <span role="img" aria-label={size} title={size} className="code relative z-10 inline-flex h-4 items-center rounded-sm border border-line-strong px-1 text-2xs text-ink/80">
          {r.size}
        </span>
      )}
      <Ci ci={r.ci} />
      {r.comments + r.reactions > 0 && (
        <span className="relative z-10 inline-flex items-center gap-1" title={t("{c} comments, {r} reactions", { c: r.comments, r: r.reactions })}>
          <ChatCircleIcon aria-hidden />
          <span className="num">{r.comments}</span>
          <span className="sr-only">{t("comments")}</span>
        </span>
      )}
      {r.discord > 0 && (
        <span className="relative z-10 inline-flex items-center gap-1" title={t("{n} mentions on Discord", { n: r.discord })}>
          <DiscordLogoIcon aria-hidden />
          <span className="num">{r.discord}</span>
          <span className="sr-only">{t("mentions on Discord")}</span>
        </span>
      )}
      {r.linked !== null && (
        <Link
          to={itemPath(r.repo, r.linked)}
          className="relative z-10 inline-flex items-center gap-0.5 hover:underline"
          aria-label={r.kind === "pr" ? t("Closes #{n}", { n: r.linked }) : t("Pull request #{n}", { n: r.linked })}
        >
          {r.kind === "pr" ? <RadioButtonIcon aria-hidden /> : <GitPullRequestIcon aria-hidden />}
          <span className="num">#{r.linked}</span>
        </Link>
      )}
      {r.labels.map((l, i) => (
        <LabelPill key={l} name={l} className={cn(i >= PHONE_LABELS && "max-md:hidden")} />
      ))}
      {r.labels.length > PHONE_LABELS && (
        <span className="md:hidden">
          +{r.labels.length - PHONE_LABELS}
          <span className="sr-only"> {t("labels")}</span>
        </span>
      )}
      {children}
    </div>
  );
}

/** The author, a team icon for authors on the team, and the time. */
function Who({ r, byCreated, className }: { r: BrowseRow; byCreated: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1 whitespace-nowrap", className)}>
      {r.author && <span className="max-w-[10rem] truncate">{r.author}</span>}
      {r.team && (
        <span role="img" aria-label={t("On the team")} title={t("On the team")} className="relative z-10 inline-flex text-accent-ink">
          <UsersThreeIcon weight="bold" />
        </span>
      )}
      {r.author && <span aria-hidden>·</span>}
      {byCreated && <span>{t("opened")}</span>}
      <TimeAgo iso={byCreated ? r.createdAt : r.updatedAt} className="relative z-10" />
    </span>
  );
}

function Row({ r, opened, byCreated, picking, picked, may, onPick, onOpen }: {
  r: BrowseRow; opened: boolean; byCreated: boolean; picking: boolean; picked: boolean; may: boolean; onPick: (on: boolean) => void; onOpen: ((keyboard: boolean) => void) | null;
}) {
  // On desktop the row itself takes the focus: a click on it, away from its links and tick box, or Enter on it opens the item
  // beside the list. On phones the item link covers the row.
  const click = (e: MouseEvent<HTMLLIElement>) => {
    if (!onOpen || (e.target as HTMLElement).closest("a, button, input, label, select, textarea") || window.getSelection()?.toString()) return;
    onOpen(false);
  };
  const key = (e: KeyboardEvent<HTMLLIElement>) => {
    if (!onOpen || e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    onOpen(true);
  };
  return (
    <li
      className={cn(
        "relative flex items-start gap-2 px-3 py-2 hover:bg-ink/[0.025] md:py-1.5",
        onOpen && "cursor-pointer outline-offset-[-2px]",
        opened && "bg-accent/[0.08] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent hover:bg-accent/[0.1]",
      )}
      aria-current={opened ? "true" : undefined}
      data-row={refOf(r)}
      onClick={click}
      {...(onOpen && { tabIndex: 0, "aria-label": `${refOf(r)} ${r.title}`, onKeyDown: key, ...openItemAttrs(r.repo, r.number) })}
    >
      {picking && <Tick label={t("Select {ref}", { ref: refOf(r) })} checked={picked} disabled={!may} onChange={onPick} />}
      <div className="min-w-0 flex-1">
        <ItemRef repo={r.repo} number={r.number} kind={r.kind} state={r.state} draft={r.draft} title={r.title} github={false} stretch="phone" />
        {/* On phones the author and time end line 2, so the title keeps the row's width. */}
        <Facts r={r}>
          <Who r={r} byCreated={byCreated} className="ml-auto md:hidden" />
        </Facts>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5 text-xs text-ink/70">
        <GithubButton href={githubItemUrl(r.repo, r.number, r.kind)} label={t("Open {ref} on GitHub", { ref: refOf(r) })} />
        <Who r={r} byCreated={byCreated} className="max-md:hidden" />
      </div>
    </li>
  );
}

const SORT_OPTIONS: [string, string][] = [
  ["updated", "Recently updated"], ["created", "Newest"], ["created-asc", "Oldest"], ["comments", "Most discussed"], ["priority", "Priority"], ["discord", "Discord mentions"],
];

/** A filter control: its visible label above a select. */
function FilterField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-ink/70">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="w-full">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** The Filters panel's controls over the query's qualifiers; each change rewrites one qualifier of `q`. */
function FilterControls({ q, set, facets, repos, meaning }: { q: string; set: (q: string) => void; facets: { labels: string[]; authors: string[]; areas: string[] } | null; repos: string[] | null; meaning: boolean }) {
  const one = (key: QueryKey) => termValues(q, key)[0] ?? "";
  const setOne = (key: QueryKey) => (v: string) => set(withTerm(q, key, v ? [v] : []));
  const parsed = parseItemQuery(q);
  const sort = `${parsed.sort.by}${parsed.sort.asc ? "-asc" : ""}`;
  // A value typed in the box that the lists do not hold still shows as picked.
  const withCurrent = (vs: string[], cur: string) => (cur && !vs.includes(cur) ? [cur, ...vs] : vs);
  const pairs = (vs: string[]) => vs.map((v): [string, string] => [v, v]);
  const any: [string, string] = ["", t("Any")];
  const states = termValues(q, "state");
  const area = one("area");
  return (
    <>
      {repos && <FilterField label={t("Repository")} value={one("repo")} onChange={setOne("repo")} options={[any, ...pairs(withCurrent(repos, one("repo")))]} />}
      <FilterField label={t("Type")} value={one("type")} onChange={setOne("type")} options={[any, ["issue", t("Issues")], ["pr", t("Pull requests")]]} />
      <FilterField label={t("State")} value={states.length === 1 ? states[0]! : ""} onChange={setOne("state")} options={[any, ["open", t("Open")], ["closed", t("Closed")], ["merged", t("Merged")]]} />
      <FilterField label={t("Label")} value={one("label")} onChange={setOne("label")} options={[any, ...pairs(withCurrent(facets?.labels ?? [], one("label")))]} />
      <FilterField label={t("Priority")} value={one("priority")} onChange={setOne("priority")} options={[any, ...pairs([...PRIORITIES])]} />
      <FilterField label={t("Area")} value={area} onChange={setOne("area")} options={[any, ...pairs(withCurrent(facets?.areas ?? [], area === "none" ? "" : area)), ["none", t("None")]]} />
      <FilterField label={t("Author")} value={one("author")} onChange={setOne("author")} options={[any, ...pairs(withCurrent(facets?.authors ?? [], one("author")))]} />
      <FilterField
        label={t("AutoCraft")}
        value={one("autocraft")}
        onChange={setOne("autocraft")}
        options={[any, ...AUTOCRAFT_STATES.map((s): [string, string] => [s, s === "none" ? t("Not started") : t(AUTOCRAFT_WORD[s]!.label)])]}
      />
      <FilterField label={t("Discord")} value={one("discord")} onChange={setOne("discord")} options={[any, ["mentioned", t("Mentioned")]]} />
      {/* Hits by meaning come best first: no sort applies. */}
      {!meaning && <FilterField label={t("Sort")} value={sort} onChange={(v) => set(withTerm(q, "sort", v === "updated" ? [] : [v]))} options={SORT_OPTIONS.map(([v, l]): [string, string] => [v, t(l)])} />}
    </>
  );
}

const KEY_LABEL: Partial<Record<QueryKey, string>> = {
  type: "Type", state: "State", label: "Label", priority: "Priority", area: "Area", author: "Author", repo: "Repository", kind: "Kind", size: "Size", ci: "CI", autocraft: "AutoCraft",
};
const VALUE_LABEL: Record<string, string> = { issue: "Issues", pr: "Pull requests", open: "Open", closed: "Closed", merged: "Merged", green: "passed", red: "failed", pending: "running" };
const FLAG_LABEL: Record<string, string> = {
  draft: "Drafts", ready: "Ready pull requests", outside: "Outside authors", mine: "Mine", asked: "Asks me", approved: "Approved for merge", duplicate: "Duplicates",
  security: "Security", stuck: "Stuck", "outside-held": "Held outside authors",
};
const HAS_LABEL: Record<string, string> = { pr: "linked item", label: "label", priority: "priority", area: "area", kind: "classification", discord: "Discord mention", response: "maintainer reply" };

/** A term in words: "Label: bug", "No label", "Not author: eve". */
function termLabel(term: QueryTerm): string {
  const vs = term.values;
  const not = (s: string) => (term.not ? t("Not {f}", { f: s }) : s);
  switch (term.key) {
    case "flag": return not(vs.map((v) => t(FLAG_LABEL[v] ?? v)).join(", "));
    case "has": return vs.map((v) => (term.not ? t("No {f}", { f: t(HAS_LABEL[v] ?? v) }) : t("Has {f}", { f: t(HAS_LABEL[v] ?? v) }))).join(", ");
    case "discord": return not(t("On Discord"));
    case "review": return not(t("Clean review"));
    case "kind": return not(t("{key}: {value}", { key: t("Kind"), value: vs.map((v) => KINDS[v] ?? v).join(", ") }));
    case "autocraft": return not(t("{key}: {value}", { key: "AutoCraft", value: vs.map((v) => (v === "none" ? t("Not started") : t(AUTOCRAFT_WORD[v as BrowseAutocraft]?.label ?? v))).join(", ") }));
    default: return not(t("{key}: {value}", { key: t(KEY_LABEL[term.key] ?? term.key), value: vs.map((v) => t(VALUE_LABEL[v] ?? v)).join(", ") }));
  }
}

type ActiveFilter = { key: string; label: string; without: string };

/** The qualifiers of `q` as removable filters, sort aside; an `items:` term is one filter per item. */
function activeFilters(q: string): { chips: ActiveFilter[]; count: number } {
  const toks = tokens(q);
  const chips: ActiveFilter[] = [];
  let count = 0;
  toks.forEach((tok, i) => {
    const p = parseItemQuery(tok);
    const term = p.terms.length === 1 ? p.terms[0]! : null;
    if (!term) return;
    count++;
    const others = toks.filter((_, j) => j !== i);
    if (term.key === "items" && !term.not) {
      term.values.forEach((v, n) => {
        const it = itemOfValue(v);
        const rest = term.values.filter((_, m) => m !== n);
        chips.push({ key: `${i}:${v}`, label: it ? `${it.owner ? `${it.owner}/` : ""}${it.repo}#${it.number}` : v, without: [...others, ...(rest.length ? [`items:${rest.join(",")}`] : [])].join(" ") });
      });
      return;
    }
    chips.push({ key: `${i}`, label: termLabel(term), without: others.join(" ") });
  });
  return { chips, count };
}

/** The bar pinned under the list while items are ticked: the count, Clear, the command's words, Run, and the reply lines. */
function CommandBar({ text, setText, items, onClear, onDone, reply, onCloseReply }: {
  text: string; setText: (s: string) => void; items: string[]; onClear: () => void; onDone: (r: MaintainCommandResult | null, error: string | null) => void;
  reply: { lines: string[]; ok: boolean } | null; onCloseReply: () => void;
}) {
  const api = useApi();
  const phone = useIsPhone();
  const [busy, setBusy] = useState(false);
  const [showReply, setShowReply] = useState(!phone);
  const read = parse(text);
  // The ticks are the items: text that names items as well, or more items than one command takes, does not run.
  const blocked = items.length > ITEMS_MAX ? t("At most {n} items in one command.", { n: ITEMS_MAX })
    : (read.kind !== "ambiguous" && read.items?.length) || listForm(text) ? t("Write only the command's words while items are ticked.")
    : null;
  const run = async () => {
    if (!text.trim() || busy || blocked || !items.length) return;
    setBusy(true);
    try {
      onDone(await api.maintain.command(text, { items }), null);
    } catch (e) {
      onDone(null, (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label={t("Command")} className="shrink-0 border-t border-line-strong bg-raised shadow-[0_-6px_18px_rgba(0,0,0,0.14)]">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-2 px-4 py-2.5 md:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {items.length > 0 ? (
            <span className="flex items-center gap-1">
              <span className="num text-sm font-medium">{items.length === 1 ? t("1 selected") : t("{n} selected", { n: num(items.length) })}</span>
              <span aria-hidden className="text-ink/50">·</span>
              <Button variant="ghost" size="sm" onClick={onClear} className="max-md:h-11">
                {t("Clear")}
              </Button>
            </span>
          ) : (
            <span className="text-sm text-ink/70">{t("No items selected")}</span>
          )}
          {items.length > 0 && (
            <form
              className="flex min-w-0 flex-1 basis-72 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run();
              }}
            >
              <label htmlFor="items-command" className="shrink-0 text-sm font-medium">
                {t("Command")}
              </label>
              <Input
                id="items-command"
                value={text}
                autoComplete="off"
                placeholder="review and merge"
                aria-describedby={blocked ? "items-command-blocked" : undefined}
                aria-invalid={blocked ? true : undefined}
                onChange={(e) => setText(e.target.value)}
                className="code min-w-0 flex-1"
              />
              <Button type="submit" variant="primary" loading={busy} disabled={!text.trim() || !!blocked} className="max-md:h-11">
                {t("Run")}
              </Button>
            </form>
          )}
          {reply && (
            <span className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" icon={CaretDownIcon} aria-expanded={showReply} aria-controls="items-command-reply" onClick={() => setShowReply(!showReply)} className={cn("max-md:h-11 [&>svg]:transition-transform", !showReply && "[&>svg]:-rotate-90")}>
                {t("Reply")}
              </Button>
              <Button variant="ghost" size="sm" icon={XIcon} aria-label={t("Close reply")} onClick={onCloseReply} className="max-md:h-11 max-md:w-11" />
            </span>
          )}
        </div>
        {blocked && (
          <p id="items-command-blocked" className="text-sm text-warn">
            {blocked}
          </p>
        )}
        {/* Folded, the lines stay in the live region, so they are still read out. */}
        <div id="items-command-reply" aria-live="polite" className={cn("flex max-h-40 flex-col gap-1 overflow-y-auto empty:hidden", !showReply && "sr-only")}>
          {reply?.lines.map((l, i) => (
            <p key={i} className={cn("text-sm", reply.ok ? "text-ink/80" : "text-warn")}>
              {l}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Arrow keys, j/k, Home and End move the focus between the rows (on desktop) or their item links (on phones), or between their tick
 * boxes from a tick box; `p` opens the focused row beside the list.
 */
function listKey(e: KeyboardEvent<HTMLUListElement>, open: ((ref: string) => void) | null) {
  const target = e.target as HTMLElement;
  const tick = target instanceof HTMLInputElement && target.type === "checkbox";
  if ((target.tagName === "INPUT" && !tick) || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
  const row = target.closest<HTMLLIElement>("li[data-row]");
  if (e.key === "p" && open && row) {
    e.preventDefault();
    open(row.dataset.row!);
    return;
  }
  // Each row's first link is its item link (ItemRef); a row whose tick box is disabled takes the focus on the row or its link.
  const links = [...e.currentTarget.querySelectorAll<HTMLLIElement>("li[data-row]")].flatMap((li) => (tick ? li.querySelector<HTMLElement>("input[type=checkbox]:enabled") : null) ?? (open ? li : li.querySelector("a")) ?? []);
  const at = links.findIndex((a) => a.closest("li")?.contains(document.activeElement));
  const to = e.key === "ArrowDown" || e.key === "j" ? at + 1 : e.key === "ArrowUp" || e.key === "k" ? at - 1 : e.key === "Home" ? 0 : e.key === "End" ? links.length - 1 : null;
  if (to === null || !links.length) return;
  e.preventDefault();
  links[Math.max(0, Math.min(links.length - 1, to))]!.focus();
}

const MATCH_TIPS = {
  words: "Words: titles and text containing the words",
  meaning: "Meaning: items whose title and text are about the same thing as the words, found by meaning, best match first",
};

function MatchToggle({ meaning, onChange, className }: { meaning: boolean; onChange: (meaning: boolean) => void; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <span aria-hidden className="text-xs font-medium text-ink/70">
        {t("Match")}
      </span>
      <Segmented
        label={t("Match")}
        value={meaning ? "meaning" : "words"}
        onChange={(v) => onChange(v === "meaning")}
        options={[{ value: "words", label: t("Words"), tip: t(MATCH_TIPS.words) }, { value: "meaning", label: t("Meaning"), tip: t(MATCH_TIPS.meaning) }]}
        className="flex-nowrap"
      />
    </div>
  );
}

export function ItemsView(_: ViewProps) {
  const user = useUser();
  const project = usePageProject();
  const url = useBrowseUrl();
  const phone = useIsPhone();
  const [typed, setTyped] = useState(url.q);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [cmd, setCmd] = useState("");
  const [reply, setReply] = useState<{ lines: string[]; ok: boolean } | null>(null);
  const [announced, setAnnounced] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeChip = useRef<HTMLButtonElement>(null);
  const selectAllBox = useRef<HTMLInputElement>(null);
  const writes = user.role !== "viewer" && user.runRepos.length > 0;

  useEffect(() => setTyped(url.q), [url.q]);
  // On phones the views scroll sideways: the picked one stays in sight.
  // A block body: browsers with scroll promises return one from scrollIntoView, and React would call it as the cleanup.
  useEffect(() => {
    activeChip.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [url.q]);

  // A search by meaning embeds the words; the qualifiers still filter its hits, which keep their order.
  const split = url.meaning ? splitWords(url.q) : null;
  const { data, error } = useQuery(`maintain-browse:${url.q}:${url.offset}:${url.meaning}`, async (a) => {
    if (!split?.words) return a.maintain.browse({ q: url.q, offset: url.offset, limit: PAGE });
    const hits = await a.semanticSearch(split.words);
    if (!hits.length) return { rows: [], total: 0, offset: 0, limit: PAGE, unknown: [], presets: null, facets: null };
    return a.maintain.browse({ q: split.rest, refs: hits.map(refOf), offset: url.offset, limit: PAGE });
  });
  const { data: counts } = useQuery("maintain-browse:presets", (a) => a.maintain.browse({ q: "", limit: 1, presets: true }));
  const { data: repoList } = useQuery("maintain-browse:repos", (a) => a.repos(), { enabled: !project });
  const preset = presetOf(url.q);
  // Sorted by when they were opened, rows show that time instead of the last update.
  const byCreated = parseItemQuery(url.q).sort.by === "created";
  const set = (q: string) => url.go({ q });
  const active = activeFilters(url.q);

  // `open=<repo>/<n>`: the item shown beside the list on desktop.
  const openItem = useOpenItem();
  const openRow = phone ? null : (ref: string, keyboard = true) => openItem(ref.slice(0, ref.lastIndexOf("#")), Number(ref.slice(ref.lastIndexOf("#") + 1)), { keyboard });

  // Text that names items becomes the list of exactly those items; a bare #n names an item only on a page scoped to one repo.
  const paste = (e: ClipboardEvent<HTMLInputElement>) => {
    const items = itemsIn(e.clipboardData.getData("text"), project ?? undefined);
    if (!items.length) return;
    e.preventDefault();
    const q = itemsTerm(items);
    setTyped(q);
    set(q);
  };

  const select = (next: Set<string>) => {
    setPicked(next);
    setAnnounced(next.size ? (next.size === 1 ? t("1 item selected") : t("{n} items selected", { n: num(next.size) })) : t("No items selected"));
  };
  const pick = (refs: string[], on: boolean) => {
    const next = new Set(picked);
    for (const r of refs) if (on) next.add(r); else next.delete(r);
    select(next);
  };
  const clear = () => {
    select(new Set());
    selectAllBox.current?.focus();
  };
  // The items the command ran on leave the selection; those it refused or could not read stay ticked. The reply lines are the
  // announcement, so the selection's live region goes quiet.
  const done = (r: MaintainCommandResult | null, err: string | null) => {
    setAnnounced("");
    if (!r) {
      setReply({ lines: [err ?? ""], ok: false });
      return;
    }
    const ran = new Set(r.items.filter((x) => x.outcome === "run").map(refOf));
    if (ran.size) setPicked((prev) => new Set([...prev].filter((p) => !ran.has(p))));
    const ok = r.items.length > 0 && ran.size === r.items.length;
    setReply({ lines: r.lines, ok });
    if (ok) setCmd("");
  };
  const barShown = writes && (picked.size > 0 || !!reply);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-3 px-4 pb-6 pt-5 md:px-6">
          <h1 className="text-xl font-semibold">{t("Items")}</h1>
          <p aria-live="polite" className="sr-only">
            {announced}
          </p>

          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <SearchField value={typed} onChange={setTyped} onSubmit={(v) => set(v)} onPaste={paste} label={t("Search items")} placeholder={t("Words, refs or links, or is:open label:bug")} />
            </div>
            <MatchToggle meaning={url.meaning} onChange={(m) => url.go({ meaning: m })} className="max-md:hidden" />
            <Button icon={FunnelIcon} aria-expanded={filtersOpen} aria-controls="items-filters" onClick={() => setFiltersOpen(!filtersOpen)} className="max-md:h-11">
              {t("Filters")}
              {active.count > 0 && <span className="num rounded-full bg-ink/10 px-1.5 text-2xs leading-4">{active.count}</span>}
            </Button>
          </div>

          {active.chips.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label={t("Active filters")}>
              {active.chips.map((c) => (
                <li key={c.key}>
                  <Chip aria-label={t("{filter}, remove", { filter: c.label })} onClick={() => set(c.without)} className="max-md:h-11">
                    <span className={cn(c.label.includes("#") && "code")}>{c.label}</span>
                    <XIcon aria-hidden className="text-ink/60" />
                  </Chip>
                </li>
              ))}
            </ul>
          )}

          {filtersOpen && (
            <div id="items-filters" role="group" aria-label={t("Filters")} className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-3">
              <MatchToggle meaning={url.meaning} onChange={(m) => url.go({ meaning: m })} className="md:hidden" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <FilterControls q={url.q} set={set} facets={counts?.facets ?? null} repos={project ? null : repoList ?? []} meaning={!!split?.words} />
              </div>
            </div>
          )}

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] md:-mx-6 md:px-6" role="group" aria-label={t("Views")}>
            {PRESETS.map((p) => (
              <Chip key={p.id} ref={preset?.id === p.id ? activeChip : undefined} active={preset?.id === p.id} className="shrink-0 max-md:h-11" count={counts?.presets ? num(counts.presets[p.id] ?? 0) : undefined} onClick={() => set(p.query)}>
                {t(p.label)}
              </Chip>
            ))}
          </div>

          {data && data.unknown.length > 0 && <p className="text-sm text-warn">{t("Not applied: {terms}", { terms: data.unknown.join(" ") })}</p>}
          <div className="flex min-h-8 items-center justify-between gap-2 text-sm text-ink/70">
            <span aria-live="polite" className="num">
              {data ? (data.total === 1 ? t("1 item") : t("{n} items", { n: num(data.total) })) : ""}
            </span>
            {!preset && (
              <Button variant="ghost" onClick={() => set(DEFAULT_QUERY)} className="max-md:h-11">
                {t("Clear search")}
              </Button>
            )}
          </div>

          {!data ? (
            <Pending error={error} />
          ) : data.rows.length === 0 ? (
            <div className="rounded-lg border border-line px-4 py-6 text-md">{t("No items match.")}</div>
          ) : (
            <div className="rounded-lg border border-line bg-panel">
              {writes && <SelectAll refs={data.rows.filter((r) => user.runRepos.includes(r.repo)).map(refOf)} picked={picked} onPick={pick} boxRef={selectAllBox} />}
              <ul className="divide-y divide-line" aria-label={preset ? t(preset.label) : t("Items")} onKeyDown={(e) => listKey(e, openRow)}>
                {data.rows.map((r) => (
                  <Row
                    key={refOf(r)}
                    r={r}
                    opened={!phone && !!url.opened && url.opened.repo === r.repo && url.opened.number === r.number}
                    byCreated={byCreated}
                    picking={writes}
                    picked={picked.has(refOf(r))}
                    may={user.runRepos.includes(r.repo)}
                    onPick={(on) => pick([refOf(r)], on)}
                    onOpen={openRow && ((keyboard) => openRow(refOf(r), keyboard))}
                  />
                ))}
              </ul>
              <Pager offset={data.offset} limit={data.limit} total={data.total} onOffset={(o) => url.go({ offset: o })} />
            </div>
          )}
        </div>
      </div>
      {barShown && <CommandBar text={cmd} setText={setCmd} items={[...picked]} onClear={clear} onDone={done} reply={reply} onCloseReply={() => setReply(null)} />}
    </div>
  );
}
