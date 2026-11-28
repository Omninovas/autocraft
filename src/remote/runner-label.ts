// How a Task Runner's label shows to people other than its owner: never the machine's hostname, which a label defaults to (device-login.ts).

/** The label, or null when it is the machine's hostname (or its first part). */
export function shownLabel(label: string | null, machine: { hostname?: string } | null): string | null {
  if (!label) return null;
  const host = String(machine?.hostname ?? "");
  const l = label.trim().toLowerCase();
  const h = host.trim().toLowerCase();
  return h && (l === h.slice(0, 60) || l === h.split(".")[0]) ? null : label;
}
