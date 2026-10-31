import { defineConfig } from 'wxt';
import packageJson from './package.json';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Bilexi',
    description: '100% offline bilingual autocorrect for English and French text fields.',
    version: packageJson.version,
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
    action: {
      default_title: 'Bilexi',
      default_popup: 'popup.html',
      default_icon: {
        '16': 'icons/icon-16.png',
        '32': 'icons/icon-32.png',
      },
    },
    options_ui: {
      open_in_tab: true,
    },
    permissions: ['storage', 'activeTab'],
    web_accessible_resources: [
      {
        resources: ['dict/en.bin', 'dict/fr.bin', 'dict/ngram.bin', 'dict/dictionary-manifest.json'],
        matches: ['http://*/*', 'https://*/*'],
        use_dynamic_url: true,
      },
    ],
  },
});
