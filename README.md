# CUNY Scheduler Helper

A Chrome extension that surfaces RateMyProfessors data directly inside the CUNY Schedule Builder (no tab-switching required).

---

## The Problem

When registering for classes on the CUNY Schedule Builder, students have no way to evaluate professors without leaving the page. Checking RateMyProfessors for each instructor, especially across multiple sections is tedious and breaks the registration flow.

---

## The Solution

CUNY Scheduler Helper injects a tooltip into the Schedule Builder that appears when you hover over any course row. It instantly shows the professor's rating, difficulty, "would take again" percentage, and recent student reviews which is pulled live from RateMyProfessors and cached locally so repeat lookups are instant.

**Key features:**
- Tooltip appears on hover with rating, difficulty, take-again %, and review count
- Up to 5 recent reviews with class, grade, and comment
- Color-coded ratings (green / yellow / red)
- Draggable tooltip — pin it anywhere on screen and it stays while you browse other courses
- 1-hour local cache to avoid redundant network requests
- Smart school matching that prefers CUNY-affiliated results from RMP
- Skips TBA / Staff rows automatically

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension platform | Chrome Extensions Manifest V3 |
| Build tool | Vite |
| Language | TypeScript |
| Popup UI | React 18 |
| Styling | CSS (Catppuccin Mocha theme) |
| Style isolation | Shadow DOM |
| Data source | RateMyProfessors GraphQL API |
| Caching | `chrome.storage.local` |

---

## Project Structure

```bash
src/
  background/
    index.ts          # Service worker — fetches from RMP API, manages cache
  content/
    index.ts          # Content script — attaches hover listeners to course rows
    constants.ts      # DOM selectors and skip-name list
    tooltip.ts        # Builds the tooltip HTML from professor data
    tooltip-manager.ts # Manages tooltip positioning, drag, and show/hide
    tooltip.css       # Tooltip card styles
  popup/
    Popup.tsx         # Extension popup — shows info and cache clear button
    popup.css         # Popup styles
  types.ts            # Shared TypeScript interfaces
```

---

## How It Works

1. The content script (`src/content/index.ts`) attaches `mouseenter` / `mouseleave` listeners to every `.course_box` element on `sb.cunyfirst.cuny.edu`
2. On hover, it extracts the instructor name, school, and course code from the DOM
3. After a 400ms debounce it sends a `FETCH_PROFESSOR` message to the background service worker
4. The background script checks `chrome.storage.local` for a cached result; on a miss it queries the RateMyProfessors GraphQL API and caches the response for 1 hour
5. The content script receives the professor data and renders it in a Shadow DOM tooltip via `TooltipManager`
6. The tooltip can be dragged by its header and stays pinned at that position while the user browses other courses

---

## Development

```bash
npm install
npm run build      # outputs to dist/
```

Load the `dist/` folder as an unpacked extension in `chrome://extensions`.
