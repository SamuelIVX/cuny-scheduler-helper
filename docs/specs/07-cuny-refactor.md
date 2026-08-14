# cuny-scheduler-helper Refactor Spec

## Current behavior

- `src/background/index.ts` contains all RMP logic inline: GraphQL query string, response types, `fetchProfessorFromRMP()`, `getProfessor()` cache wrapper, and the `chrome.runtime.onMessage` listener.
- `Date.now()` is hardcoded in `getProfessor()` for cache TTL checks.
- DOM selectors are already centralized in `src/content/constants.ts`.
- Background logic is not unit-testable without mocking `chrome.storage` and `fetch` in the same module as the service-worker listener.

## Desired behavior

- Extract testable functions from `src/background/rmp-client.ts`: `fetchProfessorFromRMP()` and `getProfessor()`.
- Inject `clock: () => number` and `storage: ChromeStorageLocal` as parameters with defaults pointing to `Date.now` and `chrome.storage.local`.
- Keep the `chrome.runtime.onMessage` listener in `background/index.ts` but have it delegate to `getProfessor()`.
- Preserve all existing behavior: cache TTL, school-name preference, skip behavior, message contract, and MV3 service-worker semantics (`sendResponse` + `return true`).

## Invariants

- Cache key format `rmp::${name.toLowerCase()}::${school.toLowerCase()}::${course.toLowerCase()}` is preserved.
- Cache TTL remains 1 hour.
- School matching preference (contains "cuny" or given school name, else first edge) is preserved.
- `chrome.runtime.onMessage` listener must still return `true` to keep `sendResponse` alive for async work.
- RMP endpoint/token remain 3rd-party/unofficial; keep them in code with existing SECURITY notes.

## Inputs/Outputs

- Input: `MessageRequest { type: 'FETCH_PROFESSOR', professorName, schoolName, courseCode }`
- Output: `MessageResponse { success: true, data: ProfessorData } | { success: false, error: string }`

## Edge cases

- RMP returns zero edges → `null`
- Network fetch throws → `null` (existing behavior)
- HTTP response not OK → `null`
- `chrome.storage.local.get/set` rejects → caught by message listener and returned as `{ success: false, error }`
- Clock injected as `() => number`; default implementation uses `Date.now()`

## Error behavior

- Network/parse/storage failures propagate as rejected promises to the message listener, which maps them to `{ success: false, error: String(err) }`.

## Acceptance criteria

- [ ] `src/background/rmp-client.ts` exists and exports `fetchProfessorFromRMP()` and `getProfessor()`.
- [ ] `getProfessor()` accepts optional `clock`, `storage`, and `cacheTtlMs` parameters; defaults are `Date.now`, `chrome.storage.local`, and `1 hour`.
- [ ] `fetchProfessorFromRMP(name, school)` returns `Promise<ProfessorData | null>` with the same normalization/school-matching as current code.
- [ ] `getProfessor(name, school, course, clock, storage, cacheTtlMs)` returns `Promise<ProfessorData | null>` with cache TTL checked via injected clock.
- [ ] `src/background/index.ts` delegates `FETCH_PROFESSOR` to `getProfessor()` and preserves `return true` for async `sendResponse`.
- [ ] Unit tests exist for `fetchProfessorFromRMP` and `getProfessor` covering: cache hit, cache miss/expired, network throw, non-OK response, zero edges, school preference, and clock injection.
- [ ] All pre-existing tests pass.
- [ ] `npm run lint`, `npm run build`, and `tsc -b` pass.

## Tests

- New file: `src/background/rmp-client.test.ts`
- Mocks: `chrome.storage.local` via a minimal in-memory fake; `fetch` via `vi.fn()`.
- Clock test: inject a fixed clock, assert cache hit after write and cache miss after advancing clock past TTL.

## Non-goals

- No change to GraphQL query shape or response mapping.
- No change to cache key format or TTL duration.
- No new dependencies.
- No change to content script, tooltip, or popup behavior.
- No change to `src/content/constants.ts` selectors.

## Constraints/Dependencies

- MV3 service worker is non-persistent; `rmp-client.ts` must not rely on module-level mutable state surviving worker termination. Functional design with injected dependencies satisfies this.
- Tests run in jsdom with `globals: true`; keep Vitest APIs (`describe`, `it`, `expect`, `vi`, `beforeEach`) consistent with existing tests.
