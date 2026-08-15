# Code Structure Issues & Fix Plan — NFL Manager

A React Native / Expo NFL franchise-management game. The core problem is that the
domain model is a single ~2,300-line "god class" (`LeagueEngine`) with 4 engine mixins
bolted on via `Object.assign`, heavy duplication of constants/helpers across files, and
28 screens that all reach into a single mutable global `league` singleton.

## Identified Issues

### 1. God object — `src/engine/LeagueEngine.js` (2,295 lines)
One class owns scheduling, standings, scoring, stats distribution, playoffs, odds
simulation (5,000-run Monte Carlo), awards, news, practice squad, IR, depth charts,
game plans, coaching, and persistence. It mixes unrelated concerns and is untestable
in isolation. (~57 methods across many domains.)

### 2. Fragile mixin inheritance via `Object.assign(LeagueEngine.prototype, …)`
`ContractEngine`, `DraftEngine`, `FreeAgencyEngine`, `TrainingEngine` are plain object
literals pasted onto the prototype at `LeagueEngine.js:2286`. They silently depend on
`this._random()`, `this.rosters`, `this.addToDepthChart`, etc. on the host instance.
No shared base, no interface, easy to break. Methods are split from their state.

### 3. Duplicated constants & helpers
- Position list `['QB','RB','WR','TE','OL','DL','LB','DB','K','P']` repeated **5 times**
  (LeagueEngine depth charts, practice squad ×2, FreeAgency, Draft).
- `FIRST_NAMES`/`LAST_NAMES` name pools duplicated in LeagueEngine practice-squad code
  and FreeAgencyEngine (different sets, drift risk).
- `blankStats()` shape duplicated in FreeAgencyEngine and inline in LeagueEngine
  (`initializePlayerStats`, `ensurePlayerStats`, `getTeamSeasonStats`).
- `pickFrom`, `clamp`, `shuffle` re-implemented per file.
- `TEAMS.find(t => t.id === …)` linear lookups repeated; a `byId` team map is never built.

### 4. Global mutable singleton `league` (`LeagueEngine.js:2294`)
Every screen imports the same live instance. State mutations are implicit and
uncontrolled; navigation re-renders depend on manual refresh. No separation between
"engine state" and "UI state."

### 5. No persistence abstraction / schema drift
`getSaveData`/`loadSaveData` are huge field-by-field copies (`LeagueEngine.js:2144-2231`)
that must be kept in sync manually. They are co-located with the engine, not in
`StorageService`. `schemaVersion` exists but no migration code between versions.

### 6. `App.js` route duplication
`wrappedScreens` map and `fullscreenRoutes` array duplicate the same screen names
(`App.js:40-92`); adding a screen requires editing two lists plus the manual
`Stack.Screen` blocks (Draft/BoxScore/TeamDetail/Season/Match) — easy to fall out of sync.

### 7. Phantom / unused code
- `ContractEngine.SALARY_CAP = 200` vs `calculateSalary` caps at 45 — cap number is
  cosmetic and inconsistent.
- `MatchEngine.js` (1,162 lines) is a sibling engine but never mixed into `LeagueEngine`
  (only `Contract/Draft/FreeAgency/Training` are). Verify whether its logic is
  reachable; if not, it's dead weight or a missing wiring.
- `playerState`/`weeksOut` healing logic overlaps with explicit IR handling.

### 8. Magic numbers scattered
Week indices (3 preseason, 17 regular, `currentWeek-1`, `weeks.length+1`), phase
thresholds, injury chance `0.035`, odds simulation count `5000`, weights — all inline
with no named constants.

### 9. `react/prop-types` off + no type safety
ESLint disables prop-types and there are no TypeScript types; large data shapes
(save payload, team/player objects) are untyped, so refactors are error-prone.

## Recommended Fix Plan (incremental, lowest-risk first)

### Phase A — Extract shared constants/helpers (no behavior change)
1. Create `src/engine/constants.js` with: `POSITIONS`, `DEPTH_POSITIONS`,
   `FIRST_NAMES`/`LAST_NAMES` (single canonical pool), `PRESEASON_WEEKS = 3`,
   `REGULAR_WEEKS = 17`, `SIMULATION_COUNT = 5000`, `SALARY_CAP`.
2. Create `src/engine/util.js` with `shuffle`, `pickFrom`, `clamp`, `blankPlayerStats()`,
   and a memoized `TEAMS_BY_ID` map + `getTeamById(id)`.
3. Replace all duplicated literals/helpers in LeagueEngine, FreeAgencyEngine,
   DraftEngine, TrainingEngine, ContractEngine with imports.
   Validation: `npm run check:syntax` + `npm run lint`.

### Phase B — Separate persistence from engine
4. Move `getSaveData`/`loadSaveData`/`_standingsDirty` reset logic into a small
   `src/engine/serialize.js` (pure functions taking/returning the engine instance), or
   add a `SAVE_FIELDS` constant array so save/load iterate one source of truth.
5. Add `StorageService.migrate(data, fromVersion)` stub driven by `schemaVersion`
   (currently only v2 exists) so future schema changes are explicit.
   Validation: load a v2 save round-trips identically.

### Phase C — De-mixin the engines
6. Convert `ContractEngine`/`DraftEngine`/`FreeAgencyEngine`/`TrainingEngine` from
   `Object.assign` mixins into classes/factories that receive the `LeagueEngine`
   instance (or its slices) explicitly, e.g. `new DraftEngine(league)`. Keep the public
   method names so screens don't change. Remove the `Object.assign` block at line 2286.
   Validation: `npm run lint`; smoke-test draft/free-agency/training flows.

### Phase D — Split the god object (optional, larger)
7. Extract cohesive modules as classes that take `league`:
   `ScheduleService`, `StandingsService`, `ScoringService`, `PlayoffService`,
   `PlayoffOddsService`, `NewsService`, `RosterService` (practice squad/IR/depth).
   Keep `LeagueEngine` as a thin facade delegating to these.

### Phase E — UI wiring
8. Refactor `App.js` to derive `Stack.Screen` entries from a single
   `src/navigation/routes.js` array (name + component + options + fullscreen flag),
   eliminating `wrappedScreens`/`fullscreenRoutes` duplication.
9. Wrap the singleton `league` in a tiny store/context (or keep as-is but expose a
   `subscribe`/event emitter) so screens can re-render on state change instead of
   manual refreshes. (Scope decision — see question below.)

### Phase F — Dead code & consistency
10. Audit `MatchEngine.js`: confirm whether it's wired in. If unused, document or
    integrate; if used, mix it in explicitly and remove duplicate scoring in
    `LeagueEngine.calculateScore`.
11. Reconcile `SALARY_CAP` (200) with actual salary range (1–45); either make cap real
    or rename the constant to reflect intent.

## Decisions (confirmed with user)
- **Scope:** Phases A–C only (shared constants/helpers, persistence extraction,
  de-mixin). The full god-object decomposition (Phase D) is **out of scope**.
- **Singleton:** Wrap `league` in a lightweight observable wrapper (subscribe/emit) so
  screens can re-render on change; keep the singleton instance (no new state library).
- **MatchEngine:** Audit first; integrate its logic or remove it. If scoring there
  duplicates `LeagueEngine.calculateScore`, reconcile to a single source.

## Final Plan (execution order)

### 1. Shared constants & helpers (`src/engine/constants.js`, `src/engine/util.js`)
- `POSITIONS`, `DEPTH_POSITIONS`, `FIRST_NAMES`, `LAST_NAMES` (one canonical pool),
  `PRESEASON_WEEKS = 3`, `REGULAR_WEEKS = 17`, `TOTAL_WEEKS = 20`,
  `SIMULATION_COUNT = 5000`, `SALARY_CAP`, `INJURY_CHANCE`, `TRADE_DEADLINE_WEEK = 8`.
- `shuffle`, `pickFrom`, `clamp`, `blankPlayerStats()`, `TEAMS_BY_ID`, `getTeamById(id)`.
- Replace all duplicated literals/helpers across the 5 engine files. No behavior change.

### 2. Persistence extraction (`src/engine/serialize.js`)
- Introduce a single `SAVE_FIELDS` list; `serializeLeague(league)` and
  `deserializeLeague(league, data)` iterate it (replacing the 30+ line manual copies).
- Keep methods callable as `league.getSaveData()`/`league.loadSaveData()` by delegating
  to the new module, OR move them out entirely. Keep `schemaVersion` + add
  `StorageService.migrate(data, version)` stub for forward-compat.

### 3. De-mixin the engines
- Convert `ContractEngine`/`DraftEngine`/`FreeAgencyEngine`/`TrainingEngine` from
  `Object.assign` mixins into factory functions/classes receiving the `league`
  instance explicitly (e.g. `createDraftEngine(league)`), preserving method names so
  screens are untouched.
- Remove `Object.assign(LeagueEngine.prototype, …)` at `LeagueEngine.js:2286`; wire
  the engine instances in one place (e.g. inside `LeagueEngine` or an `index.js`).
- Verify `this._random()`, `this.rosters`, `this.addToDepthChart`, etc. still resolve
  via the passed instance.

### 4. Observable wrapper (`src/engine/leagueStore.js`)
- Export a `leagueStore` holding the `league` singleton with `subscribe(listener)` /
  `emit()` / `getState()`. Have mutating engine flows call `emit()` (or wrap key
  mutations). Screens subscribe in `useEffect` instead of manual refresh.
- Keep `export const league = …` working so existing imports don't break initially;
  migrate screens to `leagueStore` opportunistically.

### 5. MatchEngine audit & reconcile
- Determine if `MatchEngine` is reachable. If used, mix it in explicitly and remove the
  duplicate scoring in `LeagueEngine.calculateScore` in favor of one source. If not,
  delete it or move any unique logic into the engines.

### 6. App.js routing dedupe (`src/navigation/routes.js`)
- Single `ROUTES` array (name, component, options, fullscreen). `App.js` maps over it;
  delete `wrappedScreens` + `fullscreenRoutes` duplication.

## Validation
- `npm run check:syntax` and `npm run lint` pass.
- Full-season smoke test: new franchise → simulate season → draft/offseason → reload
  save slot; behavior identical before/after.
- Regression check: `serializeLeague(league)` → `deserializeLeague` → `serializeLeague`
  yields deep-equal payloads.
- `npm run check:syntax` passes (no new parse errors).
- `npm run lint` passes.
- Manual: start new franchise, simulate a full season, run draft/offseason, reload a
  save slot — behavior must be identical before/after.
- Add a regression test (optional) that serializes `league`, reloads, and asserts deep
  equality of `getSaveData()`.
