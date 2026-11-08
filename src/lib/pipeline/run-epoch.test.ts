import { describe, expect, it } from 'vitest';
import { createRunEpoch } from './run-epoch';

describe('createRunEpoch', () => {
  it('starts at zero and treats the sentinel as invalid', () => {
    const epoch = createRunEpoch();
    expect(epoch.current()).toBe(0);
    expect(epoch.isCurrent(0)).toBe(false);
  });

  it('never reuses an epoch', () => {
    const epoch = createRunEpoch();
    expect(epoch.begin()).toBe(1);
    expect(epoch.isCurrent(1)).toBe(true);
    expect(epoch.begin()).toBe(2);
    expect(epoch.isCurrent(1)).toBe(false);
    expect(epoch.isCurrent(2)).toBe(true);
  });

  it('cancel invalidates the current epoch and increments', () => {
    const epoch = createRunEpoch();
    epoch.begin();
    epoch.begin();
    epoch.cancel();
    expect(epoch.current()).toBe(3);
    expect(epoch.isCurrent(2)).toBe(false);
    expect(epoch.isCurrent(3)).toBe(false);
    expect(epoch.begin()).toBe(4);
    expect(epoch.isCurrent(2)).toBe(false);
    expect(epoch.isCurrent(4)).toBe(true);
  });

  it('cancel before begin never makes the sentinel current', () => {
    const epoch = createRunEpoch();
    epoch.cancel();
    expect(epoch.current()).toBe(1);
    expect(epoch.isCurrent(0)).toBe(false);
    expect(epoch.isCurrent(1)).toBe(false);
  });

  it('keeps instances independent', () => {
    const first = createRunEpoch();
    const second = createRunEpoch();
    first.begin();
    expect(first.isCurrent(1)).toBe(true);
    expect(second.isCurrent(1)).toBe(false);
    expect(second.current()).toBe(0);
  });

  it('gates post-await work and isolates the in-flight flag across restarts', async () => {
    const epoch = createRunEpoch();
    let inFlight = false;
    let releaseB!: () => void;
    const bGate = new Promise<void>((resolve) => {
      releaseB = resolve;
    });

    async function run(gate?: Promise<void>) {
      if (inFlight) return 'rejected';
      const myEpoch = epoch.begin();
      inFlight = true;

      await Promise.resolve();
      if (gate) await gate;

      if (!epoch.isCurrent(myEpoch)) {
        // Old run: its finally must not clear the new run's flag.
        if (epoch.current() === myEpoch) inFlight = false;
        return 'stale';
      }
      inFlight = false;
      return 'current';
    }

    const runA = run();
    epoch.cancel();
    inFlight = false; // the hook's cancel() clears the guard
    const runB = run(bGate);

    await expect(runA).resolves.toBe('stale');
    expect(inFlight).toBe(true);

    releaseB();
    await expect(runB).resolves.toBe('current');
    expect(inFlight).toBe(false);
  });
});
