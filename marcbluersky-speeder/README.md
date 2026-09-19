# MarcBluerSky Speeder

A userscript for [marcbluersky.com](https://marcbluersky.com/) that lets you control the playback speed of episodes from the keyboard, and download all public episodes in one click with clean, dated file names.

## Installation

1. Install a userscript manager, for example [Tampermonkey](https://www.tampermonkey.net/):
   - [Firefox](https://addons.mozilla.org/en/firefox/addon/tampermonkey/)
   - [Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. On **Chrome** and **Edge**, make sure to [enable developer mode](https://www.tampermonkey.net/faq.php#Q209).

3. Install the userscript by clicking **[this link](https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/marcbluersky-speeder/marcbluersky-speeder.user.js)**.

## Usage

Once installed, open [marcbluersky.com](https://marcbluersky.com/).

### Playback speed

Every audio/video starts at **1.5x**. Use `S` / `D` to adjust the speed by 0.1 steps; a badge in the top-right corner shows the current speed for one second. Shortcuts are ignored while typing in a text field.

### Download public episodes

A **Télécharger Épisodes Publics** button appears in the bottom-right corner. It downloads every episode of the *Épisodes publics* section (the *À la une* section is skipped), one per second, named:

```
YYYYMMDD - Episode title.mp3
```

The date comes from the episode's `<time>` tag, or from relative French labels (`hier`, `il y a 3 jours`, …).

> **Note:** The script runs with `@grant none`, so downloads use a standard `<a download>` link. Your browser may ask for permission to download multiple files.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `S` | Slow down (−0.1x, min 0.1x) |
| `D` | Speed up (+0.1x) |

## Compatibility

| Browser | Supported |
|---------|-----------|
| Firefox | ✅ |
| Chrome  | ✅ |
| Edge    | ✅ |

Requires [Tampermonkey](https://www.tampermonkey.net/) or a compatible userscript manager (ViolentMonkey, etc.).

## Script Details

| Field | Value |
|-------|-------|
| Version | 1.0.0 |
| Match | `https://marcbluersky.com/*` |
| Permissions | none |
