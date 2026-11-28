// What the planner and the fix-up step read of operator fix-ups and pre-approved merges, over the workflow and changes modules. No writes here.
import { FIXUP_MAX_ATTEMPTS } from "../core/rules.ts";
import { loadFixupRequests } from "../data/workflow/index.ts";
import { loadPatchFacts, operatorTriesIn } from "../data/changes/index.ts";
import type { Db } from "../db/index.ts";

/**
 * Tries the operator's fix-ups used on the PR, since `since` when given (the workflow's: when its person last went on with it); the fix-up
 * limit of the PR applies to them as to the review's.
 */
export async function operatorTries(db: Db, repo: string, number: number, since?: string): Promise<number> {
  return operatorTriesIn((await loadPatchFacts(db, [{ repo, number }])).get(`${repo}#${number}`)?.fixups ?? [], since);
}
export const operatorTriesLeft = async (db: Db, repo: string, number: number, since?: string): Promise<boolean> => await operatorTries(db, repo, number, since) < FIXUP_MAX_ATTEMPTS;

export type OperatorFix = { id: number; head: string; instructions: string; by: string; preapprovalId: number | null };

/**
 * The operator fix-up of the PR still to work at `head`: queued, without a final fixups row of its own, and made by someone who
 * may still act on the repo (its push is made as them).
 */
export async function queuedOperatorFix(db: Db, repo: string, number: number, head: string, nowMs: number = Date.now()): Promise<OperatorFix | null> {
  const r = (await loadFixupRequests(db, { refs: [{ repo, number }], nowMs })).filter((o) => o.from_head === head).at(-1);
  return r ? { id: r.id, head: r.from_head, instructions: r.instructions, by: r.by, preapprovalId: r.preapproval_id } : null;
}

