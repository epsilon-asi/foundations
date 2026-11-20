import { ApiDefinitionError } from './ApiDefinitionError.js';
import { routePathKey } from './pathParameterNames.js';

export interface RouteDeclaration {
  method: string;
  path: string;
  /** Endpoint name included in collision diagnostics when available. */
  name?: string;
}

/** Checks the assembled route declarations before registering any handlers. */
export function assertUniqueRoutes<Route extends RouteDeclaration>(routes: readonly Route[]): void {
  const seen = new Map<string, RouteDeclaration>();
  for (const route of routes) {
    const method = route.method.toUpperCase();
    const key = `${method} ${routePathKey(route.path)}`;
    const previous = seen.get(key);
    if (previous) {
      const names = [previous.name, route.name].filter(Boolean).join(', ');
      throw new ApiDefinitionError(`Endpoints declare duplicate route ${method} ${route.path}${names ? ` (${names})` : ''}.`);
    }
    seen.set(key, route);
  }
}
