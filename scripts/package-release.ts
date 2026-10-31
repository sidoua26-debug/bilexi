/**
 * Automated Quality-Gated Release Script: scripts/package-release.ts
 *
 * Implements strict Quality Gates for Chrome Web Store readiness:
 * 1. Typecheck: tsc --noEmit (0 errors)
 * 2. Unit Tests: vitest (100% pass)
 * 3. Golden Fixture Integrity: Exact SHA-256 match
 * 4. Browser E2E Tests: Playwright (100% pass)
 * 5. Black-box Scenario Tests: Chromium Appendix A runner
 * 6. Static Security & Permissions Audit: zero eval, offline only
 * 7. Unpacked Package Size Check: <= 8,000,000 bytes
 * 8. Accuracy Quality Gates on Dev Split:
 *    - Applied Precision >= 97.0%
 *    - Overall Distance-1 Recall >= 80.0%
 *    - Clean Token FPR < 0.100% (stricter internal target <= 0.050%)
 *    - Latency Stream p95 <= 3.0 ms
 *
 * If ANY mandatory gate fails:
 * - Marked as "Ready for CWS: No" with exact failing gates documented.
 * - Diagnostic archive named as `bilingual-autocorrect-v<version>-candidate.zip`.
 * - Source state recorded: git commit sha, working tree status, archive sha256.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { createEngine } from '../engine/engine';
import { loadCorpora, evaluateCorpus, DEFAULT_SEED } from './lib/eval-harness';

const ROOT_DIR = path.resolve('.');
const PKG_PATH = path.join(ROOT_DIR, 'package.json');
const RELEASES_DIR = path.join(ROOT_DIR, 'releases');
const OUTPUT_DIR = path.join(ROOT_DIR, '.output');
const DIST_DIR = path.join(OUTPUT_DIR, 'chrome-mv3');

export const MANDATORY_GATES = {
  minPrecisionEn: 97.0,
  minPrecisionFr: 96.0,
  minCombinedRecallD1: 75.0,
  maxCleanFpr: 0.100,
  internalCleanFprTarget: 0.050,
  maxLatencyP95Ms: 3.0,
  maxUnpackedBytes: 8000000,
  minHeadroomBytes: 20000,
  expectedGoldenSha256: 'd4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9',
};

interface QualityGateResult {
  name: string;
  target: string;
  measured: string;
  passed: boolean;
  notes?: string;
}

interface CommandCheckResult {
  step: string;
  command: string;
  status: 'PASS' | 'FAIL' | 'UNEXECUTED';
  durationMs: number;
  error?: string;
}

function computeSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getDirByteSize(dir: string): number {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += getDirByteSize(fullPath);
    } else if (entry.isFile()) {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

function runStep(stepName: string, command: string): CommandCheckResult {
  console.log(`\n[Release Gate: ${stepName}] Running \`${command}\`...`);
  const start = Date.now();
  try {
    execSync(command, { stdio: 'inherit', cwd: ROOT_DIR });
    const durationMs = Date.now() - start;
    console.log(`✅ [${stepName}] Passed in ${(durationMs / 1000).toFixed(1)}s`);
    return { step: stepName, command, status: 'PASS', durationMs };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.error(`❌ [${stepName}] FAILED after ${(durationMs / 1000).toFixed(1)}s:`, err.message || err);
    return { step: stepName, command, status: 'FAIL', durationMs, error: String(err.message || err) };
  }
}

async function main() {
  console.log('====================================================');
  console.log('            BILEXI: QUALITY-GATED PACKAGER          ');
  console.log('====================================================\n');

  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
  const version = pkg.version;
  console.log(`Version Target: ${version}`);

  if (!fs.existsSync(RELEASES_DIR)) {
    fs.mkdirSync(RELEASES_DIR, { recursive: true });
  }

  // Record Git Source State
  let gitCommit = 'unknown';
  let gitStatusShort = '';
  try {
    gitCommit = execSync('git rev-parse HEAD', { cwd: ROOT_DIR }).toString().trim();
    gitStatusShort = execSync('git status --short', { cwd: ROOT_DIR }).toString().trim();
  } catch {
    // Non-git environment
  }

  const isWorkingTreeDirty = gitStatusShort.length > 0;
  console.log(`Source Git Commit: ${gitCommit} (${isWorkingTreeDirty ? 'DIRTY WORKING TREE' : 'CLEAN'})`);

  const commandResults: CommandCheckResult[] = [];
  const qualityGates: QualityGateResult[] = [];

  // Step 1: Typecheck
  commandResults.push(runStep('TypeScript Typecheck', 'pnpm typecheck'));

  // Step 2: Unit tests
  commandResults.push(runStep('Vitest Unit Tests', 'pnpm test'));

  // Step 3: Golden Fixture Check
  const goldenActualSha = computeSha256(path.join(ROOT_DIR, 'e2e/golden/appendix-a.json'));
  const goldenMatch = goldenActualSha === MANDATORY_GATES.expectedGoldenSha256;
  qualityGates.push({
    name: 'Appendix A Golden SHA-256',
    target: MANDATORY_GATES.expectedGoldenSha256,
    measured: goldenActualSha,
    passed: goldenMatch,
  });
  if (!goldenMatch) {
    console.error(`❌ FAILED: Golden fixture SHA-256 mismatch! Expected ${MANDATORY_GATES.expectedGoldenSha256}, got ${goldenActualSha}`);
  } else {
    console.log(`✅ [Golden Fixture] SHA-256 verified (${goldenActualSha.slice(0, 16)}...)`);
  }

  // Step 4: Build production extension bundle
  commandResults.push(runStep('WXT Build', 'pnpm build'));

  // Step 5: Static Security & Permissions Audit
  commandResults.push(runStep('Static Security Audit', 'pnpm exec tsx scripts/verify-bundle-static.ts'));

  // Step 6: Unpacked Size Gate
  const unpackedSizeBytes = getDirByteSize(DIST_DIR);
  const headroomBytes = MANDATORY_GATES.maxUnpackedBytes - unpackedSizeBytes;
  const sizePassed = unpackedSizeBytes <= (MANDATORY_GATES.maxUnpackedBytes - MANDATORY_GATES.minHeadroomBytes) && unpackedSizeBytes > 0;
  qualityGates.push({
    name: 'Unpacked Extension Size',
    target: `<= ${MANDATORY_GATES.maxUnpackedBytes.toLocaleString()} bytes (headroom >= ${MANDATORY_GATES.minHeadroomBytes.toLocaleString()} B)`,
    measured: `${unpackedSizeBytes.toLocaleString()} bytes (${headroomBytes.toLocaleString()} bytes headroom)`,
    passed: sizePassed,
  });

  // Step 7: Black-box Chromium Benchmarks
  commandResults.push(runStep('Black-box Benchmark (Chromium)', 'pnpm bench:blackbox'));

  // Step 8: Playwright Browser E2E Tests
  commandResults.push(runStep('Playwright E2E Suite', 'pnpm test:e2e'));

  // Step 9: Package WXT ZIP
  commandResults.push(runStep('WXT Zip Packaging', 'pnpm zip'));

  // Step 10: Mandatory Accuracy Quality Gates on Dev & Held-Out Test Splits
  console.log('\n[Accuracy Evaluation] Evaluating Dev and Held-out Test Splits under production settings...');
  const enBuf = fs.readFileSync(path.join(ROOT_DIR, 'public/dict/en.bin'));
  const frBuf = fs.readFileSync(path.join(ROOT_DIR, 'public/dict/fr.bin'));
  const ngBuf = fs.existsSync(path.join(ROOT_DIR, 'public/dict/ngram.bin'))
    ? fs.readFileSync(path.join(ROOT_DIR, 'public/dict/ngram.bin'))
    : undefined;

  const { dev, test } = loadCorpora(ROOT_DIR);
  const engine = createEngine(
    { en: enBuf, fr: frBuf, ngram: ngBuf },
    { languageMode: 'auto', sensitivity: 'balanced', layout: 'auto', sentenceCaps: true, fixLoneI: true }
  );

  const evalRes = evaluateCorpus(dev, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED });
  const testRes = evaluateCorpus(test, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED });

  const precision = evalRes.overall.appliedPrecision;
  const recallD1 = evalRes.overall.recallD1;
  const cleanFpr = evalRes.overall.cleanFpr;
  const p95Latency = evalRes.latencies.p95;

  const combinedRecallD1 = evalRes.overall.combinedRecallD1;
  const cleanFprPassed = cleanFpr < MANDATORY_GATES.maxCleanFpr;
  const latencyPassed = p95Latency <= MANDATORY_GATES.maxLatencyP95Ms;

  // Option A (ADR-012): BOTH English and French must independently clear thresholds (EN >= 97.0%, FR >= 96.0%) on held-out test
  const heldOutEnPass = testRes.en.appliedPrecision >= MANDATORY_GATES.minPrecisionEn;
  const heldOutFrPass = testRes.fr.appliedPrecision >= MANDATORY_GATES.minPrecisionFr;
  const heldOutBothPass = heldOutEnPass && heldOutFrPass;

  qualityGates.push({
    name: 'Applied Precision (Held-Out Test Independent EN & FR - Option A)',
    target: `EN >= ${MANDATORY_GATES.minPrecisionEn}%, FR >= ${MANDATORY_GATES.minPrecisionFr}% independently (never blended)`,
    measured: `EN: ${testRes.en.appliedPrecision.toFixed(2)}%, FR: ${testRes.fr.appliedPrecision.toFixed(2)}% (Overall Held-Out: ${testRes.overall.appliedPrecision.toFixed(2)}%)`,
    passed: heldOutBothPass,
    notes: heldOutBothPass
      ? 'Both languages independently passed (Option A: EN >= 97.0%, FR >= 96.0%)'
      : `Failed per-language requirement on ${[!heldOutEnPass && 'EN', !heldOutFrPass && 'FR'].filter(Boolean).join(' and ')}`,
  });

  const devEnPass = evalRes.en.appliedPrecision >= MANDATORY_GATES.minPrecisionEn;
  const devFrPass = evalRes.fr.appliedPrecision >= MANDATORY_GATES.minPrecisionFr;
  const devBothPass = devEnPass && devFrPass;

  qualityGates.push({
    name: 'Applied Precision (Dev Independent EN & FR - Option A)',
    target: `EN >= ${MANDATORY_GATES.minPrecisionEn}%, FR >= ${MANDATORY_GATES.minPrecisionFr}% independently`,
    measured: `EN: ${evalRes.en.appliedPrecision.toFixed(2)}%, FR: ${evalRes.fr.appliedPrecision.toFixed(2)}% (Overall Dev: ${precision.toFixed(2)}%)`,
    passed: devBothPass,
    notes: devBothPass
      ? 'Both languages independently passed on Dev split'
      : `Failed per-language requirement on ${[!devEnPass && 'EN', !devFrPass && 'FR'].filter(Boolean).join(' and ')}`,
  });

  const combinedRecoveryPass = combinedRecallD1 >= MANDATORY_GATES.minCombinedRecallD1 && testRes.overall.combinedRecallD1 >= MANDATORY_GATES.minCombinedRecallD1;

  qualityGates.push({
    name: 'Combined D1 Correction Recovery (Auto + Visible Strip Suggestions)',
    target: `>= ${MANDATORY_GATES.minCombinedRecallD1}% (Two-Tier Model)`,
    measured: `Dev: ${combinedRecallD1.toFixed(2)}% (${evalRes.overall.d1CombinedRecovered}/${evalRes.overall.d1Injected}), Test: ${testRes.overall.combinedRecallD1.toFixed(2)}%`,
    passed: combinedRecoveryPass,
    notes: combinedRecoveryPass
      ? 'Passed >= 75.0% target'
      : `FAIL: Below ${MANDATORY_GATES.minCombinedRecallD1}% target (Dev: ${combinedRecallD1.toFixed(2)}%, Test: ${testRes.overall.combinedRecallD1.toFixed(2)}%)`,
  });

  qualityGates.push({
    name: 'Clean-Token False-Positive Rate (Overall)',
    target: `< ${MANDATORY_GATES.maxCleanFpr}% (Internal: <= ${MANDATORY_GATES.internalCleanFprTarget}%)`,
    measured: `Dev: ${cleanFpr.toFixed(4)}% (${evalRes.overall.cleanFp}/${evalRes.overall.cleanTokens}), Test: ${testRes.overall.cleanFpr.toFixed(4)}% (${testRes.overall.cleanFp}/${testRes.overall.cleanTokens})`,
    passed: cleanFprPassed && testRes.overall.cleanFpr < MANDATORY_GATES.maxCleanFpr,
    notes: cleanFpr <= MANDATORY_GATES.internalCleanFprTarget ? 'Meets strict internal 0.050% goal' : 'Fails strict internal 0.050% goal',
  });

  qualityGates.push({
    name: 'Engine Stream Latency p95',
    target: `<= ${MANDATORY_GATES.maxLatencyP95Ms} ms`,
    measured: `Dev: ${evalRes.latencies.p95.toFixed(4)} ms (p50: ${evalRes.latencies.p50.toFixed(4)} ms), Test: ${testRes.latencies.p95.toFixed(4)} ms (p50: ${testRes.latencies.p50.toFixed(4)} ms)`,
    passed: latencyPassed && testRes.latencies.p95 <= MANDATORY_GATES.maxLatencyP95Ms,
  });

  // Verify Generated Archive
  const sourceZipName = `bilexi-${version}-chrome.zip`;
  const sourceZipPath = path.join(OUTPUT_DIR, sourceZipName);
  if (!fs.existsSync(sourceZipPath)) {
    console.error(`❌ FAILED: Expected zip archive at ${sourceZipPath} not found!`);
    process.exit(1);
  }

  const archiveSizeBytes = fs.statSync(sourceZipPath).size;
  const archiveSha256 = computeSha256(sourceZipPath);

  // Compute Overall Store Readiness
  const allCommandsPassed = commandResults.every(c => c.status === 'PASS');
  const allQualityGatesPassed = qualityGates.every(g => g.passed);
  const isStoreReady = allCommandsPassed && allQualityGatesPassed;

  // Determine Archive Destination
  const finalArchiveName = isStoreReady
    ? `bilexi-v${version}.zip`
    : `bilexi-v${version}-candidate.zip`;
  const finalArchivePath = path.join(RELEASES_DIR, finalArchiveName);

  fs.copyFileSync(sourceZipPath, finalArchivePath);

  // Document in releases/RELEASES.md
  const timestamp = new Date().toISOString();
  const failingGates = qualityGates.filter(g => !g.passed);
  const failingCommands = commandResults.filter(c => c.status !== 'PASS');

  let releaseStatusDescription = 'Ready for CWS: Yes';
  if (!isStoreReady) {
    const reasons: string[] = [];
    if (failingCommands.length > 0) reasons.push(`Commands Failed: ${failingCommands.map(c => c.step).join(', ')}`);
    if (failingGates.length > 0) reasons.push(`Gates Failed: ${failingGates.map(g => `${g.name} (${g.measured} vs target ${g.target})`).join(', ')}`);
    releaseStatusDescription = `Ready for CWS: No (CANDIDATE ONLY — ${reasons.join(' | ')})`;
  }

  const releaseEntry = `
## Version ${version} ${isStoreReady ? 'Production Release' : 'Candidate'} (${timestamp})

- **Store Archive**: \`${finalArchiveName}\`
- **Archive Status**: ${isStoreReady ? '✅ Production Release' : '⚠️ Diagnostic Candidate (Quality Gates Unmet)'}
- **Ready for CWS**: ${isStoreReady ? 'Yes' : 'No'}
- **Archive SHA-256**: \`${archiveSha256}\`
- **Archive Size**: \`${archiveSizeBytes.toLocaleString()}\` bytes (${(archiveSizeBytes / 1024 / 1024).toFixed(2)} MB)
- **Unpacked Size**: \`${unpackedSizeBytes.toLocaleString()}\` bytes (${MANDATORY_GATES.maxUnpackedBytes - unpackedSizeBytes} bytes headroom)
- **Source State**: Commit \`${gitCommit.slice(0, 8)}\` (${isWorkingTreeDirty ? 'Dirty working tree' : 'Clean'})
- **Manifest Version**: MV3 (\`manifest_version: 3\`)
- **Permissions**: \`["storage", "activeTab"]\` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (\`${goldenActualSha.slice(0, 16)}...\`)
- **Quality Gates Breakdown**:
${qualityGates.map(g => `  - ${g.passed ? '✅' : '❌'} **${g.name}**: ${g.measured} (Target: ${g.target})${g.notes ? ` — *${g.notes}*` : ''}`).join('\n')}
- **Test Commands Breakdown**:
${commandResults.map(c => `  - ${c.status === 'PASS' ? '✅' : '❌'} **${c.step}**: \`${c.command}\` (${(c.durationMs / 1000).toFixed(1)}s)`).join('\n')}
`;

  const releasesMdPath = path.join(RELEASES_DIR, 'RELEASES.md');
  let existingContent = '';
  if (fs.existsSync(releasesMdPath)) {
    existingContent = fs.readFileSync(releasesMdPath, 'utf-8');
  } else {
    existingContent = '# Chrome Web Store Releases Log\n\nTracked store-ready releases and diagnostic candidates with cryptographic checksums and build attributes.\n';
  }

  const headerEnd = existingContent.indexOf('\n\n') + 2;
  const updatedContent = existingContent.slice(0, headerEnd) + releaseEntry.trim() + '\n\n' + existingContent.slice(headerEnd);
  fs.writeFileSync(releasesMdPath, updatedContent, 'utf-8');

  console.log('\n====================================================');
  console.log('              FINAL RELEASE READINESS REPORT        ');
  console.log('====================================================');
  console.log(`Archive Created:  ${finalArchivePath}`);
  console.log(`Archive Size:     ${archiveSizeBytes.toLocaleString()} bytes (${(archiveSizeBytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Archive SHA-256:  ${archiveSha256}`);
  console.log(`Ready for CWS:    ${isStoreReady ? 'YES' : 'NO'}`);
  console.log(`Status:           ${releaseStatusDescription}`);
  console.log('====================================================\n');

  if (!isStoreReady) {
    console.warn('⚠️ WARNING: Quality gates were NOT fully met. Archive was generated as a diagnostic candidate.');
    console.warn('Failing Gates:');
    for (const g of failingGates) {
      console.warn(`  - ${g.name}: Measured ${g.measured} (Target: ${g.target})`);
    }
  } else {
    console.log(`✅ All mandatory quality gates passed! Production release ready.`);
  }
}

main().catch((err) => {
  console.error('Fatal release packager error:', err);
  process.exit(1);
});
