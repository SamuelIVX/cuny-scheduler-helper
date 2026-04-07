export const SELECTORS = {
  // Each course card in the legend/results panel
  courseRow: '.course_box',

  // The colored header bar at the top of each course card (carries the bc* class)
  courseHeader: '.course_header',

  // The element containing the instructor name (identified by its title attribute)
  instructorCell: 'div[title="Instructor(s)"]',

  // The element containing the college name (used to improve RMP school matching)
  schoolCell: '.campus_block',

  // The h4 that contains the course code (e.g. "CSC 490")
  courseTitle: 'h4.course_title',
}

export const SKIP_NAMES = new Set(['staff', 'tba', 'to be announced', ''])

export const HIGHLIGHT_FALLBACK_RGB = '147, 153, 178' // neutral grey-blue
