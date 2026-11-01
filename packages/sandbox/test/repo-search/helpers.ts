import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach } from 'vitest';
import { SearchDocumentStore } from '../../src/repo-search/core/searchDocumentStore.js';
import type { RepoFileEntry, SearchDocument } from '../../src/repo-search/types.js';
import { extensionOf, languageForPath } from '../../src/repo-search/utils/path.js';
import { splitLines } from '../../src/repo-search/utils/text.js';

const roots: string[] = [];

export async function makeTempRoot(prefix = 'lrs-'): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
}

export async function writeFile(root: string, repoPath: string, content: string | Uint8Array): Promise<void> {
  const absolutePath = path.join(root, repoPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content);
}

/** An in-memory document rooted at `/repo`; the language defaults to the one inferred from the path. */
export function makeDocument(
  repoPath: string,
  text: string,
  language = languageForPath(repoPath),
  id = 0,
): SearchDocument {
  return {
    id,
    path: repoPath,
    absolutePath: `/repo/${repoPath}`,
    language,
    text,
    lines: splitLines(text),
    size: text.length,
    mtimeMs: 1,
  };
}

/** A store over in-memory documents with sequential ids. */
export function makeStore(documents: readonly SearchDocument[]): SearchDocumentStore {
  return new SearchDocumentStore(documents.map((document, id) => ({ ...document, id })));
}

export function makeFileEntry(repoPath: string, absolutePath = `/repo/${repoPath}`): RepoFileEntry {
  return {
    path: repoPath,
    absolutePath,
    size: 12,
    mtimeMs: 1,
    extension: extensionOf(repoPath),
    language: languageForPath(repoPath),
  };
}

export async function makeFixtureRepo(): Promise<string> {
  const root = await makeTempRoot('lrs-fixture-');
  await writeFile(
    root,
    'src/auth.ts',
    `
import { auditLog } from './logger';
import type { User } from './types';
export class AuthService {
  validatePermission(user: User, action: string): boolean {
    auditLog('permission-check', user.id);
    return user.roles.includes('admin') || action === 'read';
  }
}
export const validateToken = async (token: string) => token === 'secret-token';
export function routeGuard(user: User) {
  return new AuthService().validatePermission(user, 'read');
}
`,
  );
  await writeFile(
    root,
    'src/logger.ts',
    `
export function auditLog(event: string, userId: string) {
  console.log(event, userId);
}
`,
  );
  await writeFile(root, 'src/types.ts', `export interface User { id: string; roles: string[] }\n`);
  await writeFile(
    root,
    'src/routes.ts',
    `
import { routeGuard, validateToken } from './auth';
export function registerRoutes(app: any) {
  app.get('/admin', routeGuard);
  return validateToken('secret-token');
}
`,
  );
  await writeFile(
    root,
    'tests/auth.test.ts',
    `
import { routeGuard } from '../src/auth';
it('allows reads', () => expect(routeGuard({ id: 'u1', roles: [] })).toBe(true));
`,
  );
  await writeFile(
    root,
    'python/app.py',
    `
import os
from services.auth import check_user
class PythonAuth:
    def login(self, name):
        return check_user(name)
CONSTANT_VALUE = 42
`,
  );
  await writeFile(
    root,
    'go/main.go',
    `
package main
import (
  "fmt"
  alias "example.com/project/lib"
)
type Server struct {}
func StartServer() {
  fmt.Println("starting")
}
`,
  );
  await writeFile(
    root,
    'rust/lib.rs',
    `
pub struct Account {}
pub fn verify_account() -> bool { true }
mod hidden;
`,
  );
  await writeFile(
    root,
    'java/App.java',
    `
package example;
import java.util.List;
public class App {
  public void run() {}
}
`,
  );
  await writeFile(root, 'cpp/main.cpp', `#include "auth.h"\nint main() { return 0; }\n`);
  await writeFile(root, 'ruby/app.rb', `require_relative 'lib/user'\ninclude AuthModule\n`);
  await writeFile(root, 'php/app.php', `<?php\nuse App\\Auth;\nrequire_once('bootstrap.php');\n`);
  await writeFile(
    root,
    'README.md',
    `# Fixture\nThis repository validates user permissions and authentication routes.\n`,
  );
  await writeFile(root, 'dist/generated.ts', `export const generated = true;\n`);
  await writeFile(root, '.hidden.ts', `export const hidden = true;\n`);
  await writeFile(root, '.gitignore', `ignored/\n*.secret\n!keep.secret\n`);
  await writeFile(root, 'ignored/skip.ts', `export const ignored = true;\n`);
  await writeFile(root, 'secrets.token.secret', `do-not-index\n`);
  await writeFile(root, 'keep.secret', `keep me if walker reaches this path\n`);
  await writeFile(root, 'binary.bin', Buffer.from([0, 1, 2, 3, 0, 255]));
  return root;
}

afterEach(async () => {
  for (let root = roots.pop(); root !== undefined; root = roots.pop()) {
    await fs.rm(root, { recursive: true, force: true });
  }
});
