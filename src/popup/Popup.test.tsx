/**
 * Popup behavior tests — clear-cache button against a mocked `chrome.storage`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import Popup from './Popup'

const chromeMock = {
  storage: {
    local: {
      clear: vi.fn(),
    },
  },
}

beforeEach(() => {
  vi.stubGlobal('chrome', chromeMock)
  chromeMock.storage.local.clear.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Popup', () => {
  it('renders the title and cache section', () => {
    render(<Popup />)
    expect(screen.getByText('CUNY Scheduler Helper')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear Cache' })).toBeInTheDocument()
  })

  it('clears the chrome storage cache on click', async () => {
    render(<Popup />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear Cache' }))

    expect(chromeMock.storage.local.clear).toHaveBeenCalledTimes(1)
  })

  it('shows the cleared confirmation and returns to idle', async () => {
    vi.useFakeTimers()
    try {
      render(<Popup />)
      fireEvent.click(screen.getByRole('button', { name: 'Clear Cache' }))

      await act(async () => {
        await Promise.resolve()
      })

      expect(screen.getByText('Cleared!')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(screen.getByRole('button', { name: 'Clear Cache' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('disables the button while clearing', async () => {
    let resolveClear: () => void = () => {}
    chromeMock.storage.local.clear.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveClear = resolve
        }),
    )

    render(<Popup />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear Cache' }))

    expect(screen.getByText('Clearing…')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()

    await act(async () => {
      resolveClear()
    })
    expect(screen.getByRole('button')).not.toBeDisabled()
  })
})
