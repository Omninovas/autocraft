import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { RocketLaunchIcon, XIcon } from "@phosphor-icons/react";
import { t } from "../../../src/i18n/index.ts";
import { useApi } from "../api/client";
import type { User } from "../api/types";
import { useSetupProgress } from "../lib/setupProgress";
import { Button } from "../ui/atoms/Button";
import { TextLink } from "../ui/atoms/TextLink";
import { useIsPhone } from "./useMedia";

export const TUTORIAL_PATH = "/help/tutorial";

/**
 * A slim bar over the page for maintainers and operators while a checkable setup step (a ready Task Runner, a linked Discord
 * account) is not done: how far they are, a link to Get started and Dismiss, stored server-side (`setupDismissed`). It appears
 * once the checks have loaded and stays through navigation, except on the Get started page itself. The live region says it once.
 */
export function SetupBanner({ user }: { user: User }) {
  const api = useApi();
  const phone = useIsPhone();
  const { pathname } = useLocation();
  const { checks, done, dismissed } = useSetupProgress(user);
  const [hidden, setHidden] = useState(false);
  const [said, setSaid] = useState("");
  const announced = useRef(false);
  const open = user.role !== "viewer" && !!checks && done < checks.length && !dismissed && !hidden;
  const count = checks ? t("{done} of {all} done", { done, all: checks.length }) : "";
  const line = t("Finish setting up AutoCraft · {count}", { count });
  const shown = open && pathname !== TUTORIAL_PATH;

  useEffect(() => {
    if (shown && !announced.current) {
      announced.current = true;
      setSaid(line);
    }
  }, [shown, line]);

  const dismiss = () => {
    setHidden(true);
    setSaid(t("Setup reminder dismissed. Get started stays in Help."));
    api.me.settings.put({ setupDismissed: true }).catch(() => setHidden(false));
  };

  return (
    <>
      <div role="status" className="sr-only">{said}</div>
      {shown && (
        <section aria-label={t("Setup")} className="flex min-h-10 shrink-0 items-center gap-x-3 border-b border-line bg-accent/10 pl-4 pr-1.5 text-sm max-md:pl-3 max-md:pr-0">
          <RocketLaunchIcon aria-hidden className="shrink-0 text-accent-ink" />
          <p className="min-w-0 flex-1 py-1.5">
            {t("Finish setting up AutoCraft")} · <span className="whitespace-nowrap">{count}</span>
          </p>
          <TextLink to={TUTORIAL_PATH} className="inline-flex h-8 shrink-0 items-center rounded px-1.5 font-medium max-md:h-11">
            {t("Get started")}
          </TextLink>
          {phone ? (
            <Button variant="ghost" onClick={dismiss} aria-label={t("Dismiss")} className="size-11 px-0">
              <XIcon aria-hidden />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={dismiss}>
              {t("Dismiss")}
            </Button>
          )}
        </section>
      )}
    </>
  );
}
