# Contributing to CUNY Scheduler Helper

Thanks for your interest in contributing! This is a small Chrome extension built for CUNY students, any improvements that make the registration experience better are welcome.

---

## Getting Started

### Prerequisites
- Node.js 18+
- Google Chrome (or any Chromium-based browser)
- A basic understanding of Chrome Extensions (Manifest V3)

### Local Setup

```bash
git clone https://github.com/SamuelIVX/cuny-scheduler-helper.git
cd cuny-scheduler-helper
npm install
npm run build
```

Then load the extension in Chrome:
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder

After making changes, run `npm run build` again and click the refresh icon on the extension card in `chrome://extensions`.

---

## Project Structure

```bash
src/
  background/
    index.ts          # Service worker — RMP API fetching and caching
  content/
    index.ts          # Content script entry — hover listeners, debounce
    constants.ts      # DOM selectors and skip-name list
    tooltip.ts        # HTML builder for the tooltip card
    tooltip-manager.ts # Tooltip positioning, drag behavior, show/hide
    tooltip.css       # Tooltip styles (Catppuccin Mocha)
  popup/
    Popup.tsx         # Extension popup UI
    popup.css         # Popup styles
  types.ts            # Shared TypeScript interfaces
```

---

## Ways to Contribute

### Bug Reports

Open an issue and include:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser version and OS

### Feature Requests

Open an issue describing the feature and why it would be useful to CUNY students. Keep in mind the extension is scoped to the CUNY Schedule Builder, features should fit that context.

### Code Contributions

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Test manually on `sb.cunyfirst.cuny.edu`
4. Open a pull request with a clear description of what changed and why

---

## Guidelines

**Keep it focused.** This extension does one thing — show professor data on hover. Avoid scope creep.

**Test on the actual site.** The CUNY Schedule Builder is the only target; make sure changes work there before opening a PR.

**Don't break caching.** The 1-hour `chrome.storage.local` cache is intentional to avoid hammering the RMP API. Any changes to fetching logic should preserve or improve this.

**DOM selectors live in `constants.ts`.** If the CUNY site updates its markup and a selector breaks, that's the first place to look and fix.

**Respect the shadow DOM boundary.** Tooltip styles are intentionally isolated via Shadow DOM so they don't conflict with the host page. Keep new styles inside `tooltip.css`.

**No new dependencies without discussion.** The extension is intentionally lightweight. Open an issue first if you think a dependency is warranted.

