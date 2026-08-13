/**
 * Service worker — fetches RateMyProfessors GraphQL data, caches results in
 * `chrome.storage.local` for 1 hour, and answers `FETCH_PROFESSOR` messages.
 * SECURITY: uses RMP's public GraphQL endpoint with their documented dummy
 * Basic auth (`test:test`); do not treat this as a real credential.
 */
import type { MessageRequest, MessageResponse, ProfessorData, Review } from '../types'

const RMP_GRAPHQL_URL = 'https://www.ratemyprofessors.com/graphql'
const RMP_AUTH = 'Basic dGVzdDp0ZXN0'
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour

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

/**
 * Queries RMP for a professor and returns the best CUNY/school match.
 * SECURITY: sends instructor names to an unofficial third-party GraphQL API;
 * do not log Authorization headers or raw response bodies in production.
 * @param professorName - Instructor name scraped from Schedule Builder.
 * @param schoolName - Campus/school string used to prefer a matching RMP school.
 * @returns Normalized professor data, or null if no result is found, the fetch
 *   throws, or the HTTP response is not OK. `response.json()` parse failures reject.
 * @example
 * const data = await fetchProfessorFromRMP("Jane Doe", "College of Staten Island");
 * // null when RMP has no usable match
 */
async function fetchProfessorFromRMP(professorName: string, schoolName: string): Promise<ProfessorData | null> {
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

  // Prefer a result whose school name contains "cuny" or the given school name
  const normalizedSchool = schoolName.toLowerCase()
  const match =
    edges.find((e) => {
      const s = (e.node.school?.name ?? '').toLowerCase()
      return s.includes('cuny') || s.includes(normalizedSchool)
    }) ?? edges[0]

  const node = match.node

  return {
    name: `${node.firstName} ${node.lastName}`,
    avgRating: node.avgRatingRounded ?? null,
    numRatings: node.numRatings ?? 0,
    difficulty: node.avgDifficultyRounded ?? null,
    wouldTakeAgainPercent: node.wouldTakeAgainPercentRounded ?? null,
    department: node.department ?? '',
    school: node.school?.name ?? '',
    recentReviews: (node.ratings?.edges ?? []).map(
      (r): Review => ({
        comment: r.node.comment ?? '',
        date: r.node.date ?? '',
        class: r.node.class ?? '',
        grade: r.node.grade ?? '',
        helpfulRating: r.node.helpfulRating ?? 0,
        clarityRating: r.node.clarityRating ?? 0,
        difficultyRating: r.node.difficultyRating ?? 0,
      })
    ),
  }
}

/**
 * Cache-aware professor lookup keyed by name + school + course.
 * @param professorName - Instructor name.
 * @param schoolName - School/campus for matching + cache key.
 * @param courseCode - Course code included in the cache key.
 * @returns Cached or freshly fetched professor data, or null if the lookup
 *   returns no data. `chrome.storage.local` get/set failures and JSON parse
 *   errors from `fetchProfessorFromRMP` reject (caught by the message listener).
 * @example
 * const data = await getProfessor("Jane Doe", "CSI", "CSC 211");
 * // hits chrome.storage.local first, then RMP on miss/expiry
 */
async function getProfessor(professorName: string, schoolName: string, courseCode: string): Promise<ProfessorData | null> {
  const cacheKey = `rmp::${professorName.toLowerCase()}::${schoolName.toLowerCase()}::${courseCode.toLowerCase()}`

  const cached = await chrome.storage.local.get(cacheKey)
  if (cached[cacheKey]) {
    const { data, timestamp } = cached[cacheKey] as { data: ProfessorData; timestamp: number }
    if (Date.now() - timestamp < CACHE_TTL_MS) return data
  }

  const data = await fetchProfessorFromRMP(professorName, schoolName)
  if (data) {
    await chrome.storage.local.set({ [cacheKey]: { data, timestamp: Date.now() } })
  }
  return data
}

chrome.runtime.onMessage.addListener(
  (request: MessageRequest, _sender, sendResponse) => {
    if (request.type !== 'FETCH_PROFESSOR') return false

    getProfessor(request.professorName, request.schoolName, request.courseCode)
      .then((data): MessageResponse => {
        return data
          ? { success: true, data }
          : { success: false, error: 'Professor not found on RateMyProfessors.' }
      })
      .catch((err): MessageResponse => {
        return { success: false, error: String(err) }
      })
      .then(sendResponse)

    return true
  }
)
