/**
 * Service worker — delegates RMP fetch/cache to `RmpClient` and answers
 * `FETCH_PROFESSOR` messages.
 */
import type { MessageRequest, MessageResponse } from '../types'
import { getProfessor } from './rmp-client'

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
  },
)
