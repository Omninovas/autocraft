// The queued calls in claim order, from the runners module's queue reading: follow-ups by age, then the rest in the model
// queue's order (sortQueue: class with gating and long-waiting small calls raised, running calls of the repo, aged level,
// running calls of the step, age). Pure; computed once per queue reading.
import type { QueuedCall, QueueSnapshot } from "../data/runners/index.ts";
import { sortQueue } from "../agents/call.ts";
import { claimClass } from "./claim-class.ts";
import { scaled } from "./time-scale.ts";

/** A call this login released is not offered to it again for this long (its helper could not run it). */
export const RELEASE_SKIP_MS = scaled(10 * 60_000);

/** The login a give-back keeps the call from (lowercase) and until when; null when no give-back's wait is running. */
export function releaseSkip(r: Pick<QueuedCall, "releasedBy" | "releasedAt" | "releaseWaitMs">, nowMs: number): { login: string; until: number } | null {
  if (r.releasedBy === null || r.releasedAt === null) return null;
  const until = r.releasedAt + (r.releaseWaitMs ?? RELEASE_SKIP_MS);
  return until >= nowMs ? { login: r.releasedBy, until } : null;
}

/** A queued call with the column-named fields the shared rules read. */
export type Cand = QueuedCall & { prompt_id: string; parent_id: number | null; sticky_login: string | null; seen_at: number };

export const candOf = (q: QueuedCall): Cand => ({ ...q, prompt_id: q.promptId, parent_id: q.parentId, sticky_login: q.stickyLogin, seen_at: q.seenAt });

export type Ordered = { followUps: Cand[]; ordered: Cand[]; all: Cand[] };
const orders = new WeakMap<QueueSnapshot, Ordered>();

/** The queue in claim order; the order (small-tier aging included) is taken when the reading is first ordered, so it is at most as old as the reading. */
export function orderedOf(queue: QueueSnapshot, nowMs: number): Ordered {
  let o = orders.get(queue);
  if (!o) {
    const cands = queue.calls.map(candOf);
    const followUps = cands.filter((r) => r.parent_id !== null).sort((a, b) => a.since - b.since || a.id - b.id);
    const ordered = sortQueue(cands.filter((r) => r.parent_id === null), queue.running, nowMs, (r) => claimClass(r, nowMs));
    orders.set(queue, (o = { followUps, ordered, all: [...followUps, ...ordered] }));
  }
  return o;
}
