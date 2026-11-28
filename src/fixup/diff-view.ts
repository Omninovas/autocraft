// The PR diff a fix-up or CI fix model reads when it has a sandbox checkout. The model reads every file there, so a diff over the
// cap is no reason to hold the PR: it gets the sections of the files it is to edit, as many other sections as fit, and the rest by path.
import { splitDiff, type FileDiff } from "../review/diff.ts";

const LIST_HEAD = "Changed files not shown whole in this diff (read them in the checkout):\n";

/**
 * `text` whole when it fits `cap`; otherwise at most `cap` characters: first the changed files left out, by path (with a line counting
 * the `named` files among them or cut), then, in diff order, the sections of the `named` files and of as many other files as fit,
 * smallest first. When the named sections are over the cap, they are kept whole smallest first while they fit; the next keeps its
 * whole hunks in order within the room left, with a note of what it leaves out, and a named file whose header does not fit is listed.
 */
export function checkoutDiff(text: string, named: ReadonlySet<string>, cap: number): string {
  if (text.length <= cap) return text;
  const sections = splitDiff(text);
  const isNamed = (f: FileDiff) => named.has(f.path) || named.has(f.oldPath);
  // Room for the list as if every file were left out, so the sections never push the list past the cap; 1 for the blank line after it.
  const listRoom = Math.min(pathList(sections.map((f) => f.path), Infinity).length, Math.floor(cap / 4)) + namedLine(sections.length).length + 1;
  let room = cap - listRoom;
  const shown = new Map<FileDiff, string>();
  let cutNamed = 0;
  const bySize = (fs: FileDiff[]) => [...fs].sort((a, b) => a.text.length - b.text.length);
  const namedFiles = bySize(sections.filter(isNamed));
  for (const f of namedFiles) {
    const out = f.text.length <= room ? f.text : cutSection(f, room);
    if (out !== f.text) cutNamed++;
    if (out === null) continue;
    shown.set(f, out);
    // A cut section takes the room it was given: the rest go by path.
    room = out === f.text ? room - out.length : 0;
  }
  for (const f of bySize(sections.filter((x) => !isNamed(x)))) {
    if (f.text.length > room) break;
    shown.set(f, f.text);
    room -= f.text.length;
  }
  const left = sections.filter((f) => !shown.has(f) || shown.get(f) !== f.text).map((f) => f.path);
  const head = pathList(left, listRoom - 1 - namedLine(cutNamed).length) + (cutNamed ? namedLine(cutNamed) : "");
  return head + (head ? "\n" : "") + sections.flatMap((f) => (shown.has(f) ? [shown.get(f)!] : [])).join("");
}

const namedLine = (n: number): string => `(${n} of the files to edit are not shown whole; read them in the checkout)\n`;

/** The file's header and its hunks in order within `budget`, the first hunk cut at a line when none fits whole; null when the header does not fit. */
function cutSection(f: FileDiff, budget: number): string | null {
  const trim = (ls: string[]) => (ls.at(-1) === "" ? ls.slice(0, -1) : ls);
  const head = trim(f.head).join("\n") + "\n";
  const hunks: string[][] = [];
  for (const l of trim(f.body)) {
    if (l.startsWith("@@ ") || !hunks.length) hunks.push([l]);
    else hunks[hunks.length - 1]!.push(l);
  }
  const note = (left: number) => `(${left} of ${hunks.length} hunks of ${f.path} not shown whole; read the file in the checkout)\n`;
  const room = budget - head.length - note(hunks.length).length;
  if (room < 0) return null;
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
  return head + out.join("") + note(hunks.length - kept);
}

/** The paths, one a line, within `budget` characters; past it, a count of the rest. */
function pathList(paths: string[], budget: number): string {
  if (!paths.length) return "";
  const more = (n: number) => `- and ${n} more\n`;
  let out = LIST_HEAD;
  let n = 0;
  for (const p of paths) {
    const line = `- ${p}\n`;
    if (out.length + line.length + (n + 1 < paths.length ? more(paths.length).length : 0) > budget) break;
    out += line;
    n++;
  }
  return n < paths.length ? out + more(paths.length - n) : out;
}
