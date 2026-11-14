/** One prediction of a classifier and the label it should have given. `actual` is undefined when it gave none. */
export interface LabeledPrediction {
    readonly expected: string;
    readonly actual: string | undefined;
    /** Other labels that also count as right for this case. */
    readonly accepted?: readonly string[];
}

export interface LabelMetrics {
    /** Of the predictions of this label, the share that were right. 0 when it was never predicted. */
    readonly precision: number;
    /** Of the cases with this label, the share predicted right. 0 when there were none. */
    readonly recall: number;
    /** Cases with this label. */
    readonly support: number;
}

export interface ClassificationReport {
    readonly accuracy: number;
    readonly labels: readonly string[];
    readonly perLabel: Readonly<Record<string, LabelMetrics>>;
    /** Counts by expected label, then predicted label (`(none)` for no prediction). */
    readonly matrix: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

/** The label the matrix uses for a missing prediction. */
export const NO_PREDICTION = '(none)';

const isRight = (prediction: LabeledPrediction) =>
    prediction.actual !== undefined && (prediction.actual === prediction.expected || (prediction.accepted ?? []).includes(prediction.actual));

/**
 * Accuracy, per-label precision and recall, and the confusion matrix of a classifier's predictions. A prediction in
 * `accepted` counts as right, and as the expected label in the matrix and per-label numbers.
 */
export function classify(predictions: readonly LabeledPrediction[], labels?: readonly string[]): ClassificationReport {
    const all = labels ?? [...new Set(predictions.flatMap((prediction) => [prediction.expected, ...(prediction.actual === undefined ? [] : [prediction.actual])]))].sort();
    const matrix: Record<string, Record<string, number>> = Object.fromEntries(all.map((label) => [label, {}]));
    for (const prediction of predictions) {
        const predicted = isRight(prediction) ? prediction.expected : prediction.actual ?? NO_PREDICTION;
        const row = (matrix[prediction.expected] ??= {});
        row[predicted] = (row[predicted] ?? 0) + 1;
    }
    const perLabel = Object.fromEntries(all.map((label) => {
        const row = matrix[label] ?? {};
        const support = Object.values(row).reduce((total, count) => total + count, 0);
        const truePositives = row[label] ?? 0;
        const predicted = Object.values(matrix).reduce((total, counts) => total + (counts[label] ?? 0), 0);
        return [label, {precision: predicted === 0 ? 0 : truePositives / predicted, recall: support === 0 ? 0 : truePositives / support, support}];
    }));
    return {
        accuracy: predictions.length === 0 ? 0 : predictions.filter(isRight).length / predictions.length,
        labels: all,
        perLabel,
        matrix,
    };
}

/** The confusion matrix as a Markdown table, expected labels down and predicted ones across, with recall. */
export function formatConfusionMatrix(report: ClassificationReport): string {
    const columns = [...report.labels, ...(Object.values(report.matrix).some((row) => NO_PREDICTION in row) ? [NO_PREDICTION] : [])];
    const header = ['expected \\ chosen', ...columns, 'recall'];
    const rows = report.labels.map((label) => [
        label,
        ...columns.map((column) => String(report.matrix[label]?.[column] ?? 0)),
        (report.perLabel[label]?.recall ?? 0).toFixed(2),
    ]);
    return [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n');
}
