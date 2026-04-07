import type { ProfessorData } from '../types'
import STYLES from './tooltip.css?inline'

const HOST_ID = 'cuny-helper-tooltip-host'

function ratingColor(rating: number | null): string {
  if (rating === null) return '#888'
  if (rating >= 4) return '#a6e3a1'
  if (rating >= 3) return '#f9e2af'
  return '#f38ba8'
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildHTML(data: ProfessorData): string {
  const reviewsHTML = data.recentReviews
    .map((r) => {
      const date = r.date ? new Date(r.date).toLocaleDateString() : ''
      return `
        <div class="review">
          <div class="review-meta">
            ${r.class ? `<span class="review-class">${escapeHTML(r.class)}</span>` : ''}
            ${r.grade ? `<span class="review-grade">Grade: ${escapeHTML(String(r.grade))}</span>` : ''}
            ${date ? `<span class="review-date">${date}</span>` : ''}
          </div>
          <p class="review-comment">${r.comment ? escapeHTML(r.comment) : 'No comment left.'}</p>
        </div>
      `
    })
    .join('')

  const takeAgain =
    data.wouldTakeAgainPercent !== null ? `${data.wouldTakeAgainPercent}%` : 'N/A'

  return `
    <div class="card">
      <div class="header">
        <div class="name">${escapeHTML(data.name)}</div>
        ${data.department ? `<div class="department">${escapeHTML(data.department)}</div>` : ''}
        ${data.school ? `<div class="school">${escapeHTML(data.school)}</div>` : ''}
      </div>
      <div class="stats">
        <div class="stat">
          <div class="stat-value" style="color:${ratingColor(data.avgRating)}">
            ${data.avgRating ?? 'N/A'}
          </div>
          <div class="stat-label">Rating</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.difficulty?.toFixed(2) ?? 'N/A'}</div>
          <div class="stat-label">Difficulty</div>
        </div>
        <div class="stat">
          <div class="stat-value">${takeAgain}</div>
          <div class="stat-label">Take Again</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.numRatings}</div>
          <div class="stat-label">Reviews</div>
        </div>
      </div>
      ${data.recentReviews.length > 0
      ? `<div class="reviews">
               <div class="reviews-label">Recent Reviews</div>
               <div class="reviews-scroll">${reviewsHTML}</div>
             </div>`
      : ''
    }
      <div class="footer">
        <span>Powered by RateMyProfessors</span>
      </div>
    </div>
  `
}


export class TooltipManager {
  private host: HTMLElement | null = null
  private shadow: ShadowRoot | null = null
  private hideTimer: ReturnType<typeof setTimeout> | null = null
  private lastMouseX = 0
  private lastMouseY = 0
  private isDragging = false
  private dragOffsetX = 0
  private dragOffsetY = 0
  private isPinned = false

  private onDragMove = (e: MouseEvent) => {
    if (!this.isDragging || !this.host) return
    const tw = this.host.offsetWidth
    const th = this.host.offsetHeight
    const left = Math.max(0, Math.min(e.clientX - this.dragOffsetX, window.innerWidth - tw))
    const top = Math.max(0, Math.min(e.clientY - this.dragOffsetY, window.innerHeight - th))
    this.host.style.left = `${left}px`
    this.host.style.top = `${top}px`
  }

  private onDragEnd = () => {
    this.isDragging = false
    if (this.host) this.host.style.cursor = ''
    document.removeEventListener('mousemove', this.onDragMove)
    document.removeEventListener('mouseup', this.onDragEnd)
  }

  private init() {
    if (this.host) return
    this.host = document.createElement('div')
    this.host.id = HOST_ID
    Object.assign(this.host.style, {
      position: 'fixed',
      zIndex: '2147483647',
      display: 'none',
      top: '0',
      left: '0',
    })
    // Allow mouse interaction so the user can scroll reviews inside the tooltip
    this.host.addEventListener('mouseenter', () => {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer)
        this.hideTimer = null
      }
    })
    this.host.addEventListener('mouseleave', () => {
      if (!this.isDragging) this.hide()
    })
    // Track mouse position for tooltip positioning
    this.host.addEventListener('mousemove', (e: MouseEvent) => {
      this.lastMouseX = e.clientX
      this.lastMouseY = e.clientY
    })
    this.host.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return
      const inHeader = e.composedPath().some(
        (el) => el instanceof Element && el.classList?.contains('header')
      )
      if (!inHeader) return
      this.isDragging = true
      this.isPinned = true
      const rect = this.host!.getBoundingClientRect()
      this.dragOffsetX = e.clientX - rect.left
      this.dragOffsetY = e.clientY - rect.top
      this.host!.style.cursor = 'grabbing'
      e.preventDefault()
      document.addEventListener('mousemove', this.onDragMove)
      document.addEventListener('mouseup', this.onDragEnd)
    })
    this.shadow = this.host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = STYLES
    this.shadow.appendChild(style)
    document.body.appendChild(this.host)
  }

  show(data: ProfessorData, event: MouseEvent | Element) {
    this.init()
    if (this.hideTimer) {
      clearTimeout(this.hideTimer)
      this.hideTimer = null
    }

    // Only reposition if the tooltip hasn't been pinned by dragging
    if (!this.isPinned) {
      if (event instanceof MouseEvent) {
        this.lastMouseX = event.clientX
        this.lastMouseY = event.clientY
      } else if (event instanceof Element) {
        // Fallback: use element center if not a mouse event
        const rect = event.getBoundingClientRect()
        this.lastMouseX = rect.left + rect.width / 2
        this.lastMouseY = rect.top + rect.height / 2
      }
    }

    let wrapper = this.shadow!.querySelector('div[data-wrapper]')
    if (!wrapper) {
      wrapper = document.createElement('div')
      wrapper.setAttribute('data-wrapper', '1')
      this.shadow!.appendChild(wrapper)
    }
    wrapper.innerHTML = buildHTML(data)

    this.host!.style.display = 'block'
    if (!this.isPinned) this.reposition()
  }

  hide(delayMs = 150) {
    if (this.hideTimer) clearTimeout(this.hideTimer)
    this.hideTimer = setTimeout(() => {
      if (this.host) this.host.style.display = 'none'
    }, delayMs)
  }

  private reposition() {
    // Temporarily show offscreen to measure
    this.host!.style.top = '-9999px'
    this.host!.style.left = '-9999px'

    const tw = this.host!.offsetWidth || 320
    const th = this.host!.offsetHeight || 250

    // Position tooltip to the right and below cursor
    let top = this.lastMouseY + 12
    let left = this.lastMouseX + 12

    // Adjust if tooltip goes off-screen
    if (top + th > window.innerHeight) {
      top = this.lastMouseY - th - 12
    }
    if (left + tw > window.innerWidth) {
      left = this.lastMouseX - tw - 12
    }

    this.host!.style.top = `${top}px`
    this.host!.style.left = `${left}px`
  }
}
