# Gemini Quick Delete & Next

A userscript that lets you delete the currently selected Gemini chat and automatically jump to the next one — all with a single keyboard shortcut.

## Installation

1. Install a userscript manager, for example [Tampermonkey](https://www.tampermonkey.net/):
   - [Firefox](https://addons.mozilla.org/en/firefox/addon/tampermonkey/)
   - [Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. On **Chrome** and **Edge**, make sure to [enable developer mode](https://www.tampermonkey.net/faq.php#Q209).

3. Install the userscript by clicking **[this link](https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/gemini-delete-chat-keyb-shortcut/gemini-delete-chat-keyb-shortcut.user.js)**.

## Usage

Once installed, open [Gemini](https://gemini.google.com/app) and select a chat in the sidebar.

Press **`Alt + Shift + D`** to:
1. Delete the currently selected chat
2. Confirm the deletion dialog automatically
3. Navigate to the next (or previous) chat in the list

> **Note:** The script targets chats via `data-test-id="conversation"` and handles the Gemini confirmation modal automatically. It works with both English and French interfaces (`delete` / `supprimer`).

## Compatibility

| Browser | Supported |
|---------|-----------|
| Firefox | ✅ |
| Chrome  | ✅ |
| Edge    | ✅ |

Requires [Tampermonkey](https://www.tampermonkey.net/) or a compatible userscript manager (ViolentMonkey, etc.).

## Keyboard Shortcut

| Shortcut | Action |
|----------|--------|
| `Alt + Shift + D` | Delete selected chat & go to next |

## Script Details

| Field | Value |
|-------|-------|
| Version | 1.3 |
| Match | `https://gemini.google.com/app*` |
| Permissions | none |
