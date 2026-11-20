/** An invalid resource declaration, detected when the resource is defined. */
export class ResourceDefinitionError extends TypeError {
  override readonly name = 'ResourceDefinitionError';
}
