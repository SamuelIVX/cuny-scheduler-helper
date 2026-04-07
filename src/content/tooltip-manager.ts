import type { ProfessorData } from '../types'
import STYLES from './tooltip.css?inline'
import { buildHTML } from './tooltip'

const HOST_ID = 'cuny-helper-tooltip-host'

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
      this.isPinned = false
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

    const maxTop = Math.max(0, window.innerHeight - th)
    const maxLeft = Math.max(0, window.innerWidth - tw)
    this.host!.style.top = `${Math.min(Math.max(top, 0), maxTop)}px`
    this.host!.style.left = `${Math.min(Math.max(left, 0), maxLeft)}px`
  }
}
