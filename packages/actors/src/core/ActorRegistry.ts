import { ConfigError } from '../errors/ConfigError.js';
import type { Actor, ActorTaskMap } from './Actor.js';

export class ActorRegistry {
  private readonly actors = new Map<string, Actor>();

  register<TTasks extends ActorTaskMap>(actor: Actor<TTasks>): this {
    if (this.actors.has(actor.id)) {
      throw new ConfigError(`Actor already registered: ${actor.id}`);
    }
    this.actors.set(actor.id, actor as Actor);
    return this;
  }

  get(actorId: string): Actor {
    const actor = this.actors.get(actorId);
    if (actor === undefined) {
      throw new ConfigError(`No actor registered with id: ${actorId}`);
    }
    return actor;
  }

  list(): Actor[] {
    return [...this.actors.values()];
  }
}
