/**
 * `buildHTML` unit tests — rating/grade colors, escaping, optional tint.
 */
import { describe, it, expect } from 'vitest'
import { buildHTML } from './tooltip'
import type { ProfessorData } from '../types'

function makeData(overrides: Partial<ProfessorData> = {}): ProfessorData {
  return {
    name: 'Jane Doe',
    avgRating: 4.2,
    numRatings: 42,
    difficulty: 3.1,
    wouldTakeAgainPercent: 85,
    department: 'Math',
    school: 'Hunter College',
    recentReviews: [],
    ...overrides,
  }
}

describe('buildHTML', () => {
  it('renders professor name and stats', () => {
    const html = buildHTML(makeData())
    expect(html).toContain('Jane Doe')
    expect(html).toContain('Rating')
    expect(html).toContain('4.20')
    expect(html).toContain('Difficulty')
    expect(html).toContain('3.10')
    expect(html).toContain('Take Again')
    expect(html).toContain('85.00%')
    expect(html).toContain('Reviews')
    expect(html).toContain('42')
  })

  it('renders department and school when present', () => {
    const html = buildHTML(makeData())
    expect(html).toContain('Math')
    expect(html).toContain('Hunter College')
  })

  it('omits department when absent', () => {
    const html = buildHTML(makeData({ department: '' }))
    expect(html).not.toContain('department')
  })

  it('shows N/A for null rating, difficulty, and take-again', () => {
    const html = buildHTML(
      makeData({
        avgRating: null,
        difficulty: null,
        wouldTakeAgainPercent: null,
      }),
    )
    expect(html).toContain('N/A')
  })

  it('escapes HTML in the professor name', () => {
    const html = buildHTML(makeData({ name: '<script>alert(1)</script>' }))
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes HTML in review comments and class names', () => {
    const html = buildHTML(
      makeData({
        recentReviews: [
          {
            comment: '<img src=x onerror=alert(1)>',
            date: '',
            class: '<b>MATH 150</b>',
            grade: 'A',
            helpfulRating: 5,
            clarityRating: 5,
            difficultyRating: 2,
          },
        ],
      }),
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
    expect(html).toContain('&lt;b&gt;MATH 150&lt;/b&gt;')
  })

  it('applies grade-specific colors', () => {
    const html = buildHTML(
      makeData({
        recentReviews: [
          {
            comment: 'Great',
            date: '',
            class: '',
            grade: 'A',
            helpfulRating: 5,
            clarityRating: 5,
            difficultyRating: 2,
          },
        ],
      }),
    )
    expect(html).toContain('#a6e3a1')
  })

  it('shows no-comment fallback for reviews without a comment', () => {
    const html = buildHTML(
      makeData({
        recentReviews: [
          {
            comment: '',
            date: '',
            class: '',
            grade: '',
            helpfulRating: 0,
            clarityRating: 0,
            difficultyRating: 0,
          },
        ],
      }),
    )
    expect(html).toContain('No comment left.')
  })

  it('omits the reviews section when there are no reviews', () => {
    const html = buildHTML(makeData())
    expect(html).not.toContain('Recent Reviews')
    expect(html).toContain('Powered by RateMyProfessors')
  })
})
