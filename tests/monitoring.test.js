import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMonitoringEnabled, reportError } from '../src/monitoring.js';

describe('error monitoring', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is disabled until a production Sentry DSN is configured', () => {
    expect(isMonitoringEnabled()).toBe(false);
  });

  it('handles a report safely when monitoring is not configured', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => reportError('drawing failed', { area: 'test' })).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      'Sketchboard error',
      { area: 'test' },
      expect.objectContaining({ message: 'drawing failed' }),
    );
  });
});
