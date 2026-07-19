import { TEST_ACCESS_TOKEN } from '../test-setup.js';

export function authedHeaders(): { Authorization: string } {
  return { Authorization: `Bearer ${TEST_ACCESS_TOKEN}` };
}
