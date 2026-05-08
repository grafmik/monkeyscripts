# VSC Controller Persistent Resizer

A userscript that resizes the [Video Speed Controller](https://github.com/igrigorik/videospeed) (VSC) overlay to your preferred size — with Lucide icons, keyboard shortcuts, and persistent memory across sessions.

## Installation

1. Install a userscript manager, for example [Tampermonkey](https://www.tampermonkey.net/):
   - [Firefox](https://addons.mozilla.org/en/firefox/addon/tampermonkey/)
   - [Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. On **Chrome** and **Edge**, make sure to [enable developer mode](https://www.tampermonkey.net/faq.php#Q209).

3. Install the userscript by clicking **[this link](https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/video-speed-controller-bigger-font/video-speed-controller-bigger-font.user.js)**.

> **Prérequis :** Ce script nécessite l'extension [Video Speed Controller](https://github.com/igrigorik/videospeed) installée dans le navigateur.

## Usage

Once installed, the VSC overlay gains two extra buttons (with Lucide icons) to resize it on the fly. Your preferred scale is saved automatically and restored on every page load.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `É` | Increase overlay size |
| `À` | Decrease overlay size |

> These shortcuts are designed for **AZERTY keyboards**. They won't trigger when typing in a text field or editable area.

### Resize Buttons

Two buttons are injected directly into the VSC control bar:

| Button | Action |
|--------|--------|
| ↑ (scale up icon) | Increase overlay size by 0.1 |
| ↓ (scale down icon) | Decrease overlay size by 0.1 (min: 0.5) |

## Compatibility

| Browser | Supported |
|---------|-----------|
| Firefox | ✅ |
| Chrome  | ✅ |
| Edge    | ✅ |

Works on **any website** (`*://*/*`) that uses the VSC extension. Compatible with Trusted Types browser policies.

## Script Details

| Field | Value |
|-------|-------|
| Version | 1.7 |
| Match | `*://*/*` (all sites) |
| Permissions | none |
| Run at | `document-start` |
