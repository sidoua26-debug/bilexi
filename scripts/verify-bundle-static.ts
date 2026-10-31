/**
 * Static Bundle Audit & Permission Snapshot (Task 5k)
 * Checks:
 * 1. Zero eval / new Function in bundle
 * 2. Zero remote external URLs in production JavaScript
 * 3. Manifest permissions snapshot (storage and activeTab only)
 * 4. web_accessible_resources has use_dynamic_url: true
 */

import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve('.output/chrome-mv3');

function getAllFiles(dir: string, ext = '.js'): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, ext));
    } else if (file.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

function runStaticAudit() {
  console.log('=== Task 5(k): Static Bundle Audit & Manifest Snapshot ===\n');

  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(`.output/chrome-mv3 directory does not exist! Run pnpm build first.`);
  }

  // 1. Audit Manifest
  const manifestPath = path.join(DIST_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  console.log('1. Manifest Permission Snapshot:');
  console.log(`  - Manifest Version: ${manifest.manifest_version}`);
  console.log(`  - Permissions: ${JSON.stringify(manifest.permissions)}`);
  
  const allowedPermissions = new Set(['storage', 'activeTab']);
  const extraPermissions = (manifest.permissions || []).filter((p: string) => !allowedPermissions.has(p));
  
  if (extraPermissions.length > 0) {
    console.error(`  ❌ FAILED: Unexpected permissions found: ${extraPermissions.join(', ')}`);
    process.exit(1);
  } else {
    console.log(`  ✅ PASS: Permissions are strictly ['storage', 'activeTab'] only.`);
  }

  // Check web_accessible_resources
  const war = manifest.web_accessible_resources || [];
  const hasDynamicUrl = war.some((r: { use_dynamic_url?: boolean }) => r.use_dynamic_url === true);
  console.log(`  - Web Accessible Resources: ${JSON.stringify(war)}`);
  if (!hasDynamicUrl) {
    console.error(`  ❌ FAILED: web_accessible_resources missing use_dynamic_url: true`);
    process.exit(1);
  } else {
    console.log(`  ✅ PASS: use_dynamic_url: true verified in built manifest.`);
  }

  // Check icons in manifest and filesystem
  console.log('\n  - Checking Extension Icons:');
  const iconSizes = ['16', '32', '48', '128'];
  for (const size of iconSizes) {
    const iconRel = manifest.icons?.[size];
    if (!iconRel) {
      console.error(`  ❌ FAILED: Missing manifest.icons['${size}']`);
      process.exit(1);
    }
    const iconPath = path.join(DIST_DIR, iconRel);
    if (!fs.existsSync(iconPath) || fs.statSync(iconPath).size === 0) {
      console.error(`  ❌ FAILED: Icon file does not exist or is empty: ${iconRel}`);
      process.exit(1);
    }
    console.log(`    ✅ Icon ${size}x${size} verified: ${iconRel} (${fs.statSync(iconPath).size} bytes)`);
  }

  // Check content stylesheet
  console.log('\n  - Checking Content Stylesheet:');
  const cssPath = path.join(DIST_DIR, 'content-scripts/content.css');
  if (!fs.existsSync(cssPath) || fs.statSync(cssPath).size === 0) {
    console.error(`  ❌ FAILED: content-scripts/content.css does not exist or is empty in ${DIST_DIR}`);
    process.exit(1);
  }
  console.log(`    ✅ content-scripts/content.css verified (${fs.statSync(cssPath).size} bytes)`);

  // Release check: Verify every path referenced from manifest, HTML exists in build
  console.log('\n  - Verifying Referenced Path Integrity in Build:');
  const referencedPaths: string[] = [];
  if (manifest.action?.default_popup) referencedPaths.push(manifest.action.default_popup);
  if (manifest.background?.service_worker) referencedPaths.push(manifest.background.service_worker);
  if (manifest.options_ui?.page) referencedPaths.push(manifest.options_ui.page);
  if (manifest.content_scripts) {
    for (const cs of manifest.content_scripts) {
      if (cs.js) referencedPaths.push(...cs.js);
      if (cs.css) referencedPaths.push(...cs.css);
    }
  }

  // Check HTML files
  const htmlFiles = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.html'));
  for (const hf of htmlFiles) {
    const htmlContent = fs.readFileSync(path.join(DIST_DIR, hf), 'utf-8');
    const srcMatches = htmlContent.matchAll(/(?:src|href)=["']([^"':#]+)["']/g);
    for (const m of srcMatches) {
      const ref = m[1];
      if (ref && !ref.startsWith('http') && !ref.startsWith('//') && !ref.startsWith('data:')) {
        referencedPaths.push(ref.startsWith('/') ? ref.slice(1) : ref);
      }
    }
  }

  let missingPaths = 0;
  for (const ref of referencedPaths) {
    const targetPath = path.join(DIST_DIR, ref);
    if (!fs.existsSync(targetPath)) {
      console.error(`  ❌ FAILED: Referenced file does not exist: ${ref}`);
      missingPaths++;
    } else {
      console.log(`    ✅ Referenced path verified: ${ref}`);
    }
  }
  if (missingPaths > 0) {
    process.exit(1);
  }


  // 2. Audit JavaScript Bundle Files
  const jsFiles = getAllFiles(DIST_DIR, '.js');
  console.log(`\n2. Auditing ${jsFiles.length} JavaScript Bundle Files for Remote Code & URLs:`);

  let evalCount = 0;
  let remoteUrlCount = 0;

  for (const jsFile of jsFiles) {
    const relPath = path.relative(DIST_DIR, jsFile);
    const content = fs.readFileSync(jsFile, 'utf-8');

    // Check for eval or Function constructor
    if (/\beval\(|new\s+Function\(/.test(content)) {
      console.error(`  ❌ FAILED: eval or new Function found in ${relPath}`);
      evalCount++;
    }

    // Check for active remote network calls (fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon)
    const activeNetworkCallRegex = /(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(\s*['"`](?:https?:)?\/\//g;
    const activeNetworkCalls = content.match(activeNetworkCallRegex) || [];
    if (activeNetworkCalls.length > 0) {
      console.error(`  ❌ FAILED: Active remote network calls found in ${relPath}: ${activeNetworkCalls.join(', ')}`);
      remoteUrlCount += activeNetworkCalls.length;
    }

    // Verify all fetch calls only use chrome.runtime.getURL
    const fetchCalls = content.match(/fetch\s*\([^)]*\)/g) || [];
    for (const fc of fetchCalls) {
      if (!fc.includes('chrome.runtime.getURL') && !fc.includes('dict/')) {
        // If it's not fetching chrome.runtime.getURL or a local path, flag it
        if (/https?:\/\//.test(fc)) {
          console.error(`  ❌ FAILED: Remote fetch call found in ${relPath}: ${fc}`);
          remoteUrlCount++;
        }
      }
    }

    // Documentation URLs in error strings (e.g. reactjs.org/docs, developer.mozilla.org)
    const docUrlMatches = content.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s"'`<>)]*/g) || [];
    const nonDocUrls = docUrlMatches.filter(u => {
      if (u.includes('reactjs.org') || u.includes('developer.mozilla.org') || u.includes('www.w3.org')) return false;
      return true;
    });

    if (nonDocUrls.length > 0) {
      console.error(`  ❌ FAILED: Unexpected remote URLs found in ${relPath}: ${nonDocUrls.join(', ')}`);
      remoteUrlCount += nonDocUrls.length;
    } else {
      console.log(`  ✅ PASS: ${relPath} (zero eval, zero remote network calls, verified local-only fetch)`);
    }
  }

  console.log('\n========================================================');
  if (evalCount === 0 && remoteUrlCount === 0) {
    console.log('✅ STATIC AUDIT PASSED: 100% offline, zero eval, zero remote code.');
  } else {
    console.error('❌ STATIC AUDIT FAILED');
    process.exit(1);
  }
  console.log('========================================================\n');
}

runStaticAudit();
