// CI on the default branches on fake data: green, red (with a culprit), red while the newest head checks, optional failing, running and no CI.
import type { MainCi, MainCiRepo, MainCiSummary } from "../types";
import { NOW } from "./fixtures";

const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();
const base = { branch: "main", failing: [] as MainCiRepo["failing"], redSince: null, lastGreenSha: null, culprit: null, autocraft: null as string | null };

// A function, because fixtures.ts imports this file and NOW is not set yet while the modules load.
const repos = (): MainCiRepo[] => ([
  {
    ...base, repo: "designcraft", state: "red", headSha: "9f3c1a77d0b2", headline: "Merge pull request #412 from fork/export-fix", committedAt: iso(95), updatedAt: iso(1),
    failing: [{ name: "gate / test", url: "https://example.test/runs/1001" }], redSince: iso(88), lastGreenSha: "41be90c2aa17",
    culprit: { sha: "9f3c1a77d0b2", headline: "Merge pull request #412 from fork/export-fix", pr: 412 }, autocraft: "rerunning failed jobs",
  },
  {
    ...base, repo: "photocraft", state: "optional", headSha: "c0a81e5b3d44", headline: "Update icons (#233)", committedAt: iso(300), updatedAt: iso(1),
    failing: [{ name: "SonarCloud", url: "https://example.test/runs/1002" }], lastGreenSha: "c0a81e5b3d44",
  },
  {
    ...base, repo: "textcraft", state: "red", headState: "running", headSha: "a4d09c3e7b12", headline: "Merge pull request #97 from fork/kerning", committedAt: iso(8), updatedAt: iso(1),
    failing: [{ name: "gate / build", url: "https://example.test/runs/1003" }], redSince: iso(40), lastGreenSha: "5be1f07d9a20",
    culprit: { sha: "3f8e21c6d4a9", headline: "Bump the renderer (#95)", pr: 95 }, autocraft: "needs a fix",
  },
  { ...base, repo: "pdfcraft", state: "running", headSha: "7d12ab90ee31", headline: "Fix page breaks (#88)", committedAt: iso(6), updatedAt: iso(1) },
  { ...base, repo: "indd-utils", state: "none", headSha: "0b77e4d9c150", headline: "Bump version", committedAt: iso(4000), updatedAt: iso(1) },
  { ...base, repo: "craft-libs", state: "green", headSha: "e5a2290f7c61", headline: "Add table widget (#251)", committedAt: iso(500), updatedAt: iso(1), lastGreenSha: "e5a2290f7c61" },
] as (Omit<MainCiRepo, "headState"> & { headState?: MainCiRepo["headState"] })[]).map((r) => ({ ...r, headState: r.headState ?? r.state }));

export function mainCiSummary(): MainCiSummary {
  const s: MainCiSummary = { green: 0, red: 0, optional: 0, running: 0, none: 0 };
  for (const r of repos()) s[r.state]++;
  return s;
}

export const mainCi = (): MainCi => ({ summary: mainCiSummary(), repos: repos() });
