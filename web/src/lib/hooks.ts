import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useHref, useSearchParams } from "react-router-dom";
import { useApi, useQuery } from "../api/client";
import type { ItemChat, ItemPageData } from "../api/types";

/**
 * Runs a write and keeps its error message for display. `latestOnly`: when writes overlap, only the latest one started sets or
 * clears the error and the busy key, so an older write that fails after a newer one started does not leave its error behind.
 */
export function useWrite({ latestOnly = false }: { latestOnly?: boolean } = {}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const run = useCallback(async (key: string, f: () => Promise<unknown>) => {
    const n = ++seq.current;
    const mine = () => !latestOnly || n === seq.current;
    setBusy(key);
    setError(null);
    try {
      await f();
      return true;
    } catch (e) {
      if (mine()) setError((e as Error).message);
      return false;
    } finally {
      if (mine()) setBusy(null);
    }
  }, [latestOnly]);
  return { busy, error, setError, run };
}

const URL_PATCH_EVENT = "autocraft:url-patch";

/** Read the router's live query, including the hash-router used only by the published demo. */
function liveSearch(hashRouter: boolean): string {
  if (!hashRouter) return window.location.search;
  const path = window.location.hash.slice(1);
  const query = path.indexOf("?");
  if (query < 0) return "";
  const fragment = path.indexOf("#", query);
  return path.slice(query, fragment < 0 ? undefined : fragment);
}

function subscribeUrl(listener: () => void) {
  window.addEventListener(URL_PATCH_EVENT, listener);
  window.addEventListener("popstate", listener);
  window.addEventListener("hashchange", listener);
  return () => {
    window.removeEventListener(URL_PATCH_EVENT, listener);
    window.removeEventListener("popstate", listener);
    window.removeEventListener("hashchange", listener);
  };
}

/** Read at action time, before React Router's render may catch up with navigation. */
export function useLiveLocation() {
  const hashRouter = useHref("/").startsWith("#");
  return useCallback(() => ({
    pathname: hashRouter ? window.location.hash.slice(1).split(/[?#]/, 1)[0] || "/" : window.location.pathname,
    search: liveSearch(hashRouter),
  }), [hashRouter]);
}

/** URL-only view state. Patches read the live location, not a render that may precede another patch.
 * Replacing stays the default for existing callers; discrete navigation may explicitly push. */
export function useUrlState() {
  const [sp, setSp] = useSearchParams();
  const readLocation = useLiveLocation();
  const search = useSyncExternalStore(subscribeUrl, () => readLocation().search, () => sp.toString());
  const state = useMemo(() => Object.fromEntries(new URLSearchParams(search)), [search]);
  const update = useCallback((patch: Record<string, string | null | undefined>, options?: { replace?: boolean }) => {
    const next = new URLSearchParams(readLocation().search);
    for (const [key, value] of Object.entries(patch)) value ? next.set(key, value) : next.delete(key);
    setSp(next, { replace: options?.replace ?? true });
    // History changes synchronously; React Router may publish its context in a transition.
    // All view owners see the same snapshot immediately, without a module-global history or timer.
    window.dispatchEvent(new Event(URL_PATCH_EVENT));
  }, [readLocation, setSp]);
  return { state, update, search };
}

/** An item's page read (header facts and its GitHub side). A matching `since` costs one small reply. */
export function useItemPage(repo: string, number: number) {
  const key = `item-page:v2:${repo}#${number}`;
  const last = useRef<{ key: string; page: ItemPageData } | null>(null);
  return useQuery<ItemPageData>(key, async (a) => {
    const prev = last.current?.key === key ? last.current.page : null;
    const r = await a.itemPage(repo, number, prev?.stamp);
    if ("unchanged" in r && prev) return prev;
    if ("unchanged" in r) throw new Error("unexpected empty answer");
    last.current = { key, page: r };
    return r;
  });
}

/** Something moves without a topic: a message waiting for its answer, or a running step's progress. */
const chatMoving = (c: ItemChat | undefined) =>
  !!c?.conversations.some((v) => v.working || v.entries.some((e) => (e.t === "said" && e.pending) || (e.t === "work" && e.state === "running")));
/** Queued work, whose reason changes slowly: read less often. */
const chatQueued = (c: ItemChat | undefined) => !!c?.conversations.some((v) => v.queued.length > 0);

/**
 * An item's chat with AutoCraft, asked `since` its last stamp, with sending and withdrawing in its main conversation. A send or a
 * withdraw keeps the read it returned, so the next read is small.
 */
export function useItemChat(repo: string, number: number) {
  const api = useApi();
  const key = `item-chat:${repo}#${number}`;
  const last = useRef<{ key: string; chat: ItemChat } | null>(null);
  const q = useQuery<ItemChat>(
    key,
    async (a) => {
      const prev = last.current?.key === key ? last.current.chat : null;
      const r = await a.itemChat.get(repo, number, prev?.stamp);
      if ("unchanged" in r && prev) return prev;
      if ("unchanged" in r) throw new Error("unexpected empty answer");
      last.current = { key, chat: r };
      return r;
    },
    { pollMs: (c) => (chatMoving(c) ? 4000 : chatQueued(c) ? 20_000 : false) },
  );
  const { refetch } = q;
  const conv = q.data?.conversations[0];
  const send = useCallback(
    async (text: string) => {
      if (!conv) return [];
      const r = await api.itemChat.send(repo, number, conv.id, text);
      last.current = { key, chat: r.chat };
      refetch();
      return r.lines;
    },
    [api, repo, number, conv, key, refetch],
  );
  const withdraw = useCallback(async () => {
    last.current = { key, chat: await api.itemChat.withdraw(repo, number) };
    refetch();
  }, [api, repo, number, key, refetch]);
  return { ...q, conv, send, withdraw };
}
