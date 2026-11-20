import { runApi, type RunApiOptions } from '@epsilon-asi/apps/express';
import { resources } from '../../common/src/app.js';
import '../../common/src/resources/Offering.js';

/** Start the example with its host's verifier and membership lookup. Routes are discovered beside this entry. */
export function startOfferingApi(options: Omit<RunApiOptions, 'resources' | 'entry'>) {
  return runApi({ ...options, resources, entry: import.meta.url });
}
