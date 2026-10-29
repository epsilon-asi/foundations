import { AuthError } from '../errors/AuthError.js';

export interface Credentials {
  username: string;
  password: string;
  accountId?: string;
}

export interface CredentialRef {
  id: string;
  usernameEnv?: string;
  passwordEnv?: string;
}

export interface CredentialsProvider {
  getCredentials(ref: CredentialRef): Promise<Credentials>;
}

export class EnvCredentialsProvider implements CredentialsProvider {
  async getCredentials(ref: CredentialRef): Promise<Credentials> {
    const usernameKey = ref.usernameEnv ?? `${ref.id.toUpperCase()}_USERNAME`;
    const passwordKey = ref.passwordEnv ?? `${ref.id.toUpperCase()}_PASSWORD`;
    const username = process.env[usernameKey];
    const password = process.env[passwordKey];

    if (username === undefined || username.length === 0) {
      throw new AuthError(`Missing username environment variable: ${usernameKey}`);
    }

    if (password === undefined || password.length === 0) {
      throw new AuthError(`Missing password environment variable: ${passwordKey}`);
    }

    return { username, password, accountId: ref.id };
  }
}

export class StaticCredentialsProvider implements CredentialsProvider {
  constructor(private readonly credentials: Record<string, Credentials>) {}

  async getCredentials(ref: CredentialRef): Promise<Credentials> {
    const credential = this.credentials[ref.id];
    if (credential === undefined) {
      throw new AuthError(`No static credentials registered for credential id: ${ref.id}`);
    }
    return credential;
  }
}
