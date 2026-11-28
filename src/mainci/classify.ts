// State of a default-branch head from its checks, and what a repo's head history says about when it
// turned red. Pure: no database, no GitHub.
import type { CheckState } from "../review/checks.ts";

export type MainCiState = "green" | "red" | "optional" | "running" | "none";
export type MainCheck = { name: string; state: CheckState; url: string | null };

/** The suite's gate workflow names its checks "gate"; the CI fix stage reads the same names. */
export const GATE = /gate/i;

/**
 * red: a gate check failed (a repo without gate-named checks: any failed check not on the optional list).
 * running: something is pending and nothing blocks. optional: only non-blocking checks failed.
 * green: every check passed or was skipped. none: no checks.
 */
export function classify(checks: MainCheck[], optional: string[] = []): MainCiState {
  if (!checks.length) return "none";
  const failed = checks.filter((c) => c.state === "failure");
  const hasGate = checks.some((c) => GATE.test(c.name));
  const blocking = hasGate ? failed.filter((c) => GATE.test(c.name)) : failed.filter((c) => !optional.includes(c.name));
  if (blocking.length) return "red";
  if (checks.some((c) => c.state === "pending")) return "running";
  return failed.length ? "optional" : "green";
}

/** `settledState`: the head's last result (red, green or optional), kept while a rerun of its checks runs; null before it had one. */
export type HeadRow = { sha: string; state: MainCiState; settledState?: MainCiState | null; committedAt: string | null; headline: string | null; firstSeenAt: string; stateChangedAt: string };
export type Culprit = { sha: string; headline: string | null; pr: number | null };
/**
 * `state`: what the repo's default branch counts as for every decision and view. It is the newest head's own state, except while
 * that head's checks have not ended (running, or none in its first NONE_GRACE_MS): then the head's own last result, or else the
 * newest result before it, keeps the branch red when it is red. `settled`: the head `state` comes from. `redSince` and `culprit`
 * describe the red streak while `state` is red. `until`: when the branch stops counting as red with no new head or result (the
 * newest head's grace without checks ends); null when only a new result ends it.
 */
export type Derived = { current: HeadRow; state: MainCiState; settled: HeadRow; redSince: string | null; lastGreenSha: string | null; culprit: Culprit | null; until: number | null };

/** How long a head without checks may still be waiting for them to be registered; after that it is a head of a repo without CI. */
export const NONE_GRACE_MS = 10 * 60_000;

/** The PR a commit message names: "Merge pull request #N ..." or a trailing "(#N)". */
export function prNumberOf(headline: string | null): number | null {
  const m = /^Merge pull request #(\d+)\b/.exec(headline ?? "") ?? /\(#(\d+)\)\s*$/.exec(headline ?? "");
  return m ? Number(m[1]) : null;
}

const order = (a: HeadRow, b: HeadRow): number =>
  (a.committedAt ?? a.firstSeenAt).localeCompare(b.committedAt ?? b.firstSeenAt) || a.firstSeenAt.localeCompare(b.firstSeenAt);

const settles = (s: MainCiState | null | undefined): boolean => s === "red" || s === "green" || s === "optional";
/** A head's result: its state once its checks ended, else the last result it had. */
const resultOf = (r: HeadRow): MainCiState | null => (settles(r.state) ? r.state : settles(r.settledState) ? r.settledState! : null);

/**
 * From the heads seen for one repo: the current head (the newest), the state the branch counts as (Derived), the last green head,
 * and while the branch is red the culprit, the first red head after the last green or optional one, and when that head turned red.
 * Without such a head in the history the culprit is the oldest red head.
 */
export function derive(rows: HeadRow[], nowMs: number = Date.now()): Derived | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort(order);
  const current = sorted[sorted.length - 1]!;
  const greenAt = sorted.map(resultOf).lastIndexOf("green");
  const lastGreenSha = greenAt >= 0 ? sorted[greenAt]!.sha : null;
  const graceEnd = current.state === "none" ? Date.parse(current.firstSeenAt) + NONE_GRACE_MS : null;
  const checking = current.state === "running" || (graceEnd !== null && nowMs < graceEnd);
  const from = checking ? sorted.findLast((r) => resultOf(r) !== null) : undefined;
  const settled = from && resultOf(from) === "red" ? from : current;
  if (!(checking ? resultOf(settled) === "red" : current.state === "red")) return { current, state: current.state, settled, redSince: null, lastGreenSha, culprit: null, until: null };
  const okAt = sorted.findLastIndex((r) => resultOf(r) === "green" || resultOf(r) === "optional");
  const first = sorted.slice(okAt + 1).find((r) => resultOf(r) === "red") ?? settled;
  return { current, state: "red", settled, redSince: first.stateChangedAt, lastGreenSha, culprit: { sha: first.sha, headline: first.headline, pr: prNumberOf(first.headline) }, until: graceEnd };
}
