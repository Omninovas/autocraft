// Once, for rows an earlier release wrote: an approved workflow it stopped only because its review counted changed lines outside the
// PR's purpose goes on running, with its merge approval as it was. Its question closes without an answer, and the next advance pass
// starts a new merge leg for the approver (advance.ts ensureLeg); what the review found that blocks still stops it there. A row someone
// answered or otherwise changed since is no longer stopped there and is left alone; one held at that blocker resumes with no question
// (src/data/workflow/rows.ts heldParams). Runs when the runner starts to lead (src/runner/index.ts), so no copy of the earlier release
// advances the workflows afterwards; this release writes no such row, so a second run finds nothing.
import { addAudit } from "../data/control/index.ts";
import { listWorkflows, moveWorkflows, recordEvents, type WorkflowPatch } from "../data/workflow/index.ts";
import type { Db } from "../db/index.ts";

const ACTOR = "pipeline";
const RETIRED_BLOCKER = "outside-purpose";
const LINE = "The question closed without an answer: changes outside the pull request's purpose no longer stop a merge a maintainer approved.";

/** Resumes the workflows stopped at the retired blocker; returns the `repo#number` of each one resumed. */
export async function resumeOutsideStops(db: Db, at = new Date().toISOString()): Promise<string[]> {
  return await db.write(async () => {
    const stopped = await listWorkflows(db, { states: ["blocked"], approved: true, storedBlockers: [RETIRED_BLOCKER] });
    if (!stopped.length) return [];
    const on: WorkflowPatch = { state: "running", rec: null, recAt: null, recHead: null, blocker: null, blockerParams: null };
    const moved = await moveWorkflows(db, stopped.map((w) => ({ id: w.id, patch: on, at, was: w })));
    const done = stopped.filter((w) => moved.has(w.id));
    await recordEvents(db, done.map((w) => ({ workflowId: w.id, repo: w.repo, number: w.number, login: ACTOR, via: "cli" as const, kind: "set" as const, line: w.rec ? `${LINE} ${w.rec.text}` : LINE, at })));
    await addAudit(db, done.map((w) => ({ login: ACTOR, action: "workflow-resume", target: `${w.repo}#${w.number}`, details: { workflow: w.id, blocker: RETIRED_BLOCKER, approvedBy: w.approvedBy, recHead: w.recHead } })));
    return done.map((w) => `${w.repo}#${w.number}`);
  });
}
