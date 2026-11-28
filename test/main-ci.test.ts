// CI on the default branch: the state of a head from its checks, the culprit and red_since from the heads seen,
// and what the branch counts as while its newest head's checks run.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { classify, derive, prNumberOf, type HeadRow, type MainCheck } from "../src/mainci/classify.ts";
import { mainCiRepos, redMainRepos } from "../src/mainci/index.ts";
import { decidePr } from "../src/core/decide.ts";
import { prFacts } from "./world.ts";
import { SCRATCH } from "./scratch.ts";
import { connectDb } from "./helpers/raw-db.ts";

const c = (name: string, state: MainCheck["state"]): MainCheck => ({ name, state, url: null });

test("classify: gate failures are red, optional failures are not, pending is running", () => {
  assert.equal(classify([]), "none");
  assert.equal(classify([c("gate / test", "success"), c("lint", "skipped")]), "green");
  assert.equal(classify([c("gate / test", "failure"), c("lint", "success")]), "red");
  assert.equal(classify([c("gate / test", "success"), c("sonar", "failure")]), "optional");
  assert.equal(classify([c("gate / test", "pending"), c("sonar", "failure")]), "running");
  assert.equal(classify([c("gate / test", "failure"), c("other", "pending")]), "red");
  assert.equal(classify([c("build", "failure")]), "red", "no gate check: any failure counts");
  assert.equal(classify([c("build", "success"), c("sonar", "failure")], ["sonar"]), "optional");
  assert.equal(classify([c("build", "failure"), c("sonar", "failure")], ["sonar"]), "red");
  assert.equal(classify([c("build", "success"), c("sonarcloud / SonarCloud Scan", "failure")], ["sonarcloud / SonarCloud Scan"]), "optional", "no gate check: only listed checks failed");
  assert.equal(classify([c("build", "success"), c("sonarcloud / SonarCloud Scan", "failure")]), "red", "unlisted");
});

test("prNumberOf reads merge commits and squash titles", () => {
  assert.equal(prNumberOf("Merge pull request #412 from fork/x"), 412);
  assert.equal(prNumberOf("Fix export (#88)"), 88);
  assert.equal(prNumberOf("Bump version"), null);
});

const row = (sha: string, state: HeadRow["state"], at: string): HeadRow => ({ sha, state, committedAt: at, headline: `Change ${sha} (#${sha.length})`, firstSeenAt: at, stateChangedAt: at });

test("derive: the culprit is the first red head after the last green one", () => {
  const d = derive([row("a", "green", "2026-01-01"), row("b", "running", "2026-01-02"), row("c", "red", "2026-01-03"), row("d", "red", "2026-01-04")])!;
  assert.equal(d.current.sha, "d");
  assert.equal(d.lastGreenSha, "a");
  assert.equal(d.culprit?.sha, "c");
  assert.equal(d.redSince, "2026-01-03");
  assert.equal(d.culprit?.pr, 1);
});

test("derive: a green head ends the red run; with no green head the oldest red head is the culprit", () => {
  const green = derive([row("a", "red", "2026-01-01"), row("b", "green", "2026-01-02")])!;
  assert.equal(green.redSince, null);
  assert.equal(green.culprit, null);
  assert.equal(green.lastGreenSha, "b");
  const never = derive([row("a", "red", "2026-01-01"), row("b", "red", "2026-01-02")])!;
  assert.equal(never.culprit?.sha, "a");
  assert.equal(never.lastGreenSha, null);
  assert.equal(derive([]), null);
});

test("a red branch stays red while a newer head's checks run, and holds a ready PR until a head goes green", async () => {
  mkdirSync(SCRATCH, { recursive: true });
  const db = await connectDb(join(mkdtempSync(join(SCRATCH, "main-ci-")), "t.db"));
  const at = (min: number) => new Date(Date.parse("2026-01-01T00:00:00Z") + min * 60_000).toISOString();
  const ms = (min: number) => Date.parse(at(min));
  await db.run(db.k.insertInto("tracked_repos").values({ name: "app", added_by: "op", added_at: at(0), pipeline: 1 }));
  const head = async (sha: string, min: number, state: string, failing: string[] = []) => await db.run(db.k.insertInto("main_ci").values({
    repo: "app", head_sha: sha, branch: "main", state, failing: JSON.stringify(failing.map((name) => ({ name, url: null }))), checks: "[]",
    committed_at: at(min), headline: `Change ${sha}`, first_seen_at: at(min), state_changed_at: at(min), updated_at: at(min),
  }));
  const decision = async (nowMs: number) => decidePr(prFacts({ repoFacts: { mainRed: (await redMainRepos(db, nowMs)).has("app") } }));

  await head("a", 0, "green");
  await head("b", 10, "red", ["gate / test"]);
  await head("c", 20, "running");
  await head("d", 30, "running");
  const held = await decision(ms(35));
  assert.deepEqual([held.state, held.actions.length], ["waiting-main-ci", 0]);
  const [row] = await mainCiRepos(db, [], ms(35));
  assert.deepEqual([row!.state, row!.headState, row!.headSha, row!.culprit?.sha, row!.failing.map((f) => f.name)], ["red", "running", "d", "b", ["gate / test"]]);

  // A head without checks may still be registering them; past that it is a repo without CI and holds nothing.
  await head("e", 40, "none");
  assert.equal((await decision(ms(45))).state, "waiting-main-ci");
  assert.notEqual((await decision(ms(60))).state, "waiting-main-ci");

  await head("f", 70, "green");
  assert.notEqual((await decision(ms(75))).state, "waiting-main-ci");
  assert.equal((await mainCiRepos(db, [], ms(75)))[0]!.culprit, null);
});
