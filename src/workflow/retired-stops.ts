// Once, for rows an earlier release wrote: an approved workflow it stopped at a stop that no longer stops a merge a maintainer approved
// (src/data/workflow/rows.ts retiredStop: changes outside the PR's purpose, a large fix, a major finding, work beyond what was agreed, the
// limit of our pushes, a failed verification, a screenshot regression, review fixes nobody makes) goes on running, with its merge approval as it was. Its question
// closes without an answer, and the next advance pass starts a new merge leg for the approver (advance.ts ensureLeg): what that leg finds is
// fixed before the merge (advance.ts fixFirst), and only a fix that cannot be made comes back. A row someone answered or otherwise changed
// since is no longer stopped there and is left alone; one held at such a stop resumes with no question (rows.ts heldParams). Runs when the
// runner starts to lead (src/runner/index.ts), so no copy of the earlier release advances the workflows afterwards; this release writes no
// such row, so a second run finds nothing.
import { addAudit } from "../data/control/index.ts";
import { listWorkflows, moveWorkflows, recordEvents, RETIRED_BLOCKERS, retiredStop, type WorkflowPatch } from "../data/workflow/index.ts";
import type { Db } from "../db/index.ts";

const ACTOR = "pipeline";
const LINE = "The question closed without an answer: a merge a maintainer approved goes on to its fixes and the merge without asking again.";

/** Resumes the approved workflows stopped at a retired stop; returns the `repo#number` of each one resumed. */
export async function resumeRetiredStops(db: Db, at = new Date().toISOString()): Promise<string[]> {
  return await db.write(async () => {
    const retired = await listWorkflows(db, { states: ["blocked"], approved: true, storedBlockers: [...RETIRED_BLOCKERS] });
    // `other` rows are told apart by their params; the mapper reads a retired blocker as `other` too, so these come from their own query.
    const other = (await listWorkflows(db, { states: ["blocked"], approved: true, storedBlockers: ["other"] })).filter((w) => retiredStop("other", w.blockerParams));
    const stopped = [...retired, ...other];
    if (!stopped.length) return [];
    const on: WorkflowPatch = { state: "running", rec: null, recAt: null, recHead: null, blocker: null, blockerParams: null };
    const moved = await moveWorkflows(db, stopped.map((w) => ({ id: w.id, patch: on, at, was: w })));
    const done = stopped.filter((w) => moved.has(w.id));
    await recordEvents(db, done.map((w) => ({ workflowId: w.id, repo: w.repo, number: w.number, login: ACTOR, via: "cli" as const, kind: "set" as const, line: w.rec ? `${LINE} ${w.rec.text}` : LINE, at })));
    await addAudit(db, done.map((w) => ({ login: ACTOR, action: "workflow-resume", target: `${w.repo}#${w.number}`, details: { workflow: w.id, stop: retired.includes(w) ? "retired-blocker" : String(w.blockerParams?.limit ?? w.blockerParams?.code ?? "other"), approvedBy: w.approvedBy, recHead: w.recHead } })));
    return done.map((w) => `${w.repo}#${w.number}`);
  });
}
