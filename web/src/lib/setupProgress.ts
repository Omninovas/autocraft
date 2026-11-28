// The setup steps the app can check for the signed-in maintainer or operator: a ready Task Runner, a linked Discord account.
// The setup banner (shell/SetupBanner.tsx) and the Get started page (modules/help/tutorial.tsx) read the same marks.
import { useQuery } from "../api/client";
import type { User } from "../api/types";

export type SetupCheck = { id: "runner" | "discord"; done: boolean };

export type SetupProgress = {
  /** Null while a check is still loading; a step that does not apply here (Discord without a bot) is left out. */
  checks: SetupCheck[] | null;
  done: number;
  dismissed: boolean;
};

export function useSetupProgress(user: User): SetupProgress {
  const staff = user.role !== "viewer";
  const runners = useQuery("runners", (a) => a.runners.list(), { enabled: staff });
  const discord = useQuery("discord-account", (a) => a.discord.account(), { enabled: staff });
  const settings = useQuery("my-settings", (a) => a.me.settings.get(), { enabled: staff });
  const loaded = staff && runners.data && discord.data && settings.data;
  const checks: SetupCheck[] | null = loaded
    ? [
        { id: "runner", done: runners.data!.runners.some((r) => r.fresh && r.readiness === "ready") },
        ...(discord.data!.configured || discord.data!.linked ? [{ id: "discord" as const, done: discord.data!.linked }] : []),
      ]
    : null;
  return { checks, done: checks?.filter((c) => c.done).length ?? 0, dismissed: !!settings.data?.setupDismissed };
}
