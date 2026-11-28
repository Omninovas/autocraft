// The Items page's detail panel (desktop): the item in `?open=<repo>/<number>`, with its AutoCraft chat and its GitHub
// conversation in two tabs. Escape inside the panel closes it; the title opens the full item page.
import { useEffect, useRef, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChatsIcon, XIcon } from "@phosphor-icons/react";
import { t } from "../../../../../src/i18n/index.ts";
import { useApi, useQuery } from "../../../api/client";
import type { ViewProps } from "../../../registry/types";
import { useItemChat, useItemPage } from "../../../lib/hooks";
import { itemPath } from "../../../lib/links";
import { itemChatStatus } from "../../../lib/status";
import { usePref } from "../../../shell/layoutStorage";
import { EmptyState } from "../../../ui/atoms/EmptyState";
import { GithubButton } from "../../../ui/atoms/GithubButton";
import { ItemIcon } from "../../../ui/atoms/ItemIcon";
import { Pending } from "../../../ui/atoms/Pending";
import { ItemStatusLine } from "../../../ui/molecules/chat/ItemStatusLine";
import { Tabs } from "../../../ui/molecules/Tabs";
import { GithubSide } from "../../../ui/organisms/GithubSide";
import { ItemChatPane } from "../../../ui/organisms/ItemChatPane";
import { ItemHolds } from "../../../ui/organisms/ItemHolds";
import { OPEN_PARAM, openItemKey, parseOpenItem, type OpenItemState } from "./openItem";

type Tab = "autocraft" | "github";
const TABS: Tab[] = ["autocraft", "github"];
const ID = "item-panel";

export function ItemPanel({ user }: ViewProps) {
  const [params, setParams] = useSearchParams();
  const open = parseOpenItem(params.get(OPEN_PARAM));
  if (!open)
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState icon={ChatsIcon}>{t("Pick an item to see its conversation")}</EmptyState>
      </div>
    );
  const close = () => {
    const key = openItemKey(open.repo, open.number);
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.delete(OPEN_PARAM);
        return n;
      },
      { replace: true },
    );
    // The row that opened the item takes focus back, when the list still shows it.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-open-item="${CSS.escape(key)}"]`)?.focus());
  };
  return <OpenItem key={`${open.repo}#${open.number}`} repo={open.repo} number={open.number} login={user.login} onClose={close} />;
}

function OpenItem({ repo, number, login, onClose }: { repo: string; number: number; login: string; onClose: () => void }) {
  const api = useApi();
  const nav = useNavigate();
  const location = useLocation();
  const { data: m, error: mError } = useQuery(`maintain-item:${repo}#${number}`, (a) => a.maintainItem.get(repo, number));
  const { data: d, error } = useItemPage(repo, number);
  const chat = useItemChat(repo, number);
  const [saved, setTab] = usePref<Tab>(login, "items:panel-tab", "autocraft");
  const tab = TABS.includes(saved) ? saved : "autocraft";
  const heading = useRef<HTMLHeadingElement>(null);
  const focused = useRef<string | null>(null);
  const ready = !!m && !!d && m.repo === repo && m.number === number && d.repo === repo && d.number === number;

  // Opened from a row with Enter: the heading takes focus once, when the item shows.
  useEffect(() => {
    if (!ready || !(location.state as OpenItemState | null)?.focusItemPanel || focused.current === location.key) return;
    focused.current = location.key;
    heading.current?.focus();
  }, [ready, location.key, location.state]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    e.preventDefault();
    onClose();
  };

  if (!ready)
    return (
      <div onKeyDown={onKeyDown} className="h-full">
        <Pending error={error ?? mError ?? null} />
      </div>
    );
  const { status, state, next } = itemChatStatus(chat.data, m);
  const ref = `${repo}#${number}`;
  return (
    <section aria-labelledby={`${ID}-title`} onKeyDown={onKeyDown} className="flex h-full min-h-0 flex-col bg-panel">
      <header className="shrink-0 px-4 pt-2">
        <div className="flex h-8 items-center gap-1.5 pr-7">
          <span className="code min-w-0 flex-1 truncate text-sm text-ink/70" title={ref}>
            {ref}
          </span>
          <GithubButton href={d.github.url} label={t("Open {item} on GitHub", { item: ref })} className="my-0" />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close {item}", { item: ref })}
            title={t("Close")}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink/70 hover:bg-ink/[0.06] hover:text-ink"
          >
            <XIcon aria-hidden className="text-[15px]" />
          </button>
        </div>
        <h2 ref={heading} id={`${ID}-title`} tabIndex={-1} className="flex items-start gap-2 text-base font-semibold leading-6 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink">
          <ItemIcon kind={d.kind} state={d.state} draft={d.draft} />
          <Link to={itemPath(repo, number)} className="line-clamp-2 min-w-0 break-words hover:underline">
            {d.title}
          </Link>
        </h2>
      </header>
      <Tabs
        idBase={ID}
        label={t("Item")}
        value={tab}
        onChange={setTab}
        className="mt-1 px-2"
        options={[
          { value: "autocraft", label: "AutoCraft" },
          { value: "github", label: "GitHub", count: d.github.events.length },
        ]}
      />
      {tab === "autocraft" ? (
        <div id={`${ID}-panel-autocraft`} role="tabpanel" aria-labelledby={`${ID}-tab-autocraft`} className="flex min-h-0 flex-1 flex-col">
          {status && <ItemStatusLine status={status} state={state} next={next} className="shrink-0 border-b border-line px-4 py-2" />}
          <ItemChatPane
            chat={chat.data}
            {...(chat.error ? { error: chat.error } : {})}
            holds={<ItemHolds m={m} onControl={(b) => api.maintainItem.control(b)} />}
            onSend={chat.send}
            onWithdraw={chat.withdraw}
            onEvent={(id) => nav(`${itemPath(repo, number)}?event=${encodeURIComponent(id)}`)}
            onGithub={() => {
              setTab("github");
              requestAnimationFrame(() => document.getElementById(`${ID}-tab-github`)?.focus());
            }}
          />
        </div>
      ) : (
        <div id={`${ID}-panel-github`} role="tabpanel" aria-labelledby={`${ID}-tab-github`} className="min-h-0 flex-1 overflow-y-auto">
          <GithubSide d={d} />
        </div>
      )}
    </section>
  );
}
