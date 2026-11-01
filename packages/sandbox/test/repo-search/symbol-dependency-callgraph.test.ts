import { describe, expect, it } from 'vitest';
import { SearchDocumentStore } from '../../src/repo-search/core/searchDocumentStore.js';
import { CallGraphIndex } from '../../src/repo-search/search/callGraph.js';
import { SourceDependencyIndex, extractSourceDependencies } from '../../src/repo-search/search/dependencies.js';
import { SymbolIndex, extractSymbols } from '../../src/repo-search/search/symbols.js';
import type { CallGraphEdge, SourceDependencyEntry, SymbolEntry } from '../../src/repo-search/types.js';
import { makeDocument, makeStore } from './helpers.js';

describe('symbol extraction and search', () => {
  const docs = [
    makeDocument(
      'src/auth.ts',
      `
export interface User { id: string }
export type Role = 'admin' | 'reader';
export enum Mode { Strict }
export namespace AuthNamespace {}
export class AuthService {
  public validatePermission(user: User): boolean {
    if (user.id) {
      return helper(user.id);
    }
    return false;
  }
}
export async function helper(id: string) { return id.length > 0; }
export const routeGuard = (user: User) => helper(user.id);
const INTERNAL_VALUE = 1;
export function f() {}
`,
    ),
    makeDocument(
      'python/app.py',
      `
class PythonAuth:
    def login(self, name):
        return name
CONSTANT_VALUE = 42
`,
    ),
    makeDocument(
      'go/main.go',
      `
type Server struct {}
type Reader interface {}
type ID string
const ExportedConst = 1
var localVar = 2
func StartServer() {}
func (s Server) StopServer() {}
func _private() {}
`,
    ),
    makeDocument(
      'rust/lib.rs',
      `
pub struct Account {}
pub enum Status { Active }
pub trait Verifier {}
impl Account {}
pub fn verify_account() -> bool { true }
fn internal() {}
`,
    ),
    makeDocument(
      'java/App.java',
      `
public class App {
  public void run() {}
  private void stop() {
    for (int i = 0; i < 1; i++) {}
  }
}
`,
    ),
    makeDocument(
      'c/main.c',
      'struct point { int x; };\nenum color { RED };\nstatic int add(int a, int b) {\n  return a + b;\n}',
    ),
    makeDocument('php/app.php', '<?php\nabstract class Base {}\ninterface Shape {}\npublic function area() {}'),
    makeDocument('ruby/app.rb', 'module Billing\n  class Invoice\n    def total!\n    end\n  end\nend'),
    makeDocument('unknown.txt', 'function genericThing() {}\nclass GenericClass {}', 'text'),
  ];
  const symbols = docs.flatMap(extractSymbols);
  const byName = (name: string): SymbolEntry | undefined => symbols.find((symbol) => symbol.name === name);

  it('extracts symbols across common repository languages', () => {
    const labels = symbols.map((s) => `${s.kind}:${s.name}`);
    expect(labels).toEqual(
      expect.arrayContaining([
        'interface:User',
        'type:Role',
        'enum:Mode',
        'namespace:AuthNamespace',
        'class:AuthService',
        'method:validatePermission',
        'function:helper',
        'function:routeGuard',
        'variable:INTERNAL_VALUE',
        'class:PythonAuth',
        'function:login',
        'variable:CONSTANT_VALUE',
        'struct:Server',
        'interface:Reader',
        'type:ID',
        'constant:ExportedConst',
        'variable:localVar',
        'function:StartServer',
        'method:StopServer',
        'struct:Account',
        'enum:Status',
        'trait:Verifier',
        'impl:Account',
        'function:verify_account',
        'class:App',
        'struct:point',
        'enum:color',
        'function:add',
        'class:Base',
        'interface:Shape',
        'function:area',
        'module:Billing',
        'class:Invoice',
        'function:total',
        'function:genericThing',
        'class:GenericClass',
      ]),
    );
  });

  it('never treats control-flow keywords as symbols', () => {
    expect(symbols.filter((symbol) => ['if', 'for', 'while', 'return'].includes(symbol.name))).toEqual([]);
  });

  it('records exact columns, export status, block ends, and containers', () => {
    expect(byName('f')).toMatchObject({ line: 17, column: 17, exported: true });
    expect(byName('validatePermission')).toMatchObject({
      line: 7,
      column: 10,
      endLine: 12,
      containerName: 'AuthService',
      exported: true,
    });
    expect(byName('AuthService')).toMatchObject({ endLine: 13, exported: true });
    expect(byName('INTERNAL_VALUE')?.exported).toBe(false);
    expect(byName('StartServer')?.exported).toBe(true);
    expect(byName('localVar')?.exported).toBe(false);
    expect(byName('_private')?.exported).toBe(false);
    expect(byName('verify_account')?.exported).toBe(true);
    expect(byName('internal')?.exported).toBe(false);
    expect(byName('App')?.exported).toBe(true);
    expect(byName('stop')?.exported).toBe(false);
    expect(byName('login')).toMatchObject({ containerName: 'PythonAuth', endLine: 4 });
    expect(byName('Invoice')?.containerName).toBe('Billing');
  });

  it('searches, finds definitions, and runs structural queries with filters', () => {
    const index = new SymbolIndex(makeStore(docs));
    expect(index.symbols.length).toBe(symbols.length);
    expect(index.search('', { maxResults: 5 })).toEqual([]);
    expect(index.search('validate', { kind: 'method' })[0]?.path).toBe('src/auth.ts');
    expect(index.search('Auth', { exported: true }).some((r) => r.preview.includes('AuthService'))).toBe(true);
    expect(index.search('authservice', { exact: true })).toHaveLength(1);
    expect(index.search('AUTHSERVICE', { caseSensitive: true })).toEqual([]);
    expect(index.search('vldprm').map((r) => r.metadata?.symbol)).toEqual([byName('validatePermission')]);
    expect(index.search('e', { maxResults: 3 })).toHaveLength(3);

    const [definition] = index.findDefinition('helper');
    expect(definition).toMatchObject({
      method: 'symbol',
      score: 100,
      line: 14,
      column: 23,
      preview: 'export async function helper(id: string) { return id.length > 0; }',
      matches: [{ line: 14, column: 23, endLine: 14, endColumn: 29, text: 'helper' }],
    });
    expect(definition?.contextBefore).toHaveLength(2);
    expect(index.findDefinition('helper', { contextBefore: 0, contextAfter: 1 })[0]).toMatchObject({
      contextBefore: [],
      contextAfter: ['export const routeGuard = (user: User) => helper(user.id);'],
    });

    const structural = index.structuralSearch({
      kind: ['class', 'function'],
      language: 'TypeScript',
      exported: true,
      signatureIncludes: 'helper',
      pathIncludes: 'src/',
    });
    expect(structural.map((r) => r.preview)).toEqual([
      'export async function helper(id: string) { return id.length > 0; }',
      'export const routeGuard = (user: User) => helper(user.id);',
    ]);
    const nearText = index.structuralSearch({ name: /validate/g, nearText: 'RETURN HELPER' });
    expect(nearText.map((r) => r.line)).toEqual([7]);
    expect(index.structuralSearch({ name: /validate/g })).toHaveLength(1);
    expect(index.structuralSearch({ name: 'auth', language: ['python', 'go'] }).map((r) => r.path)).toEqual([
      'python/app.py',
    ]);
    expect(index.structuralSearch({}, 2)).toHaveLength(2);
    expect(index.structuralSearch({ name: 'missing' })).toEqual([]);
  });
});

describe('dependency extraction and search', () => {
  const docs = [
    makeDocument(
      'src/auth.ts',
      `
import { auditLog } from './logger';
import type { User } from './types';
const fs = require('node:fs');
export { auditLog } from './logger';
async function load() { return import('./lazy'); }
import { helpers } from './util';
`,
    ),
    makeDocument('src/logger.ts', 'export function auditLog() {}'),
    makeDocument('src/lazy.ts', 'export const lazy = true'),
    makeDocument('src/util/index.ts', 'export const helpers = {};'),
    makeDocument('python/app.py', 'import os\nfrom services.auth import check_user'),
    makeDocument(
      'go/main.go',
      'package main\nimport "errors"\nimport f "fmt"\nimport (\n  "strings"\n  alias "example.com/project/lib"\n)\n"not-an-import"\nfunc main(){}',
    ),
    makeDocument('rust/lib.rs', 'use crate::auth::User;\npub mod visible;\nmod hidden;'),
    makeDocument('java/App.java', 'import static java.util.Collections.*;\nimport java.util.List;'),
    makeDocument('kotlin/App.kt', 'import kotlin.collections.List'),
    makeDocument('cs/App.cs', 'using System.Text;'),
    makeDocument('cpp/main.cpp', '#include <vector>\n#include "auth.h"'),
    makeDocument('ruby/app.rb', "require_relative 'lib/user'\ninclude AuthModule"),
    makeDocument('php/app.php', '<?php\nuse App\\Auth;\ninclude("x.php");\nrequire_once(\'bootstrap.php\');'),
    makeDocument('notes.txt', 'import nothing from here'),
  ];

  it('extracts imports, requires, exports, includes, uses, and modules', () => {
    const labels = docs.flatMap(extractSourceDependencies).map((dep) => `${dep.kind}:${dep.specifier}`);
    expect(labels).toEqual(
      expect.arrayContaining([
        'import:./logger',
        'import:./types',
        'require:node:fs',
        'export:./logger',
        'import:./lazy',
        'import:os',
        'import:services.auth',
        'import:errors',
        'import:fmt',
        'import:strings',
        'import:example.com/project/lib',
        'use:crate::auth::User',
        'module:visible',
        'module:hidden',
        'import:java.util.List',
        'import:kotlin.collections.List',
        'import:System.Text',
        'include:vector',
        'include:auth.h',
        'require:lib/user',
        'include:AuthModule',
        'import:App\\Auth',
        'include:x.php',
        'include:bootstrap.php',
      ]),
    );
    expect(labels).not.toContain('import:not-an-import');
    expect(labels.filter((label) => label.startsWith('import:nothing'))).toEqual([]);
  });

  it('records the column of the specifier, not of an earlier identical word', () => {
    const [dependency] = extractSourceDependencies(makeDocument('a.ts', "import fs from 'fs';"));
    expect(dependency).toMatchObject({ specifier: 'fs', line: 1, column: 17, statement: "import fs from 'fs';" });
  });

  it('searches dependencies, resolves relative specifiers, and lists file-local imports', () => {
    const index = new SourceDependencyIndex(makeStore(docs));
    const logger = index.findImporters('./logger');
    expect(logger).toHaveLength(2);
    expect((logger[0]?.metadata?.dependency as SourceDependencyEntry).resolvedPath).toBe('src/logger.ts');
    expect(logger[0]).toMatchObject({ method: 'dependency', score: 100, line: 2, column: 27 });
    expect(index.findImporters('./util')[0]?.metadata?.dependency).toMatchObject({ resolvedPath: 'src/util/index.ts' });
    expect(index.findImporters('os')[0]?.metadata?.dependency).not.toHaveProperty('resolvedPath');
    expect(index.search('LOGGER', { caseSensitive: true })).toEqual([]);
    expect(index.search('logger', { exact: false }).map((r) => r.score)).toEqual([80, 80]);
    expect(index.search('lazy').map((r) => r.score)).toEqual([80]);
    expect(index.search('collections').map((r) => r.score)).toEqual([60, 60]);
    expect(index.search('node:fs', { kind: 'require', exact: true })[0]?.preview).toContain('require');
    expect(index.search('./', { kind: ['import', 'export'], maxResults: 2 })).toHaveLength(2);
    expect(index.listForFile('src/auth.ts')).toHaveLength(6);
    expect(index.listForFile('missing.ts')).toEqual([]);
    expect(index.search('missing')).toEqual([]);
  });
});

describe('approximate call graph', () => {
  const docs = [
    makeDocument(
      'src/auth.ts',
      `
export function helper() { return true; }
export function validatePermission() {
  return helper();
}
export function routeGuard() {
  return validatePermission();
}
export function $query() { return 1; }
export function usesQuery() {
  return $query() + x$query() + 1helper();
}
`,
    ),
    makeDocument(
      'src/other.ts',
      `
export function externalCall() {
  return validatePermission() && run();
}
export function run() {}
`,
    ),
    makeDocument('lib/short.ts', 'export function go() {\n  return run();\n}'),
  ];
  const store = makeStore(docs);
  const symbols = docs.flatMap(extractSymbols);
  const edgeOf = (result: { metadata?: Record<string, unknown> }): CallGraphEdge =>
    result.metadata?.edge as CallGraphEdge;

  it('builds cached cross-file and same-file edges', () => {
    const graph = new CallGraphIndex(store, symbols);
    const edges = graph.build();
    const label = (edge: CallGraphEdge): string => `${edge.caller.name}->${edge.callee.name}:${edge.confidence}`;
    expect(edges.map(label)).toEqual(
      expect.arrayContaining([
        'validatePermission->helper:high',
        'routeGuard->validatePermission:high',
        'externalCall->validatePermission:medium',
        'externalCall->run:high',
        'go->run:low',
        'usesQuery->$query:high',
      ]),
    );
    expect(edges.some((edge) => edge.caller.name === 'usesQuery' && edge.callee.name === 'helper')).toBe(false);
    expect(edges.filter((edge) => edge.caller.name === 'usesQuery')).toHaveLength(1);
    expect(edges.find((edge) => edge.caller.name === 'routeGuard')).toMatchObject({ line: 7, column: 10 });
    expect(graph.build()).toBe(edges);
    expect(graph.build({ maxSymbols: 5000, sameFileOnly: false })).toBe(edges);

    const sameFile = graph.build({ sameFileOnly: true });
    expect(sameFile.every((edge) => edge.caller.path === edge.callee.path)).toBe(true);
    expect(graph.build({ maxSymbols: 1 })).toHaveLength(0);
    expect(new CallGraphIndex(new SearchDocumentStore([]), symbols).build()).toEqual([]);
  });

  it('renders caller and callee results at the call site', () => {
    const graph = new CallGraphIndex(store, symbols);
    const callers = graph.findCallers('validatePermission');
    expect(callers.map((r) => edgeOf(r).caller.name)).toEqual(['routeGuard', 'externalCall']);
    expect(callers[0]).toMatchObject({
      method: 'callgraph',
      path: 'src/auth.ts',
      score: 1,
      line: 7,
      column: 10,
      preview: 'return validatePermission();',
      matches: [{ line: 7, column: 10, endLine: 7, endColumn: 28, text: 'validatePermission' }],
    });

    const callees = graph.findCallees('externalCall');
    expect(callees.map((r) => [edgeOf(r).callee.name, r.path, r.absolutePath])).toEqual([
      ['run', 'src/other.ts', '/repo/src/other.ts'],
      ['validatePermission', 'src/other.ts', '/repo/src/other.ts'],
    ]);
    expect(graph.findCallees('routeGuard', { maxResults: 1 })).toHaveLength(1);
    expect(graph.findCallers('nobody')).toEqual([]);
  });
});
