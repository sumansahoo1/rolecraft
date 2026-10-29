/**
 * Per-run epoch token for the pipeline lifecycle.
 *
 * `begin()` never reuses an epoch and `cancel()` consumes one, so a cancelled
 * run can never become current again. `isCurrent` is the required
 * `epoch === current && !cancelled` guard for every post-await check and write.
 */
export function createRunEpoch() {
  let current = 0;
  let cancelled = false;

  return {
    begin(): number {
      current += 1;
      cancelled = false;
      return current;
    },
    cancel(): void {
      cancelled = true;
      current += 1;
    },
    isCurrent(epoch: number): boolean {
      return epoch > 0 && !cancelled && epoch === current;
    },
    current(): number {
      return current;
    },
  };
}
