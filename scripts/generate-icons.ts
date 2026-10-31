import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="100%" stop-color="#1E40AF" />
    </linearGradient>
    <linearGradient id="checkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25" />
    </filter>
  </defs>

  <!-- Background Squircle -->
  <rect x="4" y="4" width="120" height="120" rx="26" ry="26" fill="url(#bgGrad)" />

  <!-- Letter 'A' (Vector paths for crisp rendering) -->
  <g fill="#FFFFFF" filter="url(#shadow)">
    <!-- Main A glyph: outer triangle minus inner triangle -->
    <path d="M 46 28 L 22 92 L 39 92 L 44 78 L 68 78 L 73 92 L 90 92 L 66 28 Z M 56 46 L 64 66 L 48 66 Z" />
    <!-- French accent aigu above the A -->
    <path d="M 68 14 L 56 23 L 61 27 L 74 17 Z" fill="#67E8F9" />
  </g>

  <!-- Autocorrect Check Badge (Bottom Right) -->
  <circle cx="96" cy="96" r="24" fill="#0F172A" />
  <circle cx="96" cy="96" r="21" fill="url(#checkGrad)" />
  <path d="M 86 96 L 93 103 L 107 88" fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const iconsDir = path.resolve('public/icons');
fs.mkdirSync(iconsDir, { recursive: true });

const svgPath = path.join(iconsDir, 'icon.svg');
fs.writeFileSync(svgPath, svgContent, 'utf-8');

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const outPng = path.join(iconsDir, `icon-${size}.png`);
  execSync(`convert -background none -resize ${size}x${size} "${svgPath}" "${outPng}"`);
  console.log(`Generated: ${outPng} (${size}x${size})`);
}
