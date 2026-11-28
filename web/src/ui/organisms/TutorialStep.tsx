import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircleIcon, CircleIcon } from "@phosphor-icons/react";
import { t } from "../../../../src/i18n/index.ts";
import { Badge } from "../atoms/Badge";
import { cn } from "../cn";

/**
 * One numbered step of a tutorial: number, title, and a done mark where the app can tell (`done` undefined shows none), then the
 * content and the links to the full reference.
 */
export function TutorialStep({ id, n, title, done, refs, children }: {
  id: string;
  n: number;
  title: string;
  done?: boolean;
  refs?: { to: string; label: string }[];
  children: ReactNode;
}) {
  const head = `${id}-title`;
  return (
    <section id={id} aria-labelledby={head} className="flex scroll-mt-4 flex-col gap-2 border-t border-line pt-5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span aria-hidden className={cn("num flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", done ? "bg-ok/15 text-ok" : "bg-ink/[0.07] text-ink/70")}>
          {done ? <CheckCircleIcon weight="bold" /> : n}
        </span>
        <h2 id={head} className="text-md font-semibold">
          <span className="sr-only">{t("Step {n}:", { n })} </span>
          {title}
        </h2>
        {done !== undefined &&
          (done ? (
            <Badge tone="ok" icon={<CheckCircleIcon aria-hidden weight="bold" />}>{t("Done")}</Badge>
          ) : (
            <Badge icon={<CircleIcon aria-hidden />}>{t("Not done yet")}</Badge>
          ))}
      </div>
      <div className="flex min-w-0 flex-col gap-2 md:pl-[34px]">
        {children}
        {refs && refs.length > 0 && (
          <p className="text-sm">
            <span className="text-ink/70">{t("More in Help:")} </span>
            {refs.map((r, i) => (
              <span key={r.to}>
                {i > 0 && <span className="text-ink/40"> · </span>}
                <Link to={r.to} className="rounded text-accent-ink underline-offset-2 hover:underline">
                  {r.label}
                </Link>
              </span>
            ))}
          </p>
        )}
      </div>
    </section>
  );
}
