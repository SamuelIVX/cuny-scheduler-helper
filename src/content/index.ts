import type { MessageRequest, MessageResponse } from '../types'
import { TooltipManager } from './tooltip'

const SELECTORS = {
  // Each course card in the legend/results panel
  courseRow: '.course_box',

  // The element containing the instructor name (identified by its title attribute)
  instructorCell: 'div[title="Instructor(s)"]',

  // The element containing the college name (used to improve RMP school matching)
  schoolCell: '.campus_block',

  // The h4 that contains the course code (e.g. "CSC 490")
  courseTitle: 'h4.course_title',
}

const SKIP_NAMES = new Set(['staff', 'tba', 'to be announced', ''])

const tooltip = new TooltipManager()
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Inject highlight styles
const style = document.createElement('style')
style.textContent = `
  .cuny-helper-highlight {
    background-color: rgba(168, 85, 247, 0.25) !important;
    border-color: rgba(168, 85, 247, 0.8) !important;
    border-width: 2px !important;
    border-style: solid !important;
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.6) !important;
  }
`
document.head.appendChild(style)

function extractText(el: Element | null): string {
  return el?.textContent?.trim() ?? ''
}

function onRowEnter(e: MouseEvent) {
  const row = e.currentTarget as Element
  row.classList.add('cuny-helper-highlight')

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
          return
        }
        if (response?.success && response.data) {
          tooltip.show(response.data, e)
        }
      })
    } catch (err) {
      // Silently fail
    }
  }, 400)
}

function onRowLeave(e: MouseEvent) {
  const row = e.currentTarget as Element
  row.classList.remove('cuny-helper-highlight')

  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  tooltip.hide()
}

function attachListeners() {
  const rows = document.querySelectorAll<HTMLElement>(SELECTORS.courseRow)
  rows.forEach((row) => {
    // Avoid attaching duplicate listeners
    if (row.dataset.cunyHelperBound) return
    row.dataset.cunyHelperBound = '1'
    row.addEventListener('mouseenter', onRowEnter)
    row.addEventListener('mouseleave', onRowLeave)
  })
}

console.log('[CUNY Helper] content script loaded')

// Re-attach whenever CUNY dynamically injects new course rows (AJAX pagination etc.)
const observer = new MutationObserver(attachListeners)
observer.observe(document.body, { childList: true, subtree: true })

attachListeners()
