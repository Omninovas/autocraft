// The PR diff a fix-up model reads when it has a sandbox checkout. The model reads every file there, so a diff over the
// cap is no reason to hold the PR: it gets the sections of the files the fixes name and the other changed files by path.
import { splitDiff, type FileDiff } from "../review/diff.ts";

/** Room kept in a cut section for its note line. */
const NOTE_ROOM = 120;

/**
 * `text` whole when it fits `cap`. Otherwise the diff sections of the `named` files, in diff order, then a list of the
 * other changed files by path. When the named sections are over the cap too, each is cut to a fair share of it: whole
 * hunks in order while they fit, then a note of what was left out.
 */
export function checkoutDiff(text: string, named: ReadonlySet<string>, cap: number): string {
  if (text.length <= cap) return text;
  const sections = splitDiff(text);
  const kept = sections.filter((f) => named.has(f.path) || named.has(f.oldPath));
  const others = sections.filter((f) => !kept.includes(f)).map((f) => f.path);
  const list = pathList(others, Math.floor(cap / 4));
  const shown = new Map<FileDiff, string>();
  let room = cap - list.length;
  // Smallest first, so a short section stays whole and the long ones share what is left.
  const bySize = [...kept].sort((a, b) => a.text.length - b.text.length);
  bySize.forEach((f, i) => {
    const share = Math.max(0, Math.floor(room / (bySize.length - i)));
    const out = f.text.length <= share ? f.text : cutSection(f, share);
    shown.set(f, out);
    room -= out.length;
  });
  return kept.map((f) => shown.get(f)!).join("") + list;
}

/** The file's header and its hunks in order while they fit `budget`; the first hunk is cut at a line when none fits whole. */
function cutSection(f: FileDiff, budget: number): string {
  const trim = (ls: string[]) => (ls.at(-1) === "" ? ls.slice(0, -1) : ls);
  const head = trim(f.head).join("\n") + "\n";
  const hunks: string[][] = [];
  for (const l of trim(f.body)) {
    if (l.startsWith("@@ ") || !hunks.length) hunks.push([l]);
    else hunks[hunks.length - 1]!.push(l);
  }
  const room = budget - head.length - NOTE_ROOM;
  const out: string[] = [];
  let used = 0, kept = 0;
  for (const h of hunks) {
    const t = h.join("\n") + "\n";
    if (used + t.length > room) break;
    out.push(t);
    used += t.length;
    kept++;
  }
  if (kept === 0 && hunks.length) {
    for (const l of hunks[0]!) {
      if (used + l.length + 1 > room) break;
      out.push(l + "\n");
      used += l.length + 1;
    }
  }
  const left = hunks.length - kept;
  return head + out.join("") + `(${left} of ${hunks.length} hunks of ${f.path} not shown whole; read the file in the checkout)\n`;
}

/** The other changed files, one path a line, within `budget` characters. */
function pathList(paths: string[], budget: number): string {
  if (!paths.length) return "";
  let out = "\nOther changed files, by path only (read them in the checkout):\n";
  let n = 0;
  for (const p of paths) {
    const line = `- ${p}\n`;
    if (out.length + line.length > budget - 40) break;
    out += line;
    n++;
  }
  if (n < paths.length) out += `- and ${paths.length - n} more\n`;
  return out;
}
