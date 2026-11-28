// Stats: what the pipeline got done, how main and the nightly checks stand, what it cost; the rest in folds.
// Maintainers and viewers see it as well as operators. Hosted views drop their own frame and heading (Embedded).
import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { TextLink } from "../../../ui/atoms/TextLink";
import { Headline } from "./Headline";
import { t } from "../../../../../src/i18n/index.ts";
import { Embedded } from "../../../ui/organisms/Page";
import { Fold } from "../../connect/Fold";
import { Overview } from "../../progress/views";
import { MainCiView } from "../../mainci/views";
import { NightlyView } from "../../nightly/views";
import { Cost } from "../../cost/views";
import { ActivityView } from "../../activity/views";
import { Classifiers } from "../../classifiers/views";
import { RatesView } from "../../rates/views";
import { Downloads } from "../../downloads/views";
import type { ViewProps } from "../../../registry/types";

/** A fold of Stats; `/stats#<id>` opens it and scrolls to it. */
function Details({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const named = useLocation().hash === `#${id}`;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (named) box.current?.scrollIntoView({ block: "start" });
  }, [named]);
  return (
    <div ref={box} id={id} className="scroll-mt-4 rounded-lg border border-line bg-panel px-3 py-1">
      <Fold key={String(named)} open={named} title={<span className="text-md font-semibold text-ink">{title}</span>}>
        <div className="pb-3">{children}</div>
      </Fold>
    </div>
  );
}

export function StatsView(props: ViewProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 pb-12 pt-5 md:px-6">
        <Headline />
        <Embedded>
          <div className="flex flex-col gap-2">
            <Details id="progress" title={t("Merged and closed")}>
              <Overview {...props} />
            </Details>
            <Details id="main-ci" title={t("Main CI")}>
              <MainCiView {...props} />
            </Details>
            <Details id="nightly" title={t("Nightly")}>
              <NightlyView />
            </Details>
            <Details id="cost" title={t("Cost")}>
              <Cost {...props} />
            </Details>
            <Details id="rates" title={t("Model calls")}>
              <div className="flex flex-col gap-6">
                <ActivityView />
                <RatesView />
                <TextLink to="/agents?state=finished" className="text-sm">{t("Model calls that ran, on the Agents page")}</TextLink>
              </div>
            </Details>
            <Details id="classifiers" title={t("Classifiers")}>
              <Classifiers {...props} />
            </Details>
            <Details id="downloads" title={t("Downloads")}>
              <Downloads {...props} />
            </Details>
          </div>
        </Embedded>
      </div>
    </div>
  );
}
