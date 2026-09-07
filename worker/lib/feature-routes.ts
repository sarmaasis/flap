/**
 * Registers feature route modules (saved views, disposables, domain controls, etc.).
 */
import type { Hono } from "hono";
import type { AppEnv } from "./plan-guard";
import { registerAutomationRoutes } from "./automation";
import { registerCollaborationExtraRoutes } from "./collaboration-extras";
import { registerContactFormRoutes } from "./contact-forms";
import { registerDisposableRoutes } from "./disposables";
import { registerDomainControlRoutes } from "./domain-controls";
import { registerNotifyChannelRoutes } from "./notify-channels";
import { registerOnboardingToolRoutes } from "./onboarding-tools";
import { registerPrefsExtraRoutes } from "./prefs-extra";
import { registerSavedViewRoutes } from "./saved-views";
import { registerCalDavRoutes } from "./caldav";
import { registerStudioChannelRoutes } from "./studio-channels";

export function registerFeatureRoutes(app: Hono<AppEnv>) {
  registerSavedViewRoutes(app);
  registerDisposableRoutes(app);
  registerNotifyChannelRoutes(app);
  registerDomainControlRoutes(app);
  registerCollaborationExtraRoutes(app);
  registerContactFormRoutes(app);
  registerAutomationRoutes(app);
  registerPrefsExtraRoutes(app);
  registerOnboardingToolRoutes(app);
  registerStudioChannelRoutes(app);
  registerCalDavRoutes(app);
}
