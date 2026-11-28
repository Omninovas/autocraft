// The list of feature modules. Adding a feature means adding its module here; the shell builds routes, panels and shortcut help
// from these declarations.
import type { FeatureModule } from "./types";
import { setListPages } from "../api/scope";
import { maintainHomeModule } from "../modules/maintain/home";
import { maintainQueueModule } from "../modules/maintain/queue";
import { maintainStatsModule } from "../modules/maintain/stats";
import { maintainItemsModule } from "../modules/maintain/items";
import { maintainItemModule } from "../modules/maintain/item";
import { helpModule } from "../modules/help";
import { runnerModule } from "../modules/runner";
import { referenceModule } from "../modules/reference";
import { adminHubModule } from "../modules/admin/hub";
import { auditModule, contributorsModule } from "../modules/admin";
import { nextModule } from "../modules/next";
import { agentsModule } from "../modules/agents";
import { workspacesModule } from "../modules/workspaces";
import { activityModule } from "../modules/activity";
import { connectModule } from "../modules/connect";
import { pipelineModule } from "../modules/pipeline";
import { mainCiModule } from "../modules/mainci";
import { batchModule } from "../modules/batch";
import { securityModule } from "../modules/security";
import { similarModule } from "../modules/similar";

export const modules: FeatureModule[] = [
  maintainHomeModule,
  maintainQueueModule,
  maintainStatsModule,
  helpModule,
  runnerModule,
  maintainItemsModule,
  maintainItemModule,
  referenceModule,
  adminHubModule,
  nextModule,
  agentsModule,
  workspacesModule,
  activityModule,
  contributorsModule,
  auditModule,
  connectModule,
  pipelineModule,
  mainCiModule,
  batchModule,
  securityModule,
  similarModule,
];

setListPages(modules.flatMap((m) => m.routes.filter((r) => r.scoped).map((r) => r.path)));
