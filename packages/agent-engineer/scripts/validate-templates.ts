/**
 * `npm run templates:validate [-- <dir>]`: validates every project template
 * under <dir> (default: this package's templates/) and exits 1 if any fails.
 */
import {resolve} from 'node:path';
import {TEMPLATES_DIR} from '../src/project-templates/registry.js';
import {formatValidation, validateTemplates} from '../src/project-templates/validate.js';

const arg = process.argv[2];
const result = await validateTemplates(arg === undefined ? TEMPLATES_DIR : resolve(arg));

(result.valid ? process.stdout : process.stderr).write(formatValidation(result));
process.exitCode = result.valid ? 0 : 1;
