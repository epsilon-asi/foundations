import type { CredentialRef, Credentials, CredentialsProvider } from '../../src/auth/CredentialsProvider.js';

export class FakeCredentialsProvider implements CredentialsProvider {
  readonly requested: CredentialRef[] = [];

  constructor(private readonly credentials: Credentials = { username: 'user@example.com', password: 'secret' }) {}

  async getCredentials(ref: CredentialRef): Promise<Credentials> {
    this.requested.push(ref);
    return this.credentials;
  }
}
