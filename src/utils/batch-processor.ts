/**
 * Processes a list of promises in batches.
 * 
 * @param promises List of promises to process in batches.
 */
export async function processPromiseBatch(promises: Promise<void>[], batchSize: number = 500): Promise<void> {
  const promisesLength = promises.length;
  for (let i = 0; i < promisesLength; i += batchSize) {
    await Promise.all(promises.slice(i, i + batchSize));
  }
}