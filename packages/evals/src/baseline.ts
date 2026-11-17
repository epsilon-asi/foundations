import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import type {EvalMeta, EvalReport, ScoreSummary} from './types.js';

/** What a run is compared against: an earlier run's scores and metrics. Kept in the repository. */
export interface EvalBaseline {
    readonly name: string;
    readonly meta: EvalMeta;
    readonly recordedAt: string;
    readonly scores: Readonly<Record<string, ScoreSummary>>;
    readonly metrics: Readonly<Record<string, number>>;
}

export const baselineFrom = (report: EvalReport): EvalBaseline => ({
    name: report.name,
    meta: report.meta,
    recordedAt: report.startedAt,
    scores: report.scores,
    metrics: report.metrics,
});

/** The baseline at `path`, or undefined when there is none yet. */
export async function readBaseline(path: string): Promise<EvalBaseline | undefined> {
    try {
        return JSON.parse(await readFile(path, 'utf8')) as EvalBaseline;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return undefined;
        }
        throw error;
    }
}

export async function writeBaseline(path: string, baseline: EvalBaseline): Promise<void> {
    await mkdir(dirname(path), {recursive: true});
    await writeFile(path, `${JSON.stringify(baseline, null, 2)}\n`);
}

/** The meta keys whose values differ between a run and its baseline, e.g. a different model, worth a warning. */
export const metaDifferences = (meta: EvalMeta, baseline: EvalBaseline): string[] =>
    [...new Set([...Object.keys(meta), ...Object.keys(baseline.meta)])]
        .filter((key) => meta[key] !== baseline.meta[key])
        .map((key) => `${key}: ${String(baseline.meta[key] ?? '(unset)')} in the baseline, ${String(meta[key] ?? '(unset)')} now`);
