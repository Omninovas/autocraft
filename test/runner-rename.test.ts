// Renaming a Task Runner: its owner renames their own and an operator anyone's; nobody else, and the name is trimmed, 1 to 64 characters, and audited.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import * as runners from "../src/dash/api/runners.ts";
import { createToken } from "../src/dash/mcp/tokens.ts";
import { HttpError } from "../src/dash/server/util.ts";
import type { Req, Role } from "../src/dash/types.ts";
import { SCRATCH } from "./scratch.ts";
import { connectDb } from "./helpers/raw-db.ts";

mkdirSync(SCRATCH, { recursive: true });
const dir = mkdtempSync(join(SCRATCH, "runner-rename-"));
after(() => rmSync(dir, { recursive: true, force: true }));

test("a Task Runner is renamed by its owner or an operator only", async () => {
  const db = await connectDb(join(dir, "t.db"));
  for (const [login, role] of [["alice", "maintainer"], ["bob", "maintainer"], ["olga", "operator"]] as const) await db.run(db.k.insertInto("access").values({ login, role }));
  const id = (await createToken(db, "alice", "box-17", { kind: "runner" })).row.id;
  const req = (login: string, role: Role, json: unknown) => ({ user: { login, role, canWrite: async () => true, canRead: async () => true }, params: {}, query: new URLSearchParams(), json }) as unknown as Req;
  const label = async () => (await db.get(db.k.selectFrom("mcp_tokens").select("label").where("id", "=", id)))?.label;
  const refused = async (login: string, role: Role, json: unknown, status: number) =>
    await assert.rejects(runners.rename(db, req(login, role, json)), (e: unknown) => e instanceof HttpError && e.status === status);

  await refused("bob", "maintainer", { id, label: "taken over" }, 404);
  assert.equal(await label(), "box-17", "another maintainer cannot rename it");

  await runners.rename(db, req("alice", "maintainer", { id, label: "  runner-1  " }));
  assert.equal(await label(), "runner-1", "the owner renames it, trimmed");

  await runners.rename(db, req("olga", "operator", { id, label: "runner-2" }));
  assert.equal(await label(), "runner-2", "an operator renames anyone's");

  await refused("alice", "maintainer", { id, label: "   " }, 400);
  await refused("alice", "maintainer", { id, label: "x".repeat(65) }, 400);
  assert.equal(await label(), "runner-2");

  const rows = await db.prepare("SELECT login, target, details FROM audit WHERE action = 'runner-rename' ORDER BY rowid").all() as { login: string; target: string; details: string }[];
  assert.deepEqual(rows.map((r) => [r.login, r.target, JSON.parse(r.details).from, JSON.parse(r.details).to]), [["alice", "alice", "box-17", "runner-1"], ["olga", "alice", "runner-1", "runner-2"]]);
  await db.close();
});
