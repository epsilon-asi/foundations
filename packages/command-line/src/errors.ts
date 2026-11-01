/** A mistake in how a command class is declared. Thrown when the tree is described or built, never at parse time. */
export class CliDefinitionError extends Error {
  public readonly className: string;

  public constructor(target: Function, message: string) {
    const className = target.name === '' ? '<anonymous class>' : target.name;
    super(`${className}: ${message}`);
    this.name = 'CliDefinitionError';
    this.className = className;
  }
}
