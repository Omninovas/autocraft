// Once: fix-ups held because the PR diff was over the fix-up's character limit are tried again. With a sandbox checkout the model
// reads the files itself and gets a trimmed diff (src/fixup/diff-view.ts), so the hold no longer applies there; without one the
// next try holds the PR again. Runs on SQLite with backfill() (src/db.ts) and on Postgres inside migratePg (src/db/pg-triggers.ts);
// the FIXUP_DIFF_RETRIED marker makes a second run change nothing.
import type { DatabaseSync } from "node:sqlite";
import type { PgClient } from "./pg-triggers.ts";

/** Part of the Postgres stamp, so a database migrated before this code reaches the migration; the marker decides whether it runs. */
export const FIXUP_DIFF_VERSION = 1;
export const FIXUP_DIFF_RETRIED = "fixup_diff_holds_retried";

const STATEMENTS = (main: string): string[] => {
  const undone = `NOT EXISTS (SELECT 1 FROM ${main}settings m WHERE m.key = '${FIXUP_DIFF_RETRIED}')`;
  return [
    `UPDATE ${main}fixups SET state = 'superseded' WHERE state = 'too-large' AND reason = 'the PR diff is over the 60000 character limit' AND ${undone}`,
    `INSERT INTO ${main}settings (key, value) VALUES ('${FIXUP_DIFF_RETRIED}', '1') ON CONFLICT (key) DO NOTHING`,
  ];
};

export function fixupDiffHeldSqlite(db: DatabaseSync): void {
  for (const q of STATEMENTS("main.")) db.exec(q);
}

export async function fixupDiffHeldPg(client: PgClient): Promise<void> {
  for (const q of STATEMENTS("")) await client.query(q);
}
