import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import axe from 'axe-core'
import Popup from './Popup'

const chromeMock = {
  storage: {
    local: {
      clear: vi.fn(),
    },
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

async function seriousViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  })
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
}

describe('a11y', () => {
  it('popup has no critical or serious axe violations', async () => {
    vi.stubGlobal('chrome', chromeMock)
    chromeMock.storage.local.clear.mockResolvedValue(undefined)

    const { container } = render(<Popup />)
    expect(await seriousViolations(container)).toEqual([])
  })
})
