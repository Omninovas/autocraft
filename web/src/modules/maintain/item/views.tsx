// The item page: a header (repo#number, kind and state, badges, title, AutoCraft's status in one line) over the chat with
// AutoCraft, which is always the main column. GitHub (the item's GitHub side) and Events (every step AutoCraft and GitHub recorded)
// sit in a resizable side panel on wide screens and in tabs under the header on phones.
// `?tab=github|events` opens that view; `?event=<id>` opens Events on that event.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  RadioButtonIcon,
  ShieldWarningIcon,
  SidebarSimpleIcon,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { t, tk } from "../../../../../src/i18n/index.ts";
import { useApi, useQuery } from "../../../api/client";
import type { ItemChatState } from "../../../api/types";
import type { ItemKind, ItemPageData, ItemState, MaintainItem } from "../../../api/types";
import { useItemChat, useItemPage } from "../../../lib/hooks";
import { itemChatStatus } from "../../../lib/status";
import type { ViewProps } from "../../../registry/types";
import { useIsPhone } from "../../../shell/useMedia";
import { Badge, type Tone } from "../../../ui/atoms/Badge";
import { GithubLinkButton } from "../../../ui/atoms/GithubButton";
import { Pending } from "../../../ui/atoms/Pending";
import { cn } from "../../../ui/cn";
import { ItemRef } from "../../../ui/molecules/ItemRef";
import { ItemStatusLine } from "../../../ui/molecules/chat/ItemStatusLine";
import { GithubSide } from "../../../ui/organisms/GithubSide";
import { ItemChatPane } from "../../../ui/organisms/ItemChatPane";
import { ItemHolds } from "../../../ui/organisms/ItemHolds";
import { SideDock, useDockState, type DockView } from "../../../ui/organisms/SideDock";
import { History } from "./History";

type Side = "github" | "events";
const SIDES: { value: Side }[] = [{ value: "github" }, { value: "events" }];
const DOCK = "item";

export function ItemView(props: ViewProps) {
  const repo = props.params.repo!;
  const number = Number(props.params.number);
  const { data: m, error } = useQuery(`maintain-item:${repo}#${number}`, (a) => a.maintainItem.get(repo, number));
  if (!m || m.repo !== repo || m.number !== number) return <Pending error={error} />;
  return <ItemPage m={m} login={props.user.login} />;
}

/**
 * Which side view shows and whether it is open. The URL wins; without `tab`, wide screens keep the reader's last view and
 * open state, and phones show the chat. `focusKey` counts requests to show an event, so the same one can be asked for again.
 */
function useSide(login: string, phone: boolean) {
  const [params, setParams] = useSearchParams();
  const dock = useDockState<Side>(login, DOCK, SIDES);
  const event = params.get("event");
  const tab = SIDES.find((x) => x.value === params.get("tab"))?.value ?? (event ? "events" : null);
  const view = tab ?? dock.view;
  const open = phone ? !!tab : tab ? true : dock.open;
  const [focusKey, setFocusKey] = useState(0);
  const setUrl = useCallback(
    (next: Side | null, ev?: string) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (next) n.set("tab", next);
          else n.delete("tab");
          if (ev) n.set("event", ev);
          else n.delete("event");
          return n;
        },
        { replace: true },
      ),
    [setParams],
  );
  const onView = (v: Side) => {
    dock.setView(v);
    if (phone || tab) setUrl(v);
  };
  const onOpen = (o: boolean) => {
    if (!phone) dock.setOpen(o);
    if (!o) setUrl(null);
  };
  /** From a chat row or a badge: open `v`, on event `ev` when given. */
  const show = (v: Side, ev?: string) => {
    dock.setView(v);
    if (!phone) dock.setOpen(true);
    setUrl(v, ev);
    setFocusKey((k) => k + 1);
  };
  return { view, open, event: view === "events" ? event : null, focusKey, onView, onOpen, show };
}

function ItemPage({ m, login }: { m: MaintainItem; login: string }) {
  const api = useApi();
  const phone = useIsPhone();
  const { data: d, error } = useItemPage(m.repo, m.number);
  const chat = useItemChat(m.repo, m.number);
  const side = useSide(login, phone);
  // A chat row or a badge that opens a view moves focus to that view's tab; an event focuses its own row (History).
  const focusTab = useRef<Side | null>(null);
  useEffect(() => {
    const v = focusTab.current;
    if (!v || !side.open || side.view !== v) return;
    focusTab.current = null;
    document.getElementById(`${DOCK}-${phone ? "phone" : "side"}-tab-${v}`)?.focus();
  }, [side.open, side.view, side.focusKey, phone]);
  const show = (v: Side, ev?: string) => {
    focusTab.current = ev ? null : v;
    side.show(v, ev);
  };
  if (!d || d.repo !== m.repo || d.number !== m.number) return <Pending error={error} />;

  const { status, state, next } = itemChatStatus(chat.data, m);
  const header = (
    <Header
      m={m}
      d={d}
      status={status}
      state={state}
      next={next}
      onDuplicates={() => show("events")}
      toggle={
        !phone && (
          <button
            type="button"
            aria-expanded={side.open}
            aria-label={t("Side panel")}
            title={side.open ? t("Close side panel") : t("Show side panel")}
            onClick={() => side.onOpen(!side.open)}
            className={cn(
              "inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-line-strong text-ink/80 transition-colors duration-fast hover:bg-ink/[0.06] hover:text-ink",
              side.open ? "bg-ink/[0.07] text-ink" : "bg-raised",
            )}
          >
            <SidebarSimpleIcon aria-hidden className="-scale-x-100 text-[18px]" />
          </button>
        )
      }
    />
  );
  const main = (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      {!phone && header}
      <ItemChatPane
        chat={chat.data}
        {...(chat.error ? { error: chat.error } : {})}
        holds={<ItemHolds m={m} onControl={(b) => api.maintainItem.control(b)} />}
        onSend={chat.send}
        onWithdraw={chat.withdraw}
        onEvent={(id) => show("events", id)}
        onGithub={() => show("github")}
      />
    </div>
  );
  const views: DockView<Side>[] = [
    { value: "github", label: "GitHub", defaultSize: 46, count: d.github.events.length, content: <GithubSide d={d} /> },
    {
      value: "events",
      label: t("Events"),
      defaultSize: 34,
      content: (
        <div className="flex flex-col gap-3 px-3 pb-8 pt-3">
          <Duplicates m={m} />
          <History repo={m.repo} number={m.number} kind={m.kind} said={m.events} focus={side.event} focusKey={side.focusKey} />
        </div>
      ),
    },
  ];
  return (
    <SideDock
      id={DOCK}
      login={login}
      header={phone ? header : undefined}
      main={main}
      mainLabel={t("Chat")}
      views={views}
      view={side.view}
      onView={side.onView}
      open={side.open}
      onOpen={side.onOpen}
    />
  );
}

const KIND_STATE: Record<ItemKind, Record<ItemState, [PhosphorIcon, Tone, string]>> = {
  pr: { open: [GitPullRequestIcon, "ok", tk("Open PR")], merged: [GitMergeIcon, "merged", tk("Merged PR")], closed: [GitPullRequestIcon, "bad", tk("Closed PR")] },
  issue: { open: [RadioButtonIcon, "ok", tk("Open issue")], closed: [CheckCircleIcon, "merged", tk("Closed issue")], merged: [CheckCircleIcon, "merged", tk("Closed issue")] },
};

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;
const SEVERITY_TONE = { critical: "bad", high: "bad", medium: "warn", low: "neutral" } as const;
/** Badges that are links or buttons reach 44 px tall for touch without growing the row. */
const HIT = "relative rounded-full after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink";

function Header({ m, d, status, state, next, onDuplicates, toggle }: { m: MaintainItem; d: ItemPageData; status: string | null; state: ItemChatState; next: string | null; onDuplicates: () => void; toggle: ReactNode }) {
  const weight = m.status?.live ? m.status.weight : null;
  const [KindIcon, tone, kindLabel] = KIND_STATE[d.kind][d.state];
  const worst = [...m.security].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])[0];
  return (
    <header className="shrink-0 border-b border-line bg-panel">
      <div className="mx-auto w-full max-w-[784px] px-4 pb-2.5 pt-1 md:px-8 md:pb-4 md:pt-3">
        <div className="flex items-center gap-2">
          <Link to="/items" aria-label={t("Back to Items")} title={t("Items")} className="-ml-3 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink/70 hover:bg-ink/[0.06] hover:text-ink">
            <ArrowLeftIcon aria-hidden className="text-[16px]" />
          </Link>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="flex max-w-full min-w-0 items-center gap-2.5">
              <span className="code min-w-0 truncate text-sm text-ink/70" title={`${d.repo}#${d.number}`}>
                {d.repo}#{d.number}
              </span>
              <Badge tone={tone} icon={<KindIcon aria-hidden weight="bold" />}>
                {t(kindLabel)}
              </Badge>
            </span>
            {weight && <Badge tone={weight === "urgent" ? "bad" : weight === "low" ? "neutral" : "warn"}>{weight}</Badge>}
            {m.duplicates.length > 0 && (
              <button type="button" onClick={onDuplicates} className={HIT}>
                <Badge tone="warn">{m.duplicates.length === 1 ? t("1 duplicate") : t("{n} duplicates", { n: m.duplicates.length })}</Badge>
              </button>
            )}
            {m.outside && <Badge tone="warn">{t("Held: outside author")}</Badge>}
            {worst && (
              <Link to={`/security/${encodeURIComponent(m.repo)}/${worst.number}`} className={HIT}>
                <Badge tone={SEVERITY_TONE[worst.severity]} icon={<ShieldWarningIcon aria-hidden weight="bold" />}>
                  {m.security.length === 1 ? t("Security: {severity}", { severity: worst.severity }) : t("{n} security findings", { n: m.security.length })}
                </Badge>
              </Link>
            )}
          </div>
          <GithubLinkButton href={d.github.url} />
          {toggle}
        </div>
        <h1 className="mt-0.5 line-clamp-2 break-words text-lg font-semibold leading-6 tracking-[-0.01em] md:line-clamp-none md:text-xl md:leading-7">{d.title}</h1>
        {status && <ItemStatusLine status={status} state={state} next={next} className="mt-1 md:mt-1.5" />}
        {m.status?.notPosted && <p className="mt-1.5 rounded border border-warn/60 bg-warn/10 px-3 py-1.5 text-sm">{m.status.notPosted}</p>}
      </div>
    </header>
  );
}

/** The item's duplicates, at the top of Events; the header badge opens them. */
function Duplicates({ m }: { m: MaintainItem }) {
  if (!m.duplicates.length) return null;
  return (
    <section aria-labelledby="item-duplicates" className="rounded-lg border border-line bg-panel px-3 py-2.5">
      <h2 id="item-duplicates" className="mb-1.5 text-xs font-semibold text-ink/70">
        {t("Duplicates")}
      </h2>
      <ul className="flex flex-col gap-2">
        {m.duplicates.map((x) => (
          <li key={`${x.repo}#${x.number}`} className="relative flex flex-col gap-0.5 text-sm">
            <ItemRef repo={x.repo} number={x.number} kind={x.kind} state={x.state} title={x.title} stretch />
            {x.canonical && <span className="pl-6 text-xs text-ink/70">{t("kept as the main item")}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
