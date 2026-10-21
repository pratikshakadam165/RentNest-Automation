import { test } from '@playwright/test';

/**
 * Marks the current test as a known app bug: it is expected to fail.
 * Run with SHOW_BUGS=1 to switch this off and see the real failure messages.
 */
export function knownBug(description: string) {
  if (!process.env.SHOW_BUGS) test.fail(true, description);
}
