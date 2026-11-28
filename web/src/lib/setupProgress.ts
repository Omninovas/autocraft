// The setup steps the app can check for the signed-in maintainer or operator: a ready Task Runner, a linked Discord account.
// The setup banner (shell/SetupBanner.tsx) and the Get started page (modules/help/tutorial.tsx) read the same marks.
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useApi, useQuery } from "../api/client";
import type { MySettings, User } from "../api/types";

export type SetupCheck = { id: "runner" | "discord"; done: boolean };

export type SetupProgress = {
  /** Null while a check is still loading or not read; a step that does not apply here (Discord without a bot) is left out. */
  checks: SetupCheck[] | null;
  done: number;
  dismissed: boolean;
};

/**
 * `always`: read the checks also after the person dismissed the banner (the Get started page); the banner reads them only
 * while it may show. Viewers read nothing.
 */
export function useSetupProgress(user: User, { always = false }: { always?: boolean } = {}): SetupProgress {
  const staff = user.role !== "viewer";
  const settings = useQuery("my-settings", (a) => a.me.settings.get(), { enabled: staff });
  const dismissed = !!settings.data?.setupDismissed;
  const read = staff && (always || (!!settings.data && !dismissed));
  const runners = useQuery("runners", (a) => a.runners.list(), { enabled: read });
  const discord = useQuery("discord-account", (a) => a.discord.account(), { enabled: read });
  const checks: SetupCheck[] | null = read && runners.data && discord.data
    ? [
        { id: "runner", done: runners.data.runners.some((r) => r.fresh && r.readiness === "ready") },
        ...(discord.data.configured || discord.data.linked ? [{ id: "discord" as const, done: discord.data.linked }] : []),
      ]
    : null;
  return { checks, done: checks?.filter((c) => c.done).length ?? 0, dismissed };
}

/** Stores the dismissal and writes it into every cached copy of the settings, so the banner stays away on a remount before the refetch. */
export function useDismissSetup(): () => Promise<void> {
  const api = useApi();
  const qc = useQueryClient();
  return useCallback(async () => {
    await api.me.settings.put({ setupDismissed: true });
    qc.setQueriesData<MySettings>({ queryKey: ["my-settings"] }, (s) => (s ? { ...s, setupDismissed: true } : s));
  }, [api, qc]);
}
