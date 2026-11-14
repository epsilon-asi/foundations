# @epsilon-asi/evals

Evals for LLM agents, run by vitest. Tests check that code is correct; evals measure how well a model or
agent does a job. An eval is a dataset of cases, a task that runs each one, and graders that score the
output from 0 to 1. The harness runs the cases (repeatedly if asked), puts a 95% interval on every score,
and fails when a score breaks its threshold or drops below the committed baseline by more than noise.

```ts
import {defineEval, loadDataset} from '@epsilon-asi/evals';

defineEval({
    name: 'intent',
    cases: () => loadDataset('evals/intent/dataset.yaml', parseCase),
    task: (request, {signal, recordUsage}) => classify(request, {signal, recordUsage}),
    graders: {correct: ({case: c, output}) => output === c.expected},
    thresholds: {correct: {min: 0.85}},
});
```

Put evals in `*.eval.ts` files with a vitest config of their own, so `npm test` never runs them (they
call real models and cost money):

```ts
// vitest.evals.config.ts
export default defineConfig({test: {include: ['evals/**/*.eval.ts']}});
```

```json
"eval": "vitest run --config vitest.evals.config.ts"
```

## What a run does

1. Runs each case `trials` times (default 1), `concurrency` at a time (default 4). Each trial gets an
   abort signal and a timeout (`timeoutMs`, default 2 minutes). A task that throws or times out is an
   error and scores 0 on every grader.
2. Grades each output with every grader. A grader returns a number from 0 to 1, a boolean, or
   `{score, note}`; the note says why and shows in the summary. A grader that throws scores 0, with a note.
3. Summarizes each score overall and by tag: the mean with a 95% interval (Wilson's for pass/fail
   scores). Computes the eval's own `metrics`, such as a rate of one kind of mistake.
4. Writes the report to `eval-results/<name>.json`, prints a Markdown summary (and adds it to the
   GitHub Actions job summary), and compares it with `evals/baselines/<name>.json`.
5. Fails when a score's mean or a metric is outside its `thresholds`, or when a score has regressed: the
   top of its 95% interval is below the baseline's mean. A smaller drop can be chance, so it only shows
   in the summary as a change.

## Running

| Variable | Effect |
| --- | --- |
| `EVAL_TRIALS`, `EVAL_CONCURRENCY` | Override the eval's own. Several trials make the interval narrower and show flakiness. |
| `EVAL_MAX_TOKENS` | A token budget: no trial starts once it is used (tasks report tokens with `recordUsage`). |
| `EVAL_FILTER` | Run only the cases whose id contains it, or that have it as a tag. The baseline is not enforced. |
| `EVAL_REGRADE=1` | Grade the last report's outputs again instead of running the task, for changing graders for free. |
| `EVAL_UPDATE_BASELINE=1` | Record this run as the baseline. Commit the file. |
| `EVAL_RESULTS_DIR` | Where reports go. Default: `eval-results`. |

A baseline records the run's `meta` (the model, a prompt version); a run whose meta differs gets a
warning, since its scores may not be comparable.

## Pieces

| Export | Use |
| --- | --- |
| `defineEval(definition, options?)` | Declares the eval as a vitest suite with one test. |
| `runAndJudgeEval(definition, options?)` | The same run without vitest; returns the report and why it failed. |
| `runEval(definition, options?)` | Just the runs and the grading, returning the report. |
| `loadDataset(path, parse)` | Reads `.yaml`, `.json` or `.jsonl` records, naming the record when `parse` rejects one. |
| `classify(predictions, labels?)`, `formatConfusionMatrix(report)` | Accuracy, per-label precision and recall, and a confusion matrix, for classification evals. |
| `summarizeScores`, `wilsonInterval` | The statistics. |
| `compareToBaseline`, `checkThresholds`, `evalFailures`, `formatSummary` | The judging and the summary, for custom runners. |
