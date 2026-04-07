import type { ProfessorData } from '../types'

function ratingColor(rating: number | null): string {
  if (rating === null) return '#888'
  if (rating >= 4) return '#a6e3a1'
  if (rating >= 3) return '#f9e2af'
  return '#f38ba8'
}

function gradeColor(grade: string): string {
  const g = grade.trim().toUpperCase()
  if (g.startsWith('A')) return '#a6e3a1' // green
  if (g.startsWith('B')) return '#cfe090' // yellow-green
  if (g.startsWith('C')) return '#f9e2af' // yellow
  if (g.startsWith('D')) return '#fab387' // orange
  if (g === 'F' || g.startsWith('F')) return '#f38ba8' // red
  if (g === 'NOT SURE YET') return '#9399b2' // neutral
  return '#6c7086' // muted for W, INC, etc.
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildHTML(data: ProfessorData): string {
  const reviewsHTML = data.recentReviews
    .map((r) => {
      const date = r.date ? new Date(r.date).toLocaleDateString() : ''
      return `
        <div class="review">
          <div class="review-meta">
            ${r.class ? `<span class="review-class">${escapeHTML(r.class)}</span>` : ''}
            ${r.grade ? `<span class="review-grade" style="color:${gradeColor(r.grade)}">Grade: ${escapeHTML(String(r.grade))}</span>` : ''}
            ${date ? `<span class="review-date">${date}</span>` : ''}
          </div>
          <p class="review-comment">${r.comment ? escapeHTML(r.comment) : 'No comment left.'}</p>
        </div>
      `
    })
    .join('')

  const takeAgain =
    data.wouldTakeAgainPercent !== null ? `${data.wouldTakeAgainPercent}%` : 'N/A'

  return `
    <div class="card">
      <div class="header">
        <div class="name">${escapeHTML(data.name)}</div>
        ${data.department ? `<div class="department">${escapeHTML(data.department)}</div>` : ''}
        ${data.school ? `<div class="school">${escapeHTML(data.school)}</div>` : ''}
      </div>
      <div class="stats">
        <div class="stat">
          <div class="stat-value" style="color:${ratingColor(data.avgRating)}">
            ${data.avgRating ?? 'N/A'}
          </div>
          <div class="stat-label">Rating</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.difficulty?.toFixed(2) ?? 'N/A'}</div>
          <div class="stat-label">Difficulty</div>
        </div>
        <div class="stat">
          <div class="stat-value">${takeAgain}</div>
          <div class="stat-label">Take Again</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.numRatings}</div>
          <div class="stat-label">Reviews</div>
        </div>
      </div>
      ${data.recentReviews.length > 0
      ? `<div class="reviews">
               <div class="reviews-label">Recent Reviews</div>
               <div class="reviews-scroll">${reviewsHTML}</div>
             </div>`
      : ''
    }
      <div class="footer">
        <span>Powered by RateMyProfessors</span>
      </div>
    </div>
  `
}
