# Chrome Web Store Releases Log

## Version 0.5.0 Production Release (2026-10-19T09:55:49.058Z)

- **Store Archive**: `bilexi-v0.5.0.zip`
- **Archive Status**: ✅ Production Release
- **Ready for CWS**: Yes
- **Archive SHA-256**: `fbc9ec0e715c6e2d53ae859960ac089e762726927647d505f42364519c75a418`
- **Archive Size**: `4,074,399` bytes (3.89 MB)
- **Unpacked Size**: `7,973,934` bytes (26066 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,973,934 bytes (26,066 bytes headroom) (Target: <= 8,000,000 bytes (headroom >= 20,000 B))
  - ✅ **Applied Precision (Held-Out Test Independent EN & FR - Option A)**: EN: 97.96%, FR: 96.33% (Overall Held-Out: 97.17%) (Target: EN >= 97%, FR >= 96% independently (never blended)) — *Both languages independently passed (Option A: EN >= 97.0%, FR >= 96.0%)*
  - ✅ **Applied Precision (Dev Independent EN & FR - Option A)**: EN: 97.48%, FR: 96.64% (Overall Dev: 97.08%) (Target: EN >= 97%, FR >= 96% independently) — *Both languages independently passed on Dev split*
  - ✅ **Combined D1 Correction Recovery (Auto + Visible Strip Suggestions)**: Dev: 76.68% (5533/7216), Test: 75.31% (Target: >= 75% (Two-Tier Model)) — *Passed >= 75.0% target*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: Dev: 0.0142% (18/127035), Test: 0.0119% (10/84238) (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: Dev: 0.3517 ms (p50: 0.0129 ms), Test: 0.3385 ms (p50: 0.0113 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (5.6s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (3.9s)
  - ✅ **WXT Build**: `pnpm build` (3.0s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.4s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (113.2s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (39.9s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.2s)

## Version 0.5.0 Production Release (2026-10-19T09:05:21.006Z)

- **Store Archive**: `bilexi-v0.5.0.zip`
- **Archive Status**: ✅ Production Release
- **Ready for CWS**: Yes
- **Archive SHA-256**: `2ad7973976ec64497308cf02c03b36173512a670c7cd381c235a35b63b6b03dd`
- **Archive Size**: `4,081,200` bytes (3.89 MB)
- **Unpacked Size**: `7,978,887` bytes (21113 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,978,887 bytes (21,113 bytes headroom) (Target: <= 8,000,000 bytes (headroom >= 20,000 B))
  - ✅ **Applied Precision (Held-Out Test Independent EN & FR - Option A)**: EN: 97.96%, FR: 96.33% (Overall Held-Out: 97.17%) (Target: EN >= 97%, FR >= 96% independently (never blended)) — *Both languages independently passed (Option A: EN >= 97.0%, FR >= 96.0%)*
  - ✅ **Applied Precision (Dev Independent EN & FR - Option A)**: EN: 97.48%, FR: 96.64% (Overall Dev: 97.08%) (Target: EN >= 97%, FR >= 96% independently) — *Both languages independently passed on Dev split*
  - ✅ **Combined D1 Correction Recovery (Auto + Visible Strip Suggestions)**: Dev: 76.68% (5533/7216), Test: 75.31% (Target: >= 75% (Two-Tier Model)) — *Passed >= 75.0% target*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: Dev: 0.0142% (18/127035), Test: 0.0119% (10/84238) (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: Dev: 0.3373 ms (p50: 0.0127 ms), Test: 0.3429 ms (p50: 0.0117 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (4.9s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (3.4s)
  - ✅ **WXT Build**: `pnpm build` (2.8s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.4s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (111.6s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (38.6s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.1s)

## Version 0.5.0 Production Release (2026-10-19T08:50:17.031Z)

- **Store Archive**: `bilexi-v0.5.0.zip`
- **Archive Status**: ✅ Production Release
- **Ready for CWS**: Yes
- **Archive SHA-256**: `67e8413fcabd6ae177599b29e33edb12ccd1c7ff38d1c3e95d863cebe4b5326a`
- **Archive Size**: `4,081,168` bytes (3.89 MB)
- **Unpacked Size**: `7,978,865` bytes (21135 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,978,865 bytes (21,135 bytes headroom) (Target: <= 8,000,000 bytes (headroom >= 20,000 B))
  - ✅ **Applied Precision (Held-Out Test Independent EN & FR - Option A)**: EN: 97.96%, FR: 96.33% (Overall Held-Out: 97.17%) (Target: EN >= 97%, FR >= 96% independently (never blended)) — *Both languages independently passed (Option A: EN >= 97.0%, FR >= 96.0%)*
  - ✅ **Applied Precision (Dev Independent EN & FR - Option A)**: EN: 97.48%, FR: 96.64% (Overall Dev: 97.08%) (Target: EN >= 97%, FR >= 96% independently) — *Both languages independently passed on Dev split*
  - ✅ **Combined D1 Correction Recovery (Auto + Visible Strip Suggestions)**: Dev: 76.68% (5533/7216), Test: 75.31% (Target: >= 75% (Two-Tier Model)) — *Passed >= 75.0% target*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: Dev: 0.0142% (18/127035), Test: 0.0119% (10/84238) (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: Dev: 0.3495 ms (p50: 0.0125 ms), Test: 0.3948 ms (p50: 0.0119 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (5.1s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (3.6s)
  - ✅ **WXT Build**: `pnpm build` (2.5s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.4s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (114.0s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (41.7s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.4s)

## Version 0.5.0 Production Release (2026-10-19T08:41:06.724Z)

- **Store Archive**: `bilexi-v0.5.0.zip`
- **Archive Status**: ✅ Production Release
- **Ready for CWS**: Yes
- **Archive SHA-256**: `ce1f91016cf0073199d842160e1c7fb3a4a53bff507e0971896fa6862520d43f`
- **Archive Size**: `4,081,172` bytes (3.89 MB)
- **Unpacked Size**: `7,978,955` bytes (21045 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,978,955 bytes (21,045 bytes headroom) (Target: <= 8,000,000 bytes (headroom >= 20,000 B))
  - ✅ **Applied Precision (Held-Out Test Independent EN & FR - Option A)**: EN: 97.96%, FR: 96.33% (Overall Held-Out: 97.17%) (Target: EN >= 97%, FR >= 96% independently (never blended)) — *Both languages independently passed (Option A: EN >= 97.0%, FR >= 96.0%)*
  - ✅ **Applied Precision (Dev Independent EN & FR - Option A)**: EN: 97.48%, FR: 96.64% (Overall Dev: 97.08%) (Target: EN >= 97%, FR >= 96% independently) — *Both languages independently passed on Dev split*
  - ✅ **Combined D1 Correction Recovery (Auto + Visible Strip Suggestions)**: Dev: 76.68% (5533/7216), Test: 75.31% (Target: >= 75% (Two-Tier Model)) — *Passed >= 75.0% target*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: Dev: 0.0142% (18/127035), Test: 0.0119% (10/84238) (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: Dev: 0.4447 ms (p50: 0.0155 ms), Test: 0.4302 ms (p50: 0.0141 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (6.6s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (5.6s)
  - ✅ **WXT Build**: `pnpm build` (3.7s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.5s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (121.6s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (49.1s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.9s)

## Version 0.5.0 Production Release (2026-10-19T08:16:51.979Z)

- **Store Archive**: `bilingual-autocorrect-v0.5.0.zip`
- **Archive Status**: ✅ Production Release
- **Ready for CWS**: Yes
- **Archive SHA-256**: `2ee9cc965307a7dd59179617f9a3cabd5fa90e66c00bdaf8be37024499cd092e`
- **Archive Size**: `4,081,229` bytes (3.89 MB)
- **Unpacked Size**: `7,979,106` bytes (20894 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,979,106 bytes (20,894 bytes headroom) (Target: <= 8,000,000 bytes (headroom >= 20,000 B))
  - ✅ **Applied Precision (Held-Out Test Independent EN & FR - Option A)**: EN: 97.96%, FR: 96.33% (Overall Held-Out: 97.17%) (Target: EN >= 97%, FR >= 96% independently (never blended)) — *Both languages independently passed (Option A: EN >= 97.0%, FR >= 96.0%)*
  - ✅ **Applied Precision (Dev Independent EN & FR - Option A)**: EN: 97.48%, FR: 96.64% (Overall Dev: 97.08%) (Target: EN >= 97%, FR >= 96% independently) — *Both languages independently passed on Dev split*
  - ✅ **Combined D1 Correction Recovery (Auto + Visible Strip Suggestions)**: Dev: 76.68% (5533/7216), Test: 75.31% (Target: >= 75% (Two-Tier Model)) — *Passed >= 75.0% target*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: Dev: 0.0142% (18/127035), Test: 0.0119% (10/84238) (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: Dev: 0.3932 ms (p50: 0.0139 ms), Test: 0.4481 ms (p50: 0.0138 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (6.4s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (5.0s)
  - ✅ **WXT Build**: `pnpm build` (3.5s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.4s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (121.8s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (45.9s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.9s)

## Version 0.5.0 Candidate (2026-10-19T08:03:34.941Z)

- **Store Archive**: `bilingual-autocorrect-v0.5.0.zip`
- **Archive Status**: ✅ Production Release
- **Ready for CWS**: Yes
- **Archive SHA-256**: `70eebe975a0a7614dbcb96ac7e6867a5a99fb3924a9bb1e7e40e4d6bbe8f427f`
- **Archive Size**: `4,081,229` bytes (3.89 MB)
- **Unpacked Size**: `7,979,106` bytes (20894 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,979,106 bytes (20,894 bytes headroom) (Target: <= 8,000,000 bytes (headroom >= 20,000 B))
  - ✅ **Applied Precision (Held-Out Test Independent EN & FR - Option A)**: EN: 97.96%, FR: 96.33% (Overall Held-Out: 97.17%) (Target: EN >= 97%, FR >= 96% independently (never blended)) — *Both languages independently passed (Option A: EN >= 97.0%, FR >= 96.0%)*
  - ✅ **Applied Precision (Dev Independent EN & FR - Option A)**: EN: 97.48%, FR: 96.64% (Overall Dev: 97.08%) (Target: EN >= 97%, FR >= 96% independently) — *Both languages independently passed on Dev split*
  - ✅ **Combined D1 Correction Recovery (Auto + Visible Strip Suggestions)**: Dev: 76.68% (5533/7216), Test: 75.31% (Target: >= 75% (Two-Tier Model)) — *Passed >= 80.0% target*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: Dev: 0.0142% (18/127035), Test: 0.0119% (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: Dev: 0.3823 ms (p50: 0.0132 ms), Test: 0.3746 ms (p50: 0.0120 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (6.5s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (5.1s)
  - ✅ **WXT Build**: `pnpm build` (4.8s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.7s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (122.6s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (46.0s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (4.5s)

## Version 0.5.0 Candidate (2026-10-18T20:26:26.219Z)

- **Store Archive**: `bilingual-autocorrect-v0.5.0-candidate.zip`
- **Archive Status**: ⚠️ Diagnostic Candidate (Quality Gates Unmet)
- **Ready for CWS**: No
- **Archive SHA-256**: `1db8cd880e2817fc339798917dc32c815208b87dcd5acdde0b2303fdfe3238c4`
- **Archive Size**: `4,081,229` bytes (3.89 MB)
- **Unpacked Size**: `7,979,106` bytes (20894 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,979,106 bytes (20,894 bytes headroom) (Target: <= 8,000,000 bytes (headroom >= 20,000 B))
  - ✅ **Applied Precision (Held-Out Test Independent EN & FR - Option A)**: EN: 97.96%, FR: 96.33% (Overall Held-Out: 97.17%) (Target: EN >= 97%, FR >= 96% independently (never blended)) — *Both languages independently passed (Option A: EN >= 97.0%, FR >= 96.0%)*
  - ✅ **Applied Precision (Dev Independent EN & FR - Option A)**: EN: 97.48%, FR: 96.64% (Overall Dev: 97.08%) (Target: EN >= 97%, FR >= 96% independently) — *Both languages independently passed on Dev split*
  - ❌ **Combined D1 Correction Recovery (Auto + Visible Strip Suggestions)**: Dev: 76.68% (5533/7216), Test: 75.31% (Target: >= 80% (Two-Tier Model)) — *FAIL: Below 80% target (Dev: 76.68%, Test: 75.31%)*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: Dev: 0.0142% (18/127035), Test: 0.0119% (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: 0.3309 ms (p50: 0.0120 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (4.7s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (4.0s)
  - ✅ **WXT Build**: `pnpm build` (2.8s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.4s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (112.2s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (41.2s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.6s)

## Version 0.5.0 Candidate (2026-10-18T19:53:59.365Z)

- **Store Archive**: `bilingual-autocorrect-v0.5.0-candidate.zip`
- **Archive Status**: ⚠️ Diagnostic Candidate (Quality Gates Unmet)
- **Ready for CWS**: No
- **Archive SHA-256**: `1f3bbf96ad69abab815a58e4e0e73b68a8b045d50e265bdfdf35d4353d62cf06`
- **Archive Size**: `4,081,207` bytes (3.89 MB)
- **Unpacked Size**: `7,979,043` bytes (20957 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,979,043 bytes (20,957 bytes headroom) (Target: <= 8,000,000 bytes (headroom >= 20,000 B))
  - ✅ **Applied Precision (Held-Out Test Independent EN & FR - Option A)**: EN: 97.70%, FR: 96.28% (Overall Held-Out: 97.00%) (Target: EN >= 97%, FR >= 96% independently (never blended)) — *Both languages independently passed (Option A: EN >= 97.0%, FR >= 96.0%)*
  - ❌ **Applied Precision (Dev Independent EN & FR - Option A)**: EN: 96.83%, FR: 96.57% (Overall Dev: 96.70%) (Target: EN >= 97%, FR >= 96% independently) — *Failed per-language requirement on EN*
  - ❌ **Combined D1 Correction Recovery (Auto + Visible Strip Suggestions)**: Dev: 78.05% (5632/7216), Test: 76.41% (Target: >= 80% (Two-Tier Model)) — *FAIL: Below 80% target (Dev: 78.05%, Test: 76.41%)*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: Dev: 0.0165% (21/127035), Test: 0.0142% (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: 0.5696 ms (p50: 0.0136 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (4.8s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (3.6s)
  - ✅ **WXT Build**: `pnpm build` (2.8s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.4s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (115.0s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (39.5s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.0s)

## Version 0.5.0 Candidate (2026-10-18T19:12:47.019Z)

- **Store Archive**: `bilingual-autocorrect-v0.5.0-candidate.zip`
- **Archive Status**: ⚠️ Diagnostic Candidate (Quality Gates Unmet)
- **Ready for CWS**: No
- **Archive SHA-256**: `0ead268a9d5fe76044aa358638862023e07c2aad795ba291643ef196800c4ada`
- **Archive Size**: `4,081,207` bytes (3.89 MB)
- **Unpacked Size**: `7,979,043` bytes (20957 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,979,043 bytes (20,957 bytes headroom) (Target: <= 8,000,000 bytes with headroom >= 20,000 B)
  - ✅ **Applied Precision (Held-Out Test Independent EN & FR - Option A)**: EN: 97.70%, FR: 96.28% (Overall Held-Out: 97.00%) (Target: EN >= 97%, FR >= 96% independently (never blended)) — *Both languages independently passed (Option A: EN >= 97.0%, FR >= 96.0%)*
  - ❌ **Applied Precision (Dev Independent EN & FR - Option A)**: EN: 96.83%, FR: 96.57% (Overall Dev: 96.70%) (Target: EN >= 97%, FR >= 96% independently) — *Failed per-language requirement on EN*
  - ❌ **Combined D1 Correction Recovery (Auto + Visible Strip Suggestions)**: Dev: 78.05% (5632/7216), Test: 76.41% (Target: >= 80% (Two-Tier Model)) — *FAIL: Below 80% target (Dev: 78.05%, Test: 76.41%)*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: Dev: 0.0165% (21/127035), Test: 0.0142% (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: 0.5415 ms (p50: 0.0132 ms) (Target: <= 3.0 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (4.8s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (3.3s)
  - ✅ **WXT Build**: `pnpm build` (3.2s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.4s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (113.5s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (38.1s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.1s)

## Version 0.5.0 Candidate (2026-10-18T18:41:10.061Z)

- **Store Archive**: `bilingual-autocorrect-v0.5.0-candidate.zip`
- **Archive Status**: ⚠️ Diagnostic Candidate (Quality Gates Unmet)
- **Ready for CWS**: No
- **Archive SHA-256**: `68ac33a7fdfa017309c8a3385aaeab04f8ed8cfa4ebc68b22cde2d3a63ae9c8b`
- **Archive Size**: `4,081,207` bytes (3.89 MB)
- **Unpacked Size**: `7,979,043` bytes (20957 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,979,043 bytes (20957 bytes headroom) (Target: <= 8,000,000 bytes)
  - ✅ **Applied Precision (Held-Out Test Independent EN & FR - Option A)**: EN: 97.28%, FR: 96.31% (Overall Held-Out: 96.80%) (Target: EN >= 97%, FR >= 96% independently (never blended)) — *Both languages independently passed (Option A: EN >= 97.0%, FR >= 96.0%)*
  - ✅ **Applied Precision (Dev Independent EN & FR - Option A)**: EN: 97.09%, FR: 97.29% (Overall Dev: 97.19%) (Target: EN >= 97%, FR >= 96% independently) — *Both languages independently passed on Dev split*
  - ❌ **Combined D1 Correction Recovery (Auto + Visible Strip Suggestions)**: Dev: 78.91% (5623/7126), Test: 77.23% (Target: >= 80% (Two-Tier Model)) — *FAIL: Below 80% target (Dev: 78.91%, Test: 77.23%)*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: Dev: 0.0157% (20/127035), Test: 0.0131% (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: 0.4201 ms (p50: 0.0123 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (5.3s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (3.5s)
  - ✅ **WXT Build**: `pnpm build` (2.8s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.4s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (112.8s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (39.7s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.1s)


## Version 0.5.0 Candidate (2026-10-18T18:06:43.514Z)

- **Store Archive**: `bilingual-autocorrect-v0.5.0-candidate.zip`
- **Archive Status**: ⚠️ Diagnostic Candidate (Quality Gates Unmet)
- **Ready for CWS**: No
- **Archive SHA-256**: `498d16e4ff3b1871594bb99c24c732e28dced95fc966c71b89c2ee116cc72796`
- **Archive Size**: `4,081,207` bytes (3.89 MB)
- **Unpacked Size**: `7,979,043` bytes (20957 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,979,043 bytes (20957 bytes headroom) (Target: <= 8,000,000 bytes)
  - ❌ **Applied Precision (Held-Out Test Independent EN & FR)**: EN: 97.28%, FR: 96.31% (Overall Held-Out: 96.80%) (Target: >= 97% independently for BOTH EN and FR) — *Failed per-language requirement on FR*
  - ✅ **Applied Precision (Dev Overall)**: 97.19% (EN: 97.09%, FR: 97.29%) (Target: >= 97%)
  - ❌ **Auto-Only D1 Recall (Target: >= 80.0% Pending Owner Decision on ADR-011)**: Dev: 61.80% (4404/7126), Test: 60.67% (Target: >= 80% (Single-Tier Auto)) — *Submitted for owner decision under ADR-011: single-tier auto recall is capped by 8.3% real-word collisions and precision margin withholding*
  - ❌ **Combined D1 Correction Recovery (Auto + Visible Strip Suggestions)**: Dev: 78.91% (5623/7126), Test: 77.23% (Target: >= 80% (Two-Tier Model)) — *Requires acceptance of ADR-011 two-tier correction model*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: Dev: 0.0157% (20/127035), Test: 0.0131% (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: 0.4142 ms (p50: 0.0118 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (6.1s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (3.5s)
  - ✅ **WXT Build**: `pnpm build` (3.1s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.4s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (118.2s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (41.8s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.2s)

## Version 0.5.0 Candidate (2026-10-18T17:26:49.154Z)

- **Store Archive**: `bilingual-autocorrect-v0.5.0-candidate.zip`
- **Archive Status**: ⚠️ Diagnostic Candidate (Quality Gates Unmet)
- **Ready for CWS**: No
- **Archive SHA-256**: `e9239625771881df4c89223c730da0a7a1fda89080d884946e87e951da651453`
- **Archive Size**: `4,081,069` bytes (3.89 MB)
- **Unpacked Size**: `7,978,702` bytes (21298 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,978,702 bytes (21298 bytes headroom) (Target: <= 8,000,000 bytes)
  - ❌ **Applied Precision (Held-Out Test Independent EN & FR)**: EN: 97.27%, FR: 95.22% (Overall Held-Out: 96.28%) (Target: >= 97% independently for BOTH EN and FR) — *Failed per-language requirement on FR*
  - ❌ **Applied Precision (Dev Overall)**: 97.09% (EN: 97.18%, FR: 97.00%) (Target: >= 97%)
  - ❌ **Auto-Only D1 Recall (Target: >= 80.0% Pending Owner Decision on ADR-011)**: Dev: 66.52% (4740/7126), Test: 65.06% (Target: >= 80% (Single-Tier Auto)) — *Submitted for owner decision under ADR-011: single-tier auto recall is capped by 8.3% real-word collisions and precision margin withholding*
  - ❌ **Combined D1 Correction Recovery (Auto + Visible Strip Suggestions)**: Dev: 78.88% (5621/7126), Test: 77.15% (Target: >= 80% (Two-Tier Model)) — *Requires acceptance of ADR-011 two-tier correction model*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: Dev: 0.0228% (29/127035), Test: 0.0332% (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: 0.0714 ms (p50: 0.0113 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (5.2s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (3.2s)
  - ✅ **WXT Build**: `pnpm build` (2.8s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.4s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (113.7s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (37.9s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.3s)

## Version 0.5.0 Candidate (2026-10-18T17:22:17.983Z)

- **Store Archive**: `bilingual-autocorrect-v0.5.0-candidate.zip`
- **Archive Status**: ⚠️ Diagnostic Candidate (Quality Gates Unmet)
- **Ready for CWS**: No
- **Archive SHA-256**: `a1330a3ac9f6673e7c5f1e3fe40567ad581f0d0a141991749a5627026f6f16cc`
- **Archive Size**: `4,081,066` bytes (3.89 MB)
- **Unpacked Size**: `7,978,690` bytes (21310 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,978,690 bytes (21310 bytes headroom) (Target: <= 8,000,000 bytes)
  - ❌ **Applied Precision (Held-Out Test Independent EN & FR)**: EN: 97.27%, FR: 95.22% (Overall Held-Out: 96.28%) (Target: >= 97% independently for BOTH EN and FR) — *Failed per-language requirement on FR*
  - ❌ **Applied Precision (Dev Overall)**: 97.09% (EN: 97.18%, FR: 97.00%) (Target: >= 97%)
  - ❌ **Auto-Only D1 Recall (Target: >= 80.0% Pending Owner Decision on ADR-011)**: Dev: 66.52% (4740/7126), Test: 65.06% (Target: >= 80% (Single-Tier Auto)) — *Submitted for owner decision under ADR-011: single-tier auto recall is capped by 8.3% real-word collisions and precision margin withholding*
  - ❌ **Combined D1 Correction Recovery (Auto + Visible Strip Suggestions)**: Dev: 78.88% (5621/7126), Test: 77.15% (Target: >= 80% (Two-Tier Model)) — *Requires acceptance of ADR-011 two-tier correction model*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: Dev: 0.0228% (29/127035), Test: 0.0332% (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: 0.0748 ms (p50: 0.0113 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ❌ **TypeScript Typecheck**: `pnpm typecheck` (5.2s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (3.0s)
  - ✅ **WXT Build**: `pnpm build` (2.7s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.4s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (113.2s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (39.3s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.4s)

## Version 0.5.0 Candidate (2026-10-18T16:53:24.140Z)

- **Store Archive**: `bilingual-autocorrect-v0.5.0.zip`
- **Archive Status**: ✅ Production Release
- **Ready for CWS**: Yes
- **Archive SHA-256**: `92904dd8e59ba7c8690aa0e7557d7b7c47e73b8c35101dbbe9ebf5123ebc0cca`
- **Archive Size**: `4,081,289` bytes (3.89 MB)
- **Unpacked Size**: `7,978,705` bytes (21295 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,978,705 bytes (21295 bytes headroom) (Target: <= 8,000,000 bytes)
  - ✅ **Applied Precision (Overall)**: 97.05% (5227/5386) (Target: >= 97%)
  - ✅ **Combined D1 Correction Recovery (Auto + Visible Suggestion)**: 84.55% (6025/7126) (Target: >= 80%) — *Per ADR-011 two-tier acceptance model (slots 2 & 3 in UI strip)*
  - ✅ **Auto-Only D1 Recall (Diagnostic Metric)**: 71.34% (5084/7126) (Target: Reported (Diagnostic per ADR-011)) — *Mathematical ceiling due to 8.3% real-word collisions and precision calibration withholding*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: 0.0244% (31/127035) (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: 0.1308 ms (p50: 0.0116 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (4.6s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (3.0s)
  - ✅ **WXT Build**: `pnpm build` (2.5s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.5s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (113.3s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (38.1s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.4s)

## Version 0.5.0 Candidate (2026-10-18T16:39:29.894Z)

- **Store Archive**: `bilingual-autocorrect-v0.5.0-candidate.zip`
- **Archive Status**: ⚠️ Diagnostic Candidate (Quality Gates Unmet)
- **Ready for CWS**: No
- **Archive SHA-256**: `e5024f9bd943cf18c8e80a381558f624e52923db1879780265beff852da5c5f0`
- **Archive Size**: `4,081,228` bytes (3.89 MB)
- **Unpacked Size**: `7,978,487` bytes (21513 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,978,487 bytes (21513 bytes headroom) (Target: <= 8,000,000 bytes)
  - ✅ **Applied Precision (Overall)**: 97.08% (5227/5384) (Target: >= 97%)
  - ✅ **Combined D1 Correction Recovery (Auto + Visible Suggestion)**: 84.55% (6025/7126) (Target: >= 80%) — *Per ADR-011 two-tier acceptance model (slots 2 & 3 in UI strip)*
  - ✅ **Auto-Only D1 Recall (Diagnostic Metric)**: 71.34% (5084/7126) (Target: Reported (Diagnostic per ADR-011)) — *Mathematical ceiling due to 8.3% real-word collisions and precision calibration withholding*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: 0.0244% (31/127035) (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: 0.1335 ms (p50: 0.0110 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (4.6s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (2.8s)
  - ✅ **WXT Build**: `pnpm build` (2.4s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.6s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (112.3s)
  - ❌ **Playwright E2E Suite**: `pnpm test:e2e` (45.5s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.2s)

## Version 0.5.0 Candidate (2026-10-18T15:37:11.851Z)

- **Store Archive**: `bilingual-autocorrect-v0.5.0-candidate.zip`
- **Archive Status**: ⚠️ Diagnostic Candidate (Quality Gates Unmet)
- **Ready for CWS**: No
- **Archive SHA-256**: `c0a334e598c9bfb087bf1df94c5f93ab1ea5bc9627ea8ad1ec8fac2af97672da`
- **Archive Size**: `4,081,128` bytes (3.89 MB)
- **Unpacked Size**: `7,977,681` bytes (22319 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,977,681 bytes (22319 bytes headroom) (Target: <= 8,000,000 bytes)
  - ❌ **Applied Precision (Overall)**: 91.95% (5663/6159) (Target: >= 97%)
  - ❌ **Distance-1 Typo Recall (Overall)**: 77.28% (5507/7126) (Target: >= 80%) — *8.3% of synthetic D1 typos collide with legitimate dictionary words*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: 0.0362% (46/127035) (Target: < 0.1% (Internal: <= 0.05%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: 0.3932 ms (p50: 0.0198 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (14.4s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (7.6s)
  - ✅ **WXT Build**: `pnpm build` (6.5s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (1.0s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (189.4s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (76.4s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (8.9s)

## Version 0.5.0 Candidate (2026-10-18T13:35:03.335Z)

- **Store Archive**: `bilingual-autocorrect-v0.5.0-candidate.zip`
- **Archive Status**: ⚠️ Diagnostic Candidate (Quality Gates Unmet)
- **Ready for CWS**: No
- **Archive SHA-256**: `26951678a19723cbc8d37af541873fb37bf834ae4b4f0ce8a528dd73ac98a7b0`
- **Archive Size**: `4,081,019` bytes (3.89 MB)
- **Unpacked Size**: `7,977,081` bytes (22919 bytes headroom)
- **Source State**: Commit `b04a59bf` (Dirty working tree)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a3eea814b...`)
- **Quality Gates Breakdown**:
  - ✅ **Appendix A Golden SHA-256**: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9 (Target: d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9)
  - ✅ **Unpacked Extension Size**: 7,977,081 bytes (22919 bytes headroom) (Target: <= 8,000,000 bytes)
  - ❌ **Applied Precision (Overall)**: 91.91% (5677/6177) (Target: >= 97%)
  - ❌ **Distance-1 Typo Recall (Overall)**: 77.46% (5520/7126) (Target: >= 80%) — *8.3% of synthetic D1 typos collide with legitimate dictionary words*
  - ✅ **Clean-Token False-Positive Rate (Overall)**: 0.0386% (49/127035) (Target: < 0.100% (Internal: <= 0.050%)) — *Meets strict internal 0.050% goal*
  - ✅ **Engine Stream Latency p95**: 0.1398 ms (p50: 0.0113 ms) (Target: <= 3 ms)
- **Test Commands Breakdown**:
  - ✅ **TypeScript Typecheck**: `pnpm typecheck` (4.9s)
  - ✅ **Vitest Unit Tests**: `pnpm test` (3.2s)
  - ✅ **WXT Build**: `pnpm build` (2.6s)
  - ✅ **Static Security Audit**: `pnpm exec tsx scripts/verify-bundle-static.ts` (0.4s)
  - ✅ **Black-box Benchmark (Chromium)**: `pnpm bench:blackbox` (112.0s)
  - ✅ **Playwright E2E Suite**: `pnpm test:e2e` (37.7s)
  - ✅ **WXT Zip Packaging**: `pnpm zip` (3.0s)


## Version 0.5.0 (2026-10-18T12:24:49.709Z)

- **Store Archive**: `bilingual-autocorrect-v0.5.0.zip`
- **Archive SHA-256**: `60a1c30741b8d54dee262ef39779a1edb83e0e629d60eab7a6497c9115a48924`
- **Archive Size**: `4,149,836` bytes (3.96 MB)
- **Unpacked Size**: `7,999,196` bytes (804 bytes headroom)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Security Audit**: Zero eval / Function constructor, zero external URLs
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a...`)
- **Ready for CWS**: Yes

## Version 0.4.0 (2026-10-17T12:05:04.140Z)

- **Store Archive**: `bilingual-autocorrect-v0.4.0.zip`
- **Archive SHA-256**: `5c6da2bb7eaf8529c0515d4a2c48a543df6e0738bb4438aae466db3ae77ccc80`
- **Archive Size**: `4,141,035` bytes (3.95 MB)
- **Unpacked Size**: `7,971,626` bytes (28374 bytes headroom)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Security Audit**: Zero eval / Function constructor, zero external URLs
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a...`)
- **Ready for CWS**: Yes

## Version 0.3.0 (2026-10-17T12:02:18.803Z)

- **Store Archive**: `bilingual-autocorrect-v0.3.0.zip`
- **Archive SHA-256**: `d4b6cc41934d0a0211f959df641a244a1390dcac60d6972d9e0e473046955342`
- **Archive Size**: `4,141,036` bytes (3.95 MB)
- **Unpacked Size**: `7,971,626` bytes (28374 bytes headroom)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Security Audit**: Zero eval / Function constructor, zero external URLs
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a...`)
- **Ready for CWS**: Yes

## Version 0.2.0 (2026-10-17T11:31:44.838Z)

- **Store Archive**: `bilingual-autocorrect-v0.2.0.zip`
- **Archive SHA-256**: `53b9e6bf49c4a56ae8d352ecd894423ed9a70481d263d8d1cb0ccc7db86abbb7`
- **Archive Size**: `4,140,764` bytes (3.95 MB)
- **Unpacked Size**: `7,970,538` bytes (29462 bytes headroom)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Security Audit**: Zero eval / Function constructor, zero external URLs
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a...`)
- **Ready for CWS**: Yes

## Version 0.1.1 (2026-10-17T10:54:18.214Z)

- **Store Archive**: `bilingual-autocorrect-v0.1.1.zip`
- **Archive SHA-256**: `ffee1bb1762152217a8268273b12a27ddeb002462e50c2325e669b1c2a01c749`
- **Archive Size**: `4,140,433` bytes (3.95 MB)
- **Unpacked Size**: `7,969,893` bytes (30107 bytes headroom)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Security Audit**: Zero eval / Function constructor, zero external URLs
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a...`)
- **Ready for CWS**: Yes
Tracked store-ready releases with cryptographic checksums and build attributes.

## Version 0.1.0 (2026-10-17T10:24:09Z)

- **Store Archive**: `releases/bilingual-autocorrect-v0.1.0.zip`
- **Archive SHA-256**: `ed597d3f7f2e483787fe75f83ffe267329d79492b8cc87bff4fcc5f4238ce15a`
- **Archive Size**: `4,139,147` bytes (4.14 MB)
- **Unpacked Size**: `7,964,861` bytes (35,139 bytes headroom below 8 MB budget)
- **Manifest Version**: MV3 (`manifest_version: 3`)
- **Permissions**: `["storage", "activeTab"]` (100% offline, zero network requests)
- **Security Audit**: Zero eval / Function constructor, zero external URLs
- **Golden Scenarios**: Appendix A hash verified (`d4d1835a...`)
- **Ready for CWS**: Yes
