/** An invalid endpoint declaration, detected when the API is defined. */
export class ApiDefinitionError extends TypeError {
  override readonly name = 'ApiDefinitionError';
}
