/**
 * Golden File Integrity Verifier: scripts/verify-golden.ts
 * Verifies that e2e/golden/appendix-a.json has not been altered or weakened
 */

import fs from 'node:fs';
import crypto from 'node:crypto';

const GOLDEN_PATH = 'e2e/golden/appendix-a.json';
const EXPECTED_HASH = 'd4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9';

if (!fs.existsSync(GOLDEN_PATH)) {
  console.error(`FATAL: Golden file missing at ${GOLDEN_PATH}`);
  process.exit(1);
}

const content = fs.readFileSync(GOLDEN_PATH);
const hash = crypto.createHash('sha256').update(content).digest('hex');

if (hash !== EXPECTED_HASH) {
  console.error('FATAL: e2e/golden/appendix-a.json integrity check failed!');
  console.error(`Expected SHA256: ${EXPECTED_HASH}`);
  console.error(`Actual SHA256:   ${hash}`);
  console.error('SPEC.md Appendix A golden scenarios are immutable. Do not edit or delete cases.');
  process.exit(1);
}

console.log('✅ Golden scenarios integrity verified (SHA256 matches).');
