import type { MessageRequest, MessageResponse } from '../types'
import { TooltipManager } from './tooltip-manager'
import { SELECTORS, SKIP_NAMES } from './constants'

const tooltip = new TooltipManager()
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Inject highlight styles when hovering over course rows
const style = document.createElement('style')
style.textContent = `
  .cuny-helper-highlight {
    background-color: rgba(180, 140, 255, 0.08) !important;
    box-shadow: inset 3px 0 0 rgba(180, 140, 255, 0.7) !important;
    transition: background-color 0.15s ease, box-shadow 0.15s ease !important;
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
          console.error('Error sending message to background script:', chrome.runtime.lastError)
          return
        }
        if (response?.success && response.data) {
          tooltip.show(response.data, row)
        }
      })
    } catch (error) {
      console.error('Error sending message to background script:', error)
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
