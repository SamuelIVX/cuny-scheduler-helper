import type { MessageRequest, MessageResponse } from '../types'
import { TooltipManager } from './tooltip-manager'
import { SELECTORS, SKIP_NAMES, HIGHLIGHT_FALLBACK_RGB } from './constants'

const tooltip = new TooltipManager()
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function extractText(el: Element | null): string {
  return el?.textContent?.trim() ?? ''
}

// Returns "r, g, b" from the course header's background, or null if unreadable.
function getCourseRGB(row: Element): string | null {
  const header = row.querySelector(SELECTORS.courseHeader)
  if (!header) return null
  const bg = getComputedStyle(header).backgroundColor
  const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  return match ? `${match[1]}, ${match[2]}, ${match[3]}` : null
}


function applyHighlight(row: Element, rgb: string) {
  const el = row as HTMLElement
  el.style.transition = 'background-color 0.15s ease, box-shadow 0.15s ease'
  el.style.backgroundColor = `rgba(${rgb}, 0.15)`
  el.style.boxShadow = `inset 3px 0 0 rgba(${rgb}, 0.8)`
}

function removeHighlight(row: Element) {
  const el = row as HTMLElement
  el.style.backgroundColor = ''
  el.style.boxShadow = ''
}

function onRowEnter(e: MouseEvent) {
  const row = e.currentTarget as Element
  const rgb = getCourseRGB(row) ?? HIGHLIGHT_FALLBACK_RGB
  applyHighlight(row, rgb)

  const instructorEl = row.querySelector(SELECTORS.instructorCell)
  const professorName = extractText(instructorEl)

  if (SKIP_NAMES.has(professorName.toLowerCase())) {
    return
  }

  const schoolName = extractText(row.querySelector(SELECTORS.schoolCell)) || 'CUNY'
  const courseCode = extractText(row.querySelector(SELECTORS.courseTitle))

  if (debounceTimer) clearTimeout(debounceTimer)

  debounceTimer = setTimeout(() => {
    if (!chrome?.runtime) {
      return
    }

    const request: MessageRequest = { type: 'FETCH_PROFESSOR', professorName, schoolName, courseCode }

    try {
      chrome.runtime.sendMessage(request, (response: MessageResponse) => {
        if (chrome.runtime?.lastError) {
          console.error('Error sending message to background script:', chrome.runtime.lastError)
          return
        }
        if (response?.success && response.data) {
          tooltip.show(response.data, row, rgb)
        }
      })
    } catch (error) {
      console.error('Error sending message to background script:', error)
    }
  }, 400)
}

function onRowLeave(e: MouseEvent) {
  const row = e.currentTarget as Element
  removeHighlight(row)

  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  tooltip.hide()
}

function attachListeners() {
  const rows = document.querySelectorAll<HTMLElement>(SELECTORS.courseRow)
  rows.forEach((row) => {
    if (row.dataset.cunyHelperBound) return
    row.dataset.cunyHelperBound = '1'
    row.addEventListener('mouseenter', onRowEnter)
    row.addEventListener('mouseleave', onRowLeave)
  })
}

// Re-attach whenever CUNY dynamically injects new course rows (AJAX pagination etc.)
const observer = new MutationObserver(attachListeners)
observer.observe(document.body, { childList: true, subtree: true })

attachListeners()
