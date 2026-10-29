import type { Actor, ActorTaskMap } from './Actor.js';

export function defineActor<TTasks extends ActorTaskMap>(actor: Actor<TTasks>): Actor<TTasks> {
  return actor;
}
