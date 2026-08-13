/**
 * Shared message and RateMyProfessors payload types for content ↔ background IPC.
 */

/** A single recent RMP review shown in the tooltip. */
export interface Review {
  comment: string
  date: string
  class: string
  grade: string
  helpfulRating: number
  clarityRating: number
  difficultyRating: number
}

/** Normalized professor summary returned to the content script. */
export interface ProfessorData {
  name: string
  avgRating: number | null
  numRatings: number
  difficulty: number | null
  wouldTakeAgainPercent: number | null
  department: string
  school: string
  recentReviews: Review[]
}

/** Content → background request to look up a professor. */
export interface MessageRequest {
  type: 'FETCH_PROFESSOR'
  professorName: string
  schoolName: string
  courseCode: string
}

/** Background → content response wrapping `ProfessorData` or an error string. */
export interface MessageResponse {
  success: boolean
  data?: ProfessorData
  error?: string
}
