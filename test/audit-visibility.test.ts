// The audit log a maintainer reads (src/dash/api/admin.ts auditLog): no row of a repo they cannot see, no operator-only action.
import assert from "node:assert/strict";
import { test } from "node:test";
import { auditLog } from "../src/dash/api/admin.ts";
import { addAudit } from "../src/data/control/index.ts";
import { connectDb } from "./helpers/raw-db.ts";

const T = "2026-11-01T00:00:00.000Z";
const as = (role: string) => ({
  method: "GET", path: "", params: {}, query: new URLSearchParams(), form: new URLSearchParams(), csrf: "", nonce: "",
  user: { login: "u1", role, canWrite: async () => false, canRead: async (r: string) => r === "app" },
}) as never;

test("a maintainer's audit log leaves out rows of repos they cannot see and the abuse protections", async () => {
  const db = await connectDb(":memory:");
  await db.run(db.k.insertInto("repos").values([{ name: "app", visibility: "private" }, { name: "secret", visibility: "private" }]));
  await db.run(db.k.insertInto("tracked_repos").values([{ name: "app", added_by: "op", added_at: T, pipeline: 1 }, { name: "secret", added_by: "op", added_at: T, pipeline: 1 }]));
  await addAudit(db, [
    { login: "m", action: "merge", target: "app#1", at: T },
    { login: "m", action: "merge", target: "secret#2", at: T },
    { login: "m", action: "fixup-push", target: "secret#3@1a2b3c4d", at: T },
    { login: "m", action: "repo-pipeline", target: "secret", at: T },
    { login: "m", action: "security-scan-start", target: "secret:scan:1", at: T },
    { login: "m", action: "merge-release", target: "merge:secret", at: T },
    { login: "op", action: "abuse-limits", target: null, at: T },
  ]);
  const seen = (await auditLog(db, as("maintainer"))).entries.map((e) => `${e.action} ${e.target}`);
  assert.deepEqual(seen, ["merge app#1"]);
  assert.ok((await auditLog(db, as("operator"))).entries.length > seen.length);
});
