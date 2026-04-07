export const SELECTORS = {
  // Each course card in the legend/results panel
  courseRow: '.course_box',

  // The element containing the instructor name (identified by its title attribute)
  instructorCell: 'div[title="Instructor(s)"]',

  // The element containing the college name (used to improve RMP school matching)
  schoolCell: '.campus_block',

  // The h4 that contains the course code (e.g. "CSC 490")
  courseTitle: 'h4.course_title',
}

export const SKIP_NAMES = new Set(['staff', 'tba', 'to be announced', ''])
