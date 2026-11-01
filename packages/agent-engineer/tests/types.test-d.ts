import { Command } from '@commander-js/extra-typings';
import { describe, expectTypeOf, it } from 'vitest';
import { commands, type GlobalOptions, type InfoOptions } from '../src/config.js';
import { createProgram } from '../src/program.js';

// Commander infers option types from the declarations in config.ts. These
// checks fail the test run if the declared interfaces drift from that inference.
describe('option types', () => {
  it('program global options match GlobalOptions', () => {
    expectTypeOf(createProgram().opts()).toEqualTypeOf<GlobalOptions>();
  });

  it('info option declarations match InfoOptions', () => {
    const info = new Command().addOption(commands.info.options.format());

    expectTypeOf(info.opts()).toEqualTypeOf<InfoOptions>();
  });
});
