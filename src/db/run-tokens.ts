// Runs that a Task Runner leased before `agent_runs.token_id` existed get it from their call while the call is still kept
// (remote_calls holds a day, by `run_id` for its last lease); older runs keep none. One statement, which a second run finds
// nothing for. Runs on SQLite with backfill() (src/db.ts) and on Postgres inside migratePg (src/db/pg-triggers.ts).
import type { DatabaseSync } from "node:sqlite";
import type { PgClient } from "./pg-triggers.ts";

const STATEMENT = (main: string): string => `UPDATE ${main}agent_runs SET token_id = c.token_id FROM ${main}remote_calls c
  WHERE c.run_id = agent_runs.id AND c.token_id IS NOT NULL AND agent_runs.token_id IS NULL`;

export function backfillRunTokensSqlite(db: DatabaseSync): void {
  db.exec(STATEMENT("main."));
}

export async function backfillRunTokensPg(client: PgClient): Promise<void> {
  await client.query(STATEMENT(""));
}
