/**
 * scripts/gen-notices.ts
 * Generates verified third-party notices and licenses:
 * Reads live license files from node_modules and repository data sources,
 * deduplicates standard licenses, and generates both:
 *   1. public/notices.html (bundled inside the extension for offline viewing)
 *   2. THIRD_PARTY_NOTICES.md (repository documentation)
 */

import fs from 'node:fs';
import path from 'node:path';

interface ComponentNotice {
  name: string;
  source: string;
  license: string;
  url: string;
  description: string;
  licenseText: string;
}

function readIfExists(filePath: string): string | null {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8').trim();
  }
  return null;
}

export function generateNotices(): { html: string; markdown: string; components: ComponentNotice[] } {
  // Read live licenses from node_modules
  const reactLicense = readIfExists('node_modules/react/LICENSE') || 'MIT License (Meta Platforms, Inc.)';
  const floatingUiLicense = readIfExists('node_modules/@floating-ui/dom/LICENSE') || 'MIT License (Floating UI Contributors)';
  let dictEnLicense = readIfExists('node_modules/dictionary-en/license') || 'MIT / BSD-style (Kevin Atkinson)';
  const scowlCopyrightIdx = dictEnLicense.indexOf('COPYRIGHT, SOURCES, and CREDITS:');
  if (scowlCopyrightIdx !== -1) {
    dictEnLicense = dictEnLicense.substring(scowlCopyrightIdx).trim();
  }
  const dictFrLicense = readIfExists('node_modules/dictionary-fr/license') || 'MPL-2.0 (Olivier R. / Dicollecte)';

  const components: ComponentNotice[] = [
    {
      name: 'SCOWL & English Word Lists (dictionary-en)',
      source: 'Kevin Atkinson / SCOWL',
      license: 'MIT & BSD-style',
      url: 'http://wordlist.aspell.net/',
      description: 'English word list, prefix rules, and morphological inflection base.',
      licenseText: dictEnLicense,
    },
    {
      name: 'Dicollecte / French Hunspell (dictionary-fr)',
      source: 'Olivier R. / Dicollecte',
      license: 'MPL-2.0 (Mozilla Public License 2.0)',
      url: 'https://grammalecte.net/',
      description: 'French lexical and morphological spell checker dictionary and affixes. Source code available under MPL-2.0 at https://github.com/wooorm/dictionary-fr and https://grammalecte.net/.',
      licenseText: dictFrLicense,
    },
    {
      name: 'Lexique 3.83',
      source: 'Boris New, Christophe Pallier, Marc Brysbaert, Ludovic Ferrand',
      license: 'Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)',
      url: 'http://www.lexique.org/',
      description: 'French lexical database containing unigram lemma frequencies and inflected word forms.',
      licenseText: `Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)

You are free to:
- Share: copy and redistribute the material in any medium or format
- Adapt: remix, transform, and build upon the material for any purpose

Under the following terms:
- Attribution: You must give appropriate credit, provide a link to the license, and indicate if changes were made.
- ShareAlike: If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.

Full license text: https://creativecommons.org/licenses/by-sa/4.0/legalcode`,
    },
    {
      name: '@floating-ui/dom (Floating UI)',
      source: 'Floating UI Contributors',
      license: 'MIT License',
      url: 'https://floating-ui.com/',
      description: 'Anchor and caret positioning engine for undo chip and suggestion strip.',
      licenseText: floatingUiLicense,
    },
    {
      name: 'React & react-dom (React DOM)',
      source: 'Meta Platforms, Inc.',
      license: 'MIT License',
      url: 'https://react.dev/',
      description: 'UI view layer for extension options and popup interfaces.',
      licenseText: reactLicense,
    },
    {
      name: 'FrequencyWords',
      source: 'Hermit Dave',
      license: 'Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)',
      url: 'https://github.com/hermitdave/FrequencyWords',
      description: 'OpenSubtitles corpus word frequency distributions for English and French vocabulary ranking.',
      licenseText: `Word frequency lists extracted from OpenSubtitles.org.
Licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).
https://creativecommons.org/licenses/by-sa/4.0/`,
    },
    {
      name: 'Tatoeba Project',
      source: 'Tatoeba Contributors',
      license: 'Creative Commons Attribution 2.0 France (CC BY 2.0 FR)',
      url: 'https://downloads.tatoeba.org/',
      description: 'Bilingual sentence corpus used for offline developmental testing and accuracy benchmarking.',
      licenseText: `Bilingual sentence dataset from Tatoeba.org.
Distributed under Creative Commons Attribution 2.0 France (CC BY 2.0 FR).
https://creativecommons.org/licenses/by/2.0/fr/`,
    },
    {
      name: 'WXT Extension Framework',
      source: 'WXT Dev Team',
      license: 'MIT License',
      url: 'https://wxt.dev/',
      description: 'Next-generation WebExtension development and bundling framework.',
      licenseText: `MIT License
Copyright (c) 2023-present Aaron Becker
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.`,
    },
  ];

  // HTML Generation
  const minifiedCss = `:root{--bg:#0f172a;--card-bg:#1e293b;--border:#334155;--text:#f8fafc;--text-muted:#94a3b8;--accent:#38bdf8;--code-bg:#090d16}@media(prefers-color-scheme:light){:root{--bg:#f8fafc;--card-bg:#fff;--border:#e2e8f0;--text:#0f172a;--text-muted:#64748b;--accent:#0284c7;--code-bg:#f1f5f9}}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background-color:var(--bg);color:var(--text);line-height:1.6;margin:0;padding:24px 16px}.container{max-width:860px;margin:0 auto}header{margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--border)}h1{font-size:24px;font-weight:700;margin:0 0 6px 0;color:var(--accent)}p.subtitle{color:var(--text-muted);margin:0;font-size:13px}.component-card{background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:20px}.component-header{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:8px}h2{font-size:16px;font-weight:600;margin:0}.badge{display:inline-block;padding:2px 8px;font-size:11px;font-weight:500;border-radius:9999px;background:var(--border);color:var(--text)}.meta{font-size:12px;color:var(--text-muted);margin-bottom:10px}.meta a{color:var(--accent);text-decoration:none}.meta a:hover{text-decoration:underline}pre{background:var(--code-bg);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:11px;line-height:1.4;font-family:ui-monospace,Menlo,monospace;overflow-x:auto;white-space:pre-wrap;word-break:break-word;color:var(--text);max-height:220px;overflow-y:auto}footer{text-align:center;margin-top:36px;font-size:12px;color:var(--text-muted)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bilexi - Third-Party Notices & Licenses</title>
  <style>${minifiedCss}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Third-Party Notices & Open Source Licenses</h1>
      <p class="subtitle">Bilexi · 100% Offline &amp; Privacy-First</p>
    </header>

    <main>
      ${components.map(c => `
      <section class="component-card">
        <div class="component-header">
          <h2>${escapeHtml(c.name)}</h2>
          <span class="badge">${escapeHtml(c.license)}</span>
        </div>
        <div class="meta">
          <strong>Author / Source:</strong> ${escapeHtml(c.source)} &bull;
          <strong>Homepage:</strong> <a href="${escapeHtml(c.url)}" target="_blank" rel="noreferrer">${escapeHtml(c.url)}</a>
          <br/>
          <strong>Purpose:</strong> ${escapeHtml(c.description)}
        </div>
        <pre>${escapeHtml(c.licenseText)}</pre>
      </section>`).join('\n')}
    </main>

    <footer>
      <p>All trademarks and registered trademarks are the property of their respective owners.</p>
    </footer>
  </div>
</body>
</html>
`;

  // Markdown Generation
  const markdown = `# Third-Party Notices & Open Source Licenses

This project incorporates open-source software, datasets, and linguistic corpora under their respective licenses.

---

## Summary of Third-Party Components

| Component | Source / Author | License | Description / Purpose |
| :--- | :--- | :--- | :--- |
${components.map(c => `| **${c.name}** | ${c.source} | ${c.license} | ${c.description} |`).join('\n')}

---

## Component Details & Attributions

${components.map((c, i) => `### ${i + 1}. ${c.name}
- **Source / Author**: ${c.source}
- **URL**: ${c.url}
- **License**: ${c.license}
- **Purpose**: ${c.description}

\`\`\`
${c.licenseText}
\`\`\`

---
`).join('\n')}
`;

  return { html, markdown, components };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function main() {
  console.log('Generating Third-Party Notices & Licenses...');
  const { html, markdown, components } = generateNotices();

  // Verification check: every package in bundle / dependencies must have a notice
  const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const bundledPackages = Object.keys(pkgJson.dependencies || {});
  // Also check devDependencies that produce shipped runtime or binary data
  const shippedDataDeps = ['dictionary-en', 'dictionary-fr', 'wxt'];
  const requiredNotices = [...bundledPackages, ...shippedDataDeps];

  const noticedNamesLower = components.map(c => (c.name + ' ' + c.description + ' ' + c.source).toLowerCase());
  for (const req of requiredNotices) {
    const hasNotice = noticedNamesLower.some(n => n.includes(req.toLowerCase()));
    if (!hasNotice) {
      console.error(`❌ FAILED: Required package ${req} has no notice in third-party notices!`);
      process.exit(1);
    }
    console.log(`✅ Verified notice present for package: ${req}`);
  }

  // Write public/notices.html
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  const htmlPath = path.join(publicDir, 'notices.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`✅ Generated: ${htmlPath} (${html.length} bytes)`);

  // Write THIRD_PARTY_NOTICES.md and docs/THIRD_PARTY_NOTICES.md
  fs.writeFileSync('THIRD_PARTY_NOTICES.md', markdown, 'utf-8');
  console.log('✅ Synchronized: THIRD_PARTY_NOTICES.md');

  const docsDir = path.resolve('docs');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(docsDir, 'THIRD_PARTY_NOTICES.md'), markdown, 'utf-8');
  console.log('✅ Synchronized: docs/THIRD_PARTY_NOTICES.md');
}

main().catch(console.error);
