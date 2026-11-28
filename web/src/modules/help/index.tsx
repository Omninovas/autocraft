// Help: an index and short pages. Commands, controls, entries, blockers and weights are drawn
// from src/workflow/vocab.ts and status.ts, the same lists every surface uses.
import type { FeatureModule } from "../../registry/types";
import { lazyView } from "../../registry/lazyView";
import { t } from "../../../../src/i18n/index.ts";

const HelpView = lazyView(() => import("./views"), "HelpView");
const TutorialView = lazyView(() => import("./tutorial"), "TutorialView");

export const helpModule: FeatureModule = {
  id: "help",
  permission: "viewer",
  routes: [
    { path: "help/tutorial", view: { id: "help-tutorial", title: t("Get started"), phone: TutorialView, panels: [{ id: "main", title: t("Get started"), component: TutorialView, defaultSize: 100 }] } },
    { path: "help/:page?", view: { id: "help", title: t("Help"), phone: HelpView, panels: [{ id: "main", title: t("Help"), component: HelpView, defaultSize: 100 }] } },
  ],
};
