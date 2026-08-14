/**
 * RmpClient unit tests — cache hit/miss/expiry, network failures, school preference,
 * and clock injection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchProfessorFromRMP, getProfessor, type ChromeStorageLocal } from './rmp-client'
import type { ProfessorData } from '../types'

const FIXED_TIME = 1_000_000_000
const CACHE_TTL_MS = 60_000

function makeStorage(initial: Record<string, unknown> = {}): { storage: ChromeStorageLocal; store: Record<string, unknown> } {
  const store: Record<string, unknown> = { ...initial }
  const storage = {
    get: vi.fn(async (keys: unknown) => {
      if (typeof keys === 'string') {
        return { [keys]: store[keys] }
      }
      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {}
        for (const key of keys) {
          if (key in store) result[key] = store[key]
        }
        return result
      }
      return store
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(store, items)
    }),
  } as ChromeStorageLocal
  return { storage, store }
}

function makeProfessor(overrides: Partial<ProfessorData> = {}): ProfessorData {
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

function rmpEdges(teacher: {
  firstName: string
  lastName: string
  school: { name: string }
  ratings?: { edges: unknown[] }
  avgRatingRounded?: number | null
  numRatings?: number | null
  wouldTakeAgainPercentRounded?: number | null
  avgDifficultyRounded?: number | null
  department?: string | null
}) {
  return {
    data: {
      search: {
        teachers: {
          edges: [
            {
              node: {
                firstName: teacher.firstName,
                lastName: teacher.lastName,
                school: teacher.school,
                ratings: teacher.ratings ?? { edges: [] },
                avgRatingRounded: teacher.avgRatingRounded ?? null,
                numRatings: teacher.numRatings ?? null,
                wouldTakeAgainPercentRounded: teacher.wouldTakeAgainPercentRounded ?? null,
                avgDifficultyRounded: teacher.avgDifficultyRounded ?? null,
                department: teacher.department ?? '',
              },
            },
          ],
        },
      },
    },
  }
}

describe('fetchProfessorFromRMP', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    const result = await fetchProfessorFromRMP('Jane Doe', 'Hunter')
    expect(result).toBeNull()
  })

  it('returns null when response is not OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const result = await fetchProfessorFromRMP('Jane Doe', 'Hunter')
    expect(result).toBeNull()
  })

  it('returns null when no teachers match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { search: { teachers: { edges: [] } } } }),
      }),
    )

    const result = await fetchProfessorFromRMP('Jane Doe', 'Hunter')
    expect(result).toBeNull()
  })

  it('prefers CUNY/school match over first edge', async () => {
    const professor = makeProfessor({ name: 'Jane Doe', school: 'Hunter College' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              search: {
                teachers: {
                  edges: [
                    { node: { firstName: 'Wrong', lastName: 'Person', school: { name: 'Other' }, ratings: { edges: [] }, avgRatingRounded: 1, numRatings: 1, wouldTakeAgainPercentRounded: 10, avgDifficultyRounded: 1, department: '' } },
                    { node: { firstName: 'Jane', lastName: 'Doe', school: { name: 'Hunter College' }, ratings: { edges: [] }, avgRatingRounded: 4.2, numRatings: 42, wouldTakeAgainPercentRounded: 85, avgDifficultyRounded: 3.1, department: 'Math' } },
                  ],
                },
              },
            },
          }),
      }),
    )

    const result = await fetchProfessorFromRMP('Jane Doe', 'Hunter')
    expect(result).toEqual(professor)
  })

  it('falls back to first edge when no school match', async () => {
    const professor = makeProfessor({ name: 'Jane Doe', school: 'Some School' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              search: {
                teachers: {
                  edges: [
                    { node: { firstName: 'Jane', lastName: 'Doe', school: { name: 'Some School' }, ratings: { edges: [] }, avgRatingRounded: 4.2, numRatings: 42, wouldTakeAgainPercentRounded: 85, avgDifficultyRounded: 3.1, department: 'Math' } },
                  ],
                },
              },
            },
          }),
      }),
    )

    const result = await fetchProfessorFromRMP('Jane Doe', 'Some School')
    expect(result).toEqual(professor)
  })
})

describe('getProfessor', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useRealTimers()
  })

  it('returns cached data when fresh', async () => {
    const cached = makeProfessor()
    const cacheKey = 'rmp::jane doe::hunter::csc 211'
    const { storage } = makeStorage({ [cacheKey]: { data: cached, timestamp: FIXED_TIME - 1000 } })
    const clock = vi.fn(() => FIXED_TIME)

    const result = await getProfessor('Jane Doe', 'Hunter', 'CSC 211', clock, storage, CACHE_TTL_MS)
    expect(result).toEqual(cached)
    expect(storage.get).toHaveBeenCalledTimes(1)
    expect(storage.set).not.toHaveBeenCalled()
  })

  it('fetches and caches on miss', async () => {
    const cacheKey = 'rmp::jane doe::hunter::csc 211'
    const { storage, store } = makeStorage({})
    const fresh = makeProfessor({
      avgRating: 3.5,
      numRatings: 10,
      difficulty: 2,
      wouldTakeAgainPercent: 50,
      school: 'Hunter',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve(
            rmpEdges({ firstName: 'Jane', lastName: 'Doe', school: { name: 'Hunter' }, avgRatingRounded: 3.5, numRatings: 10, wouldTakeAgainPercentRounded: 50, avgDifficultyRounded: 2, department: 'Math' }),
          ),
      }),
    )
    const clock = vi.fn(() => FIXED_TIME)

    const result = await getProfessor('Jane Doe', 'Hunter', 'CSC 211', clock, storage, CACHE_TTL_MS)
    expect(result).toEqual(fresh)
    expect(storage.set).toHaveBeenCalledTimes(1)
    expect(store[cacheKey]).toMatchObject({ data: fresh, timestamp: FIXED_TIME })
  })

  it('re-fetches when cache is expired', async () => {
    const cacheKey = 'rmp::jane doe::hunter::csc 211'
    const { storage, store } = makeStorage({ [cacheKey]: { data: makeProfessor(), timestamp: FIXED_TIME - 120_000 } })
    const fresh = makeProfessor({
      avgRating: 3.5,
      numRatings: 10,
      difficulty: 2,
      wouldTakeAgainPercent: 50,
      school: 'Hunter',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve(
            rmpEdges({ firstName: 'Jane', lastName: 'Doe', school: { name: 'Hunter' }, avgRatingRounded: 3.5, numRatings: 10, wouldTakeAgainPercentRounded: 50, avgDifficultyRounded: 2, department: 'Math' }),
          ),
      }),
    )
    const clock = vi.fn(() => FIXED_TIME)

    const result = await getProfessor('Jane Doe', 'Hunter', 'CSC 211', clock, storage, CACHE_TTL_MS)
    expect(result?.avgRating).toBe(3.5)
    expect(store[cacheKey]).toMatchObject({ data: fresh, timestamp: FIXED_TIME })
  })

  it('returns null when fetch throws', async () => {
    const { storage } = makeStorage({})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const clock = vi.fn(() => FIXED_TIME)

    const result = await getProfessor('Jane Doe', 'Hunter', 'CSC 211', clock, storage, CACHE_TTL_MS)
    expect(result).toBeNull()
  })

  it('returns null when response is not OK', async () => {
    const { storage } = makeStorage({})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const clock = vi.fn(() => FIXED_TIME)

    const result = await getProfessor('Jane Doe', 'Hunter', 'CSC 211', clock, storage, CACHE_TTL_MS)
    expect(result).toBeNull()
  })
})
