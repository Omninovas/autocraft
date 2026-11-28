// The Items page: a paged browser over every item of the visible repos, with a qualifier search, views, quick filters
// and a command box for several items at once. On desktop the item in `?open=` shows in a resizable panel beside the list.
import type { FeatureModule, PanelDef } from "../../../registry/types";
import { lazyView } from "../../../registry/lazyView";
import { t } from "../../../../../src/i18n/index.ts";

const ItemsView = lazyView(() => import("./views"), "ItemsView");
const ItemPanel = lazyView(() => import("./ItemPanel"), "ItemPanel");

// Phones use `phone` (the list alone; a row opens the item page), so the panel shows on desktop only.
const panels: PanelDef[] = [
  { id: "main", title: t("Items"), component: ItemsView, defaultSize: 58, minSize: 36 },
  { id: "item", title: t("Item"), component: ItemPanel, defaultSize: 42, minSize: 28, collapsible: true },
];

export const maintainItemsModule: FeatureModule = {
  id: "maintain-items",
  permission: "viewer",
  commands: [{ id: "go-items", keys: "g i", label: t("Go to items"), group: "Go to" }],
  routes: [
    { path: "items", scoped: true, view: { id: "maintain-items", title: t("Items"), phone: ItemsView, panels } },
    // Older links to a filtered list open the same page.
    { path: "items/filters", scoped: true, view: { id: "maintain-items-filters", title: t("Items"), phone: ItemsView, panels } },
  ],
};
