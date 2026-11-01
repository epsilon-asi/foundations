/** Maps `items` through `fn` with at most `concurrency` calls in flight; results keep the input order. */
export async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  // Workers share one iterator, so each item is claimed by exactly one worker.
  const queue = items.entries();
  const worker = async (): Promise<void> => {
    for (const [index, item] of queue) results[index] = await fn(item, index);
  };
  const workers = Math.max(1, Math.min(Math.floor(concurrency), items.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}
