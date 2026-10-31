# Privacy Policy / Politique de Confidentialité

## English

### Single Purpose
Bilexi ("bilexi") has a single purpose: to autocorrect spelling and typography mistakes in English and French as you type, entirely on your device.

### 100% Offline Local Processing & Zero External Transmission
- **Local Text Processing**: All autocorrection logic, dictionaries, and language models execute completely within your browser's local sandbox. Keystrokes, typed text, and input content are processed synchronously in memory and are never intentionally transmitted to developer-operated remote servers or third-party cloud services.
- **Zero External Telemetry (Static Code & Bundle Review)**: Code review of the source and compiled production bundles verifies that the extension initiates no external HTTP/HTTPS network requests to remote servers (no remote API calls, no analytics trackers, no crash reporting beacons, and no telemetry services). Note: this statement reflects static code and bundle review; no dynamic runtime traffic-capture log is included.
- **Internal Package Resource Loading**: Packaged language dictionary files (`dict/*.bin`) are loaded strictly from the extension's local package storage via internal browser extension URLs (`chrome.runtime.getURL`). This local resource streaming operates entirely within the browser process without external HTTP/HTTPS network calls.
- **Webpage Access Scope (`content_scripts.matches`)**: Bilexi declares host match patterns (`http://*/*` and `https://*/*`) in `manifest.json`. This broad webpage execution scope is required for the content script to detect and correct text inside editable webpage elements (inputs, textareas, and contenteditable containers) where the user types. Webpage execution allows in-page DOM text interaction; it does not authorize or perform outbound network communication.
- **Packaged Resource Exposure (`web_accessible_resources`)**: The extension manifest exposes static linguistic dictionary files (`dict/en.bin`, `dict/fr.bin`, `dict/ngram.bin`, `dict/dictionary-manifest.json`) to matching webpages (`http://*/*`, `https://*/*`). This means matching websites can request these specific packaged data files. These files contain only non-user-specific dictionary lookup tables; exposing them does not give websites access to user settings, custom dictionary words, or text processed by the extension, nor is it an outbound transmission to developer servers.
- **Local Storage Sandbox**: The extension utilizes `chrome.storage.local` strictly on your device to remember your preferences (such as enabled language, sensitivity level, keyboard layout, custom allowlist words, and per-site enable/disable settings). This preference data remains on your local machine and is never synced across browsers (`chrome.storage.sync` is prohibited).

### Chrome Web Store & Edge Add-ons Limited Use Statement
Bilexi adheres strictly to the Chrome Web Store and Microsoft Edge Add-ons Developer Program Policies, including the Limited Use requirements.

---

## Français

### Objectif Unique
Bilexi a pour objectif unique de corriger automatiquement les fautes d'orthographe et de typographie en anglais et en français pendant que vous écrivez, exclusivement sur votre appareil.

### Traitement Local 100% Hors-Ligne & Aucune Transmission Externe
- **Traitement Local du Texte** : Tout le moteur de correction, les dictionnaires et les modèles linguistiques fonctionnent intégralement en local dans votre navigateur. Les frappes au clavier, le texte saisi et le contenu des champs sont analysés de manière synchrone en mémoire vive et ne sont jamais transmis intentionnellement à des serveurs distants ou services cloud tiers.
- **Zéro Télémétrie Externe (Audit Statique du Code et des Bundles)** : L'audit du code source et des bundles de production compilés confirme que l'extension n'émet aucune requête réseau HTTP/HTTPS vers des serveurs distants (aucun appel d'API distant, aucun traceur analytique, aucun rapport de plantage distant et aucune télémétrie). Remarque : cette déclaration découle d'un audit statique du code ; aucun journal de capture dynamique de trafic réseau d'exécution n'est joint.
- **Chargement Interne des Ressources** : Le chargement des fichiers dictionnaires (`dict/*.bin`) s'effectue exclusivement depuis l'archive locale de l'extension via les URL internes du navigateur (`chrome.runtime.getURL`). Ce chargement s'exécute intégralement au sein du processus local sans aucune communication HTTP/HTTPS externe.
- **Périmètre d'Accès aux Pages Web (`content_scripts.matches`)** : Bilexi déclare des motifs de correspondance (`http://*/*` et `https://*/*`) dans son fichier `manifest.json`. Ce périmètre d'exécution sur les pages web est indispensable pour permettre au script de contenu d'interagir avec les zones de saisie éditables où vous tapez du texte (champs texte, zones de texte et conteneurs `contenteditable`). Cet accès autorise la manipulation du DOM de la page ; il n'autorise ni n'effectue aucune communication réseau sortante.
- **Exposition des Ressources du Paquet (`web_accessible_resources`)** : Le manifeste de l'extension expose les fichiers dictionnaires linguistiques statiques (`dict/en.bin`, `dict/fr.bin`, `dict/ngram.bin`, `dict/dictionary-manifest.json`) aux pages web correspondantes (`http://*/*`, `https://*/*`). Cela signifie que les sites web correspondants peuvent demander ces fichiers de données spécifiques. Ces fichiers contiennent uniquement des tables de correspondances linguistiques statiques et non personnalisées ; leur exposition ne donne aucunement accès aux paramètres locaux, aux dictionnaires personnels ou au texte traité par l'extension, et ne constitue pas une transmission vers des serveurs développeurs.
- **Stockage Local Uniquement** : L'extension utilise `chrome.storage.local` sur votre machine afin de conserver vos préférences personnelles (langue activée, sensibilité, disposition clavier, mots du dictionnaire personnel et liste des sites désactivés). Ces paramètres restent strictement sur votre appareil et ne sont jamais synchronisés sur le cloud (`chrome.storage.sync` est interdit).

### Déclaration d'Utilisation Limitée
Bilexi respecte rigoureusement les règles des programmes pour les développeurs du Chrome Web Store et de Microsoft Edge Add-ons, y compris les exigences relatives à l'utilisation limitée des données.
