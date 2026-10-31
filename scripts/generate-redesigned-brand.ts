import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

// Bilexi Brand Identity: Monogram "B" with dual linguistic flow and integrated acute accent
export const BILEXI_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="40%" stop-color="#0A1128" />
      <stop offset="100%" stop-color="#030712" />
    </linearGradient>

    <!-- Outer Border Glow -->
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.6" />
      <stop offset="50%" stop-color="#2563EB" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#06B6D4" stop-opacity="0.5" />
    </linearGradient>

    <!-- Primary Emblem Gradient (Electric Cobalt to Cyan) -->
    <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60A5FA" />
      <stop offset="50%" stop-color="#3B82F6" />
      <stop offset="100%" stop-color="#06B6D4" />
    </linearGradient>

    <!-- Accent Glide Gradient -->
    <linearGradient id="accentGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#06B6D4" />
      <stop offset="100%" stop-color="#38BDF8" />
    </linearGradient>

    <!-- Subtle Drop Shadow -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#0284C7" flood-opacity="0.45" />
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.6" />
    </filter>

    <filter id="accentGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#38BDF8" flood-opacity="0.7" />
    </filter>
  </defs>

  <!-- Background Squircle with Precision Border -->
  <rect x="16" y="16" width="480" height="480" rx="112" ry="112" fill="url(#bgGrad)" />
  <rect x="16" y="16" width="480" height="480" rx="112" ry="112" fill="none" stroke="url(#borderGrad)" stroke-width="4" />

  <!-- Ambient Internal Mesh Glow -->
  <circle cx="160" cy="140" r="160" fill="#2563EB" opacity="0.18" filter="blur(50px)" />
  <circle cx="360" cy="360" r="140" fill="#06B6D4" opacity="0.14" filter="blur(40px)" />

  <!-- Main Monogram Group -->
  <g filter="url(#glow)">
    <!-- Vertical Spine -->
    <rect x="144" y="132" width="54" height="256" rx="27" fill="url(#primaryGrad)" />

    <!-- Upper Loop (English stream, sleek curvature) -->
    <path d="M 170 132 L 284 132 C 342 132 376 160 376 208 C 376 248 346 272 292 276 L 170 276 Z" 
          fill="none" stroke="url(#primaryGrad)" stroke-width="50" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Lower Loop (French stream, dynamic width) -->
    <path d="M 170 264 L 298 264 C 362 264 402 294 402 344 C 402 396 360 428 290 428 L 170 428 Z" 
          fill="none" stroke="url(#primaryGrad)" stroke-width="50" stroke-linecap="round" stroke-linejoin="round" />
  </g>

  <!-- French Diacritic Accent Aigu (Floating Dynamic Spark) -->
  <path d="M 336 78 L 278 126 C 274 129 276 135 281 135 L 302 135 C 306 135 309 133 312 130 L 358 92 C 362 88 359 81 354 81 L 341 81 C 339 81 337 80 336 78 Z"
        fill="url(#accentGrad)" filter="url(#accentGlow)" />

  <!-- Dynamic Precision Dot / Verification Pip -->
  <circle cx="340" cy="270" r="14" fill="#38BDF8" opacity="0.9" />
</svg>`;

async function renderBrandAssets() {
  const outputDir = path.resolve('docs/screens/redesign');
  const iconsDir = path.resolve('public/icons');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Save master SVG
  const svgPath = path.join(outputDir, 'bilexi-icon.svg');
  fs.writeFileSync(svgPath, BILEXI_ICON_SVG, 'utf-8');
  console.log('✅ Saved master SVG:', svgPath);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const sizes = [
    { name: 'icon-512.png', size: 512, dest: outputDir },
    { name: 'icon-256.png', size: 256, dest: outputDir },
    { name: 'icon-128.png', size: 128, dest: outputDir },
    { name: 'icon-48.png', size: 48, dest: outputDir },
    { name: 'icon-32.png', size: 32, dest: outputDir },
    { name: 'icon-16.png', size: 16, dest: outputDir },
  ];

  for (const s of sizes) {
    await page.setViewportSize({ width: s.size, height: s.size });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { width: ${s.size}px; height: ${s.size}px; background: transparent; overflow: hidden; display: flex; align-items: center; justify-content: center; }
            svg { width: 100%; height: 100%; }
          </style>
        </head>
        <body>
          ${BILEXI_ICON_SVG}
        </body>
      </html>
    `);
    const targetFile = path.join(s.dest, s.name);
    await page.screenshot({ path: targetFile, omitBackground: true });
    console.log(`✅ Rendered ${s.name} (${s.size}x${s.size}) -> ${targetFile}`);
  }

  await browser.close();
}

renderBrandAssets().catch(console.error);
