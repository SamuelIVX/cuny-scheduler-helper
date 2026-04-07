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

async function fetchProfessorFromRMP(
  professorName: string,
  schoolName: string
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

  const json = await response.json()
  const edges: any[] = json?.data?.search?.teachers?.edges ?? []

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
      (r: any): Review => ({
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

async function getProfessor(
  professorName: string,
  schoolName: string,
  courseCode: string
): Promise<ProfessorData | null> {
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
