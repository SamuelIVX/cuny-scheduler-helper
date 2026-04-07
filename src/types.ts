export interface Review {
  comment: string
  date: string
  class: string
  grade: string
  helpfulRating: number
  clarityRating: number
  difficultyRating: number
}

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

export interface MessageRequest {
  type: 'FETCH_PROFESSOR'
  professorName: string
  schoolName: string
  courseCode: string
}

export interface MessageResponse {
  success: boolean
  data?: ProfessorData
  error?: string
}
