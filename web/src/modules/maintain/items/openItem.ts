// The Items page's detail panel shows the item in the `open` URL parameter, `open=<repo>/<number>`.
// Rows open an item with `useOpenItem()` and carry `openItemAttrs(repo, number)` on their focusable element, so closing the
// panel returns focus to the row.
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveLocation } from "../../../lib/hooks";
import { shortRepo } from "../../../lib/links";

export const OPEN_PARAM = "open";

/** Navigation state that asks the panel to move focus to its heading once the item shows. */
export type OpenItemState = { focusItemPanel?: true };

export const openItemKey = (repo: string, number: number): string => `${shortRepo(repo)}/${number}`;

export function parseOpenItem(v: string | null): { repo: string; number: number } | null {
  if (!v) return null;
  const i = v.lastIndexOf("/");
  const number = Number(v.slice(i + 1));
  const repo = v.slice(0, i);
  return i > 0 && Number.isInteger(number) && number > 0 ? { repo, number } : null;
}

/** Marks a row's focusable element as the one that opens this item. */
export const openItemAttrs = (repo: string, number: number) => ({ "data-open-item": openItemKey(repo, number) });

/** Search parameters as text, with `:`, `,` and `/` left readable: `?q=is:open+label:bug&open=photocraft/12`. */
export const readableSearch = (p: URLSearchParams): string => p.toString().replace(/%3A/gi, ":").replace(/%2C/gi, ",").replace(/%2F/gi, "/");

/** Navigates to this page with `edit` applied to its parameters, written readably, replacing the history entry. */
function useEditParams() {
  const navigate = useNavigate();
  const live = useLiveLocation();
  return useCallback(
    (edit: (p: URLSearchParams) => void, state?: OpenItemState) => {
      const { pathname, search } = live();
      const p = new URLSearchParams(search);
      edit(p);
      const s = readableSearch(p);
      navigate({ pathname, search: s ? `?${s}` : "" }, { replace: true, ...(state ? { state } : {}) });
    },
    [navigate, live],
  );
}

/**
 * Opens an item in the panel, keeping the rest of the query. `keyboard`: the row was opened with Enter, so focus moves to the
 * panel's heading.
 */
export function useOpenItem() {
  const edit = useEditParams();
  return useCallback(
    (repo: string, number: number, how: { keyboard?: boolean } = {}) => edit((p) => p.set(OPEN_PARAM, openItemKey(repo, number)), how.keyboard ? { focusItemPanel: true } : undefined),
    [edit],
  );
}

/** Closes the panel, keeping the rest of the query. */
export function useCloseItem() {
  const edit = useEditParams();
  return useCallback(() => edit((p) => p.delete(OPEN_PARAM)), [edit]);
}
