import { describe, expect, it } from 'vitest';
import { rootLogger } from './logger.js';

describe('rootLogger', () => {
  it('is defined with info', () => {
    expect(rootLogger.level).toBeTruthy();
  });
});
