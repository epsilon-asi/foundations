import type { BrowserSession } from '../browser/BrowserSession.js';
import type { RuntimeConfig } from '../browser/RuntimeConfig.js';
import type { LoginFlowDefinition } from '../auth/LoginFlow.types.js';
import type { Extractor } from '../extraction/Extractor.js';
import type { Pagination } from '../extraction/Pagination.js';
import type { FormFiller } from '../interaction/Forms.js';
import type { HumanInteractor } from '../interaction/HumanInteractor.js';
import type { Navigator } from '../interaction/Navigation.js';
import type { PageAdapter } from '../interaction/PageAdapter.js';
import type { Logger } from '../logging/Logger.js';
import type { NativeAutomation } from '../native/types.js';

export interface ActorMetadata {
  id: string;
  baseUrl: string;
}

export interface AuthController {
  isLoggedIn(definition?: LoginFlowDefinition): Promise<boolean>;
  ensureAuthenticated(definition?: LoginFlowDefinition): Promise<void>;
}

export interface ActorContext {
  actor: ActorMetadata;
  config: RuntimeConfig;
  session: BrowserSession;
  page: PageAdapter;
  cursor: HumanInteractor;
  forms: FormFiller;
  nav: Navigator;
  extract: Extractor;
  pagination: Pagination;
  auth: AuthController;
  logger: Logger;
  native: NativeAutomation;
}