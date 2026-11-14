import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {formatThreshold, type ScoreComparison} from './judge.js';
import type {EvalReport, ScoreSummary, Threshold} from './types.js';

/** Failed trials the summary lists, at most. */
export const DEFAULT_LISTED_FAILURES = 15;

/** Writes the report to `<dir>/<name>.json`, replacing the last one, and returns the path. */
export async function writeReport(report: EvalReport, dir: string): Promise<string> {
    await mkdir(dir, {recursive: true});
    const path = join(dir, `${report.name}.json`);
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
    return path;
}

/** The report at `path`, or undefined when there is none. */
export async function readReport<Input, Expected, Output>(path: string): Promise<EvalReport<Input, Expected, Output> | undefined> {
    try {
        return JSON.parse(await readFile(path, 'utf8')) as EvalReport<Input, Expected, Output>;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return undefined;
        }
        throw error;
    }
}

const fixed = (value: number) => value.toFixed(3);
const interval = (summary: ScoreSummary) => `${fixed(summary.low)}–${fixed(summary.high)}`;
const signed = (value: number) => `${value >= 0 ? '+' : ''}${fixed(value)}`;
const table = (header: readonly string[], rows: readonly (readonly string[])[]) =>
    [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n');

export interface SummaryOptions {
    readonly comparisons?: readonly ScoreComparison[];
    readonly thresholds?: Readonly<Record<string, Threshold>>;
    /** Why the eval fails; empty or absent when it passes. */
    readonly failures?: readonly string[];
    /** Lines worth a warning, such as the baseline being for another model. */
    readonly warnings?: readonly string[];
    /** Markdown from the eval's `details`. */
    readonly details?: string;
    /** Failed trials listed, at most. Default: DEFAULT_LISTED_FAILURES. */
    readonly listedFailures?: number;
}

/** A Markdown summary of a report, for the terminal and for CI job summaries. */
export function formatSummary(report: EvalReport, options: SummaryOptions = {}): string {
    const {comparisons = [], thresholds = {}, failures = [], warnings = [], details, listedFailures = DEFAULT_LISTED_FAILURES} = options;
    const cases = new Set(report.trials.map((trial) => trial.caseId)).size;
    const trialsPerCase = cases === 0 ? 0 : report.trials.length / cases;
    const meta = Object.entries(report.meta).map(([key, value]) => `${key}=${String(value)}`).join(', ');
    const lines: string[] = [
        `## Eval: ${report.name}`,
        '',
        [
            `${cases} cases × ${trialsPerCase} trial${trialsPerCase === 1 ? '' : 's'}`,
            `${report.errors} errors`,
            ...(report.skipped > 0 ? [`${report.skipped} skipped`] : []),
            `${(report.durationMs / 1000).toFixed(1)}s`,
            `${report.usage.inputTokens.toLocaleString('en-US')} input / ${report.usage.outputTokens.toLocaleString('en-US')} output tokens`,
            ...(meta === '' ? [] : [meta]),
        ].join(' · '),
        '',
        table(['Score', 'Mean', '95% interval', 'n', 'Threshold', 'Baseline', 'Change'], Object.entries(report.scores).map(([name, summary]) => {
            const comparison = comparisons.find((candidate) => candidate.name === name);
            return [
                name,
                fixed(summary.mean),
                interval(summary),
                String(summary.n),
                thresholds[name] === undefined ? '' : formatThreshold(thresholds[name]),
                comparison?.baseline === undefined ? '' : fixed(comparison.baseline.mean),
                comparison?.delta === undefined ? '' : `${signed(comparison.delta)}${comparison.regressed ? ' (regressed)' : ''}`,
            ];
        })),
    ];

    const metrics = Object.entries(report.metrics);
    if (metrics.length > 0) {
        lines.push('', table(['Metric', 'Value', 'Threshold'], metrics.map(([name, value]) => [
            name, fixed(value), thresholds[name] === undefined ? '' : formatThreshold(thresholds[name]),
        ])));
    }

    const tags = Object.entries(report.byTag);
    const graders = Object.keys(report.scores);
    if (tags.length > 0) {
        lines.push('', table(['Tag', ...graders.map((grader) => `${grader} (95% interval)`), 'n'], tags.map(([tag, scores]) => [
            tag,
            ...graders.map((grader) => `${fixed(scores[grader]!.mean)} (${interval(scores[grader]!)})`),
            String(scores[graders[0]!]!.n),
        ])));
    }

    if (details !== undefined && details.trim() !== '') {
        lines.push('', details.trim());
    }

    const failed = report.trials.filter((trial) => trial.error !== undefined || Object.values(trial.scores).some((score) => score < 1));
    if (failed.length > 0) {
        lines.push('', `Trials that did not score 1 on every grader (${failed.length}${failed.length > listedFailures ? `, first ${listedFailures}` : ''}):`, '');
        for (const trial of failed.slice(0, listedFailures)) {
            const why = trial.error !== undefined
                ? `error: ${trial.error}`
                : Object.entries(trial.scores).filter(([, score]) => score < 1)
                    .map(([grader, score]) => `${grader} ${fixed(score)}${trial.notes[grader] ? `: ${trial.notes[grader]}` : ''}`).join('; ');
            lines.push(`- ${trial.caseId}${trial.trial > 0 ? ` (trial ${trial.trial})` : ''}: ${why}`);
        }
    }

    for (const warning of warnings) {
        lines.push('', `> Warning: ${warning}`);
    }
    lines.push('', failures.length === 0 ? '**Passed.**' : ['**Failed:**', ...failures.map((failure) => `- ${failure}`)].join('\n'));
    return `${lines.join('\n')}\n`;
}
