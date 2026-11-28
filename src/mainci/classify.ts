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

export type HeadRow = { sha: string; state: MainCiState; committedAt: string | null; headline: string | null; firstSeenAt: string; stateChangedAt: string };
export type Culprit = { sha: string; headline: string | null; pr: number | null };
/**
 * `state`: what the repo's default branch counts as for every decision and view. It is the newest head's own state, except while
 * that head's checks have not ended (running, or none in its first NONE_GRACE_MS): then a red newest settled head before it keeps
 * the branch red. `settled`: the head `state` comes from. `redSince` and `culprit` describe the red streak while `state` is red.
 */
export type Derived = { current: HeadRow; state: MainCiState; settled: HeadRow; redSince: string | null; lastGreenSha: string | null; culprit: Culprit | null };

/** How long a head without checks may still be waiting for them to be registered; after that it is a head of a repo without CI. */
export const NONE_GRACE_MS = 10 * 60_000;

/** The PR a commit message names: "Merge pull request #N ..." or a trailing "(#N)". */
export function prNumberOf(headline: string | null): number | null {
  const m = /^Merge pull request #(\d+)\b/.exec(headline ?? "") ?? /\(#(\d+)\)\s*$/.exec(headline ?? "");
  return m ? Number(m[1]) : null;
}

const order = (a: HeadRow, b: HeadRow): number =>
  (a.committedAt ?? a.firstSeenAt).localeCompare(b.committedAt ?? b.firstSeenAt) || a.firstSeenAt.localeCompare(b.firstSeenAt);

const settles = (s: MainCiState): boolean => s === "red" || s === "green" || s === "optional";

/**
 * From the heads seen for one repo: the current head (the newest), the state the branch counts as (Derived), the last green head,
 * and while the branch is red the culprit, the first red head after the last green or optional one, and when that head turned red.
 * Without such a head in the history the culprit is the oldest red head.
 */
export function derive(rows: HeadRow[], nowMs: number = Date.now()): Derived | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort(order);
  const current = sorted[sorted.length - 1]!;
  const greenAt = sorted.map((r) => r.state).lastIndexOf("green");
  const lastGreenSha = greenAt >= 0 ? sorted[greenAt]!.sha : null;
  const checking = current.state === "running" || (current.state === "none" && nowMs - Date.parse(current.firstSeenAt) < NONE_GRACE_MS);
  const before = checking ? sorted.findLast((r) => settles(r.state)) : undefined;
  const settled = before?.state === "red" ? before : current;
  if (settled.state !== "red") return { current, state: current.state, settled, redSince: null, lastGreenSha, culprit: null };
  const okAt = sorted.findLastIndex((r) => r.state === "green" || r.state === "optional");
  const first = sorted.slice(okAt + 1).find((r) => r.state === "red") ?? settled;
  return { current, state: "red", settled, redSince: first.stateChangedAt, lastGreenSha, culprit: { sha: first.sha, headline: first.headline, pr: prNumberOf(first.headline) } };
}
