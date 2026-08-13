/**
 * TooltipManager unit tests — show/hide, pin-on-drag, and host reuse.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TooltipManager } from './tooltip-manager'
import type { ProfessorData } from '../types'

const data: ProfessorData = {
  name: 'Jane Doe',
  avgRating: 4.2,
  numRatings: 42,
  difficulty: 3.1,
  wouldTakeAgainPercent: 85,
  department: 'Math',
  school: 'Hunter College',
  recentReviews: [],
}

describe('TooltipManager', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('creates a host element with shadow DOM on first show', () => {
    const manager = new TooltipManager()
    const event = new MouseEvent('mouseenter', { clientX: 100, clientY: 100 })

    manager.show(data, event)

    const host = document.getElementById('cuny-helper-tooltip-host')
    expect(host).not.toBeNull()
    expect(host!.shadowRoot).not.toBeNull()
    expect(host!.style.display).toBe('block')
  })

  it('renders the professor card into the shadow root', () => {
    const manager = new TooltipManager()
    manager.show(data, new MouseEvent('mouseenter', { clientX: 100, clientY: 100 }))

    const host = document.getElementById('cuny-helper-tooltip-host')!
    const shadowText = host.shadowRoot!.textContent!
    expect(shadowText).toContain('Jane Doe')
    expect(shadowText).toContain('RateMyProfessors')
  })

  it('hides the host after the configured delay', () => {
    vi.useFakeTimers()
    try {
      const manager = new TooltipManager()
      manager.show(data, new MouseEvent('mouseenter', { clientX: 100, clientY: 100 }))
      const host = document.getElementById('cuny-helper-tooltip-host')!

      manager.hide(150)
      expect(host.style.display).toBe('block')
      vi.advanceTimersByTime(150)
      expect(host.style.display).toBe('none')
    } finally {
      vi.useRealTimers()
    }
  })

  it('reuses the existing host instead of creating a second one', () => {
    const manager = new TooltipManager()
    manager.show(data, new MouseEvent('mouseenter', { clientX: 100, clientY: 100 }))
    manager.show(data, new MouseEvent('mouseenter', { clientX: 200, clientY: 200 }))

    const hosts = document.querySelectorAll('#cuny-helper-tooltip-host')
    expect(hosts).toHaveLength(1)
  })

  it('positions relative to a fallback element center when given an element', () => {
    const manager = new TooltipManager()
    const anchor = document.createElement('div')
    anchor.getBoundingClientRect = () =>
      ({ left: 50, top: 60, width: 100, height: 40 } as DOMRect)
    document.body.appendChild(anchor)

    manager.show(data, anchor)

    const host = document.getElementById('cuny-helper-tooltip-host')!
    expect(host.style.display).toBe('block')
    const left = parseFloat(host.style.left)
    const top = parseFloat(host.style.top)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(top).toBeGreaterThanOrEqual(0)
  })

  it('starts dragging on mousedown in the header and pins position', () => {
    const manager = new TooltipManager()
    manager.show(data, new MouseEvent('mouseenter', { clientX: 100, clientY: 100 }))
    const host = document.getElementById('cuny-helper-tooltip-host')!
    const header = document.createElement('div')
    header.className = 'header'
    host.shadowRoot!.appendChild(header)

    Object.defineProperty(host, 'offsetWidth', { value: 320 })
    Object.defineProperty(host, 'offsetHeight', { value: 250 })
    const before = { left: host.style.left, top: host.style.top }

    const down = new MouseEvent('mousedown', {
      bubbles: true,
      composed: true,
      button: 0,
      clientX: 110,
      clientY: 120,
    })
    header.dispatchEvent(down)
    expect(host.style.cursor).toBe('grabbing')

    const move = new MouseEvent('mousemove', { clientX: 160, clientY: 170 })
    document.dispatchEvent(move)
    expect(host.style.left).not.toBe(before.left)
    expect(host.style.top).not.toBe(before.top)

    const up = new MouseEvent('mouseup')
    document.dispatchEvent(up)
    expect(host.style.cursor).toBe('')

    // A pinned tooltip is not repositioned by a later show
    const pinned = { left: host.style.left, top: host.style.top }
    manager.show(data, new MouseEvent('mouseenter', { clientX: 500, clientY: 500 }))
    expect(host.style.left).toBe(pinned.left)
    expect(host.style.top).toBe(pinned.top)
  })

  it('does not start dragging on non-header mousedown', () => {
    const manager = new TooltipManager()
    manager.show(data, new MouseEvent('mouseenter', { clientX: 100, clientY: 100 }))
    const host = document.getElementById('cuny-helper-tooltip-host')!
    const body = document.createElement('div')
    host.shadowRoot!.appendChild(body)

    const down = new MouseEvent('mousedown', {
      bubbles: true,
      composed: true,
      button: 0,
      clientX: 110,
      clientY: 120,
    })
    body.dispatchEvent(down)

    expect(host.style.cursor).not.toBe('grabbing')
  })
})
