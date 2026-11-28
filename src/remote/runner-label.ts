// How a Task Runner's label shows to people other than its owner: never the machine's hostname, which a label defaults to (device-login.ts).

/** The label, or null when it is the machine's hostname (or its first part). */
export function shownLabel(label: string | null, machine: { hostname?: string } | null): string | null {
  if (!label) return null;
  const host = String(machine?.hostname ?? "");
  const l = label.trim().toLowerCase();
  const h = host.trim().toLowerCase();
  return h && (l === h.slice(0, 60) || l === h.split(".")[0]) ? null : label;
}

/** A Task Runner as runnerLabelFor reads it: its owner, label, machine, and whether the owner keeps their runners private. */
export type RunnerName = { login: string; label: string | null; machine: { hostname?: string } | null; private: boolean };

/**
 * The label of a Task Runner as `reader` may see it: their own runners' labels as they are; another person's only when that person
 * does not keep their runners private and the label is not the machine's hostname. Null: the reader may not see it.
 */
export function runnerLabelFor(n: RunnerName, reader: string | null): string | null {
  if (!n.label) return null;
  if (reader !== null && n.login.toLowerCase() === reader.toLowerCase()) return n.label;
  return n.private ? null : shownLabel(n.label, n.machine);
}
