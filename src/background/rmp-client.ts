/**
 * Testable RateMyProfessors client: GraphQL fetch, response parsing, and
 * chrome.storage.local cache with injected clock + storage abstractions.
 *
 * SECURITY: uses RMP's public GraphQL endpoint with their documented dummy
 * Basic auth (`test:test`); do not treat this as a real credential.
 */
import type { ProfessorData, Review } from '../types'

export interface RmpClientOptions {
  /** Cache TTL in milliseconds. Default: 1 hour. */
  cacheTtlMs?: number
  /** Clock source for cache expiry. Default: `Date.now`. */
  clock?: () => number
  /** Storage backend. Default: `chrome.storage.local`. */
  storage?: ChromeStorageLocal
}

export interface ChromeStorageLocal {
  get<T = unknown>(keys: string | string[] | { [key: string]: unknown }): Promise<{ [key: string]: T }>
  set<T = unknown>(items: { [key: string]: T }): Promise<void>
}

const RMP_GRAPHQL_URL = 'https://www.ratemyprofessors.com/graphql'
const RMP_AUTH = 'Basic dGVzdDp0ZXN0'

const SEARCH_QUERY = `
  query TeacherSearchQuery($query: TeacherSearchQuery!) {
    search: newSearch {
      teachers(query: $query, first: 5) {
        edges {
          node {
            id
            firstName
            lastName
            department
            avgRatingRounded
            numRatings
            wouldTakeAgainPercentRounded
            avgDifficultyRounded
            school {
              name
            }
            ratings(first: 5) {
              edges {
                node {
                  comment
                  date
                  class
                  grade
                  helpfulRating
                  clarityRating
                  difficultyRating
                }
              }
            }
          }
        }
      }
    }
  }
`

type RmpRatingNode = {
  comment?: string | null
  date?: string | null
  class?: string | null
  grade?: string | null
  helpfulRating?: number | null
  clarityRating?: number | null
  difficultyRating?: number | null
}

type RmpTeacherNode = {
  firstName?: string | null
  lastName?: string | null
  department?: string | null
  avgRatingRounded?: number | null
  numRatings?: number | null
  wouldTakeAgainPercentRounded?: number | null
  avgDifficultyRounded?: number | null
  school?: {
    name?: string | null
  } | null
  ratings?: {
    edges?: Array<{ node: RmpRatingNode }>
  } | null
}

type RmpTeacherEdge = {
  node: RmpTeacherNode
}

type RmpSearchResponse = {
  data?: {
    search?: {
      teachers?: {
        edges?: RmpTeacherEdge[]
      }
    }
  }
}

function normalizeRating(value: number | null | undefined): number | null {
  return value ?? null
}

function mapReview(r: { node: RmpRatingNode }): Review {
  const node = r.node
  return {
    comment: node.comment ?? '',
    date: node.date ?? '',
    class: node.class ?? '',
    grade: node.grade ?? '',
    helpfulRating: node.helpfulRating ?? 0,
    clarityRating: node.clarityRating ?? 0,
    difficultyRating: node.difficultyRating ?? 0,
  }
}

/**
 * Queries RMP for a professor and returns the best CUNY/school match.
 * SECURITY: sends instructor names to an unofficial third-party GraphQL API;
 * do not log Authorization headers or raw response bodies in production.
 * @param professorName - Instructor name scraped from Schedule Builder.
 * @param schoolName - Campus/school string used to prefer a matching RMP school.
 * @returns Normalized professor data, or null if no result is found, the fetch
 *   throws, or the HTTP response is not OK. `response.json()` parse failures reject.
 * @example
 * const data = await client.fetchProfessor("Jane Doe", "College of Staten Island");
 * // null when RMP has no usable match
 */
export async function fetchProfessorFromRMP(
  professorName: string,
  schoolName: string,
): Promise<ProfessorData | null> {
  let response: Response

  try {
    response = await fetch(RMP_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: RMP_AUTH,
      },
      body: JSON.stringify({
        query: SEARCH_QUERY,
        variables: { query: { text: professorName } },
      }),
    })
  } catch (err) {
    console.error('[CUNY Helper BG] fetch threw:', err)
    return null
  }

  if (!response.ok) {
    return null
  }

  const json = (await response.json()) as RmpSearchResponse
  const edges = json.data?.search?.teachers?.edges ?? []

  if (edges.length === 0) return null

  const normalizedSchool = schoolName.toLowerCase()
  const match =
    edges.find((e) => {
      const s = (e.node.school?.name ?? '').toLowerCase()
      return s.includes('cuny') || s.includes(normalizedSchool)
    }) ?? edges[0]

  const node = match.node

  return {
    name: `${node.firstName} ${node.lastName}`,
    avgRating: normalizeRating(node.avgRatingRounded),
    numRatings: node.numRatings ?? 0,
    difficulty: normalizeRating(node.avgDifficultyRounded),
    wouldTakeAgainPercent: normalizeRating(node.wouldTakeAgainPercentRounded),
    department: node.department ?? '',
    school: node.school?.name ?? '',
    recentReviews: (node.ratings?.edges ?? []).map(mapReview),
  }
}

/**
 * Cache-aware professor lookup keyed by name + school + course.
 * SECURITY: persists instructor names and RMP payloads in `chrome.storage.local`;
 * do not log cache keys or stored review bodies.
 * @param professorName - Instructor name.
 * @param schoolName - School/campus for matching + cache key.
 * @param courseCode - Course code included in the cache key.
 * @returns Cached or freshly fetched professor data, or null if the lookup
 *   returns no data. `chrome.storage.local` get/set failures and JSON parse
 *   errors from `fetchProfessorFromRMP` reject (caught by the message listener).
 * @example
 * const data = await client.getProfessor("Jane Doe", "CSI", "CSC 211");
 * // hits storage first, then RMP on miss/expiry
 */
export async function getProfessor(
  professorName: string,
  schoolName: string,
  courseCode: string,
  clock = Date.now,
  storage: ChromeStorageLocal = chrome.storage.local,
  cacheTtlMs = 1000 * 60 * 60,
): Promise<ProfessorData | null> {
  const cacheKey = `rmp::${professorName.toLowerCase()}::${schoolName.toLowerCase()}::${courseCode.toLowerCase()}`

  const cached = await storage.get<{ data: ProfessorData; timestamp: number }>(cacheKey)
  if (cached[cacheKey]) {
    if (clock() - cached[cacheKey].timestamp < cacheTtlMs) {
      return cached[cacheKey].data
    }
  }

  const data = await fetchProfessorFromRMP(professorName, schoolName)
  if (data) {
    await storage.set({ [cacheKey]: { data, timestamp: clock() } })
  }
  return data
}
