# CLAUDE.md

Guide for AI assistants working on the NFL Manager Simulator codebase.

## Project Overview

NFL Manager Simulator is a mobile game built with **React Native** and **Expo** where users manage an NFL team through seasons of play. The app includes match simulation, drafts, free agency, trades, coaching, salary cap management, and multi-season franchise tracking.

## Tech Stack

- **Runtime:** Node.js / npm
- **Framework:** React Native 0.81 via Expo SDK 54
- **Language:** JavaScript (no TypeScript)
- **Navigation:** React Navigation 7 (native stack)
- **Storage:** AsyncStorage for save/load persistence
- **Platforms:** iOS, Android, Web (via Expo)

## Project Structure

```
nfl-manager-sim/
├── App.js                    # Root component, Stack Navigator with all 19 screens
├── index.js                  # Expo entry point
├── app.json                  # Expo configuration
├── package.json              # Dependencies and scripts (no devDependencies)
├── assets/                   # App icons and splash images
└── src/
    ├── data/
    │   ├── teams.js          # 32 NFL teams with divisions, conferences, colors, ratings
    │   └── rosters.js        # Player rosters (10 players per team), POSITIONS enum
    ├── engine/
    │   ├── LeagueEngine.js   # Core game logic singleton (~1270 lines)
    │   └── MatchEngine.js    # Play-by-play simulation (~840 lines)
    ├── services/
    │   └── StorageService.js # AsyncStorage wrapper (save/load/delete)
    └── screens/              # 19 React Native screen components
        ├── HomeScreen.js     # Team selection, new/continue game
        ├── SeasonScreen.js   # Main hub: standings, week controls, navigation
        ├── MatchScreen.js    # Interactive play-by-play game
        ├── BoxScoreScreen.js # Post-game statistics
        ├── DraftScreen.js    # Offseason draft picks
        ├── SeasonRecapScreen.js
        ├── LeaderboardScreen.js
        ├── AwardsScreen.js
        ├── NewsScreen.js
        ├── RosterScreen.js
        ├── TeamDetailScreen.js
        ├── ScheduleScreen.js
        ├── FreeAgencyScreen.js
        ├── TradeScreen.js
        ├── CoachScreen.js
        ├── FranchiseScreen.js
        ├── SalaryCapScreen.js
        ├── CompareScreen.js
        └── SettingsScreen.js
```

## Commands

```bash
npm start        # Start Expo dev server
npm run ios      # Run on iOS simulator
npm run android  # Run on Android emulator
npm run web      # Run in browser
```

There are no test commands, linting commands, or build scripts configured.

## Architecture

### State Management

The app uses a **singleton** `LeagueEngine` instance exported from `src/engine/LeagueEngine.js:1270`:

```js
export const league = new LeagueEngine();
```

All screens import this shared `league` object. Game state lives in memory during play and is persisted to AsyncStorage via `StorageService` at key events. There is no Redux, Context API, or other state management library.

### Game Engine (LeagueEngine)

`LeagueEngine` manages all game state:
- **Season phases:** `preseason` (3 weeks) → `regular` (17 weeks) → `playoffs` → `offseason`
- **Standings, player stats, injuries, news, rosters, coaches, salaries, free agents**
- **Schedule generation:** division/conference matchups for regular season, seeded brackets for playoffs
- **Draft system:** 60-prospect random draft class, reverse-standings pick order
- **Trade/free agency:** value-based evaluation with AI acceptance logic
- **Franchise history:** cross-season tracking of champions, MVPs, records

### Match Engine (MatchEngine)

`MatchEngine` simulates individual games play-by-play:
- Quarter-by-quarter with 900-second clock per quarter
- Play types: `RUN_INSIDE`, `RUN_OUTSIDE`, `PASS_SHORT`, `PASS_DEEP`, `PASS_SCREEN`, `PASS_PLAY_ACTION`, `RUN_DRAW`, `PUNT`, `FG`
- Defense types: `RUN_DEFENSE`, `PASS_COVERAGE`, `BLITZ`
- Turnovers, injuries (1.5% per play), penalties, audibles as random events
- Overtime rules differ for regular season (ties allowed) vs playoffs (sudden death)

### Navigation Flow

```
HomeScreen → SeasonScreen (main hub)
  ├→ MatchScreen → BoxScoreScreen
  │                → SeasonRecapScreen
  ├→ ScheduleScreen
  ├→ RosterScreen
  ├→ TeamDetailScreen
  ├→ LeaderboardScreen
  ├→ AwardsScreen
  ├→ NewsScreen
  ├→ FreeAgencyScreen
  ├→ TradeScreen
  ├→ DraftScreen
  ├→ CoachScreen
  ├→ FranchiseScreen
  ├→ SalaryCapScreen
  ├→ CompareScreen
  └→ SettingsScreen
```

Screens that block back-navigation (Draft, BoxScore) use `headerLeft: null`.

### Data Model

**Team:** `{ id, city, name, abbreviation, conference, division, colors: { primary, secondary }, ratings: { offense, defense, overall } }`

**Player:** `{ id, name, position, overall, age, stats: {} }`
- Player IDs follow the pattern `teamabbrev_number` (e.g., `kc_1`)
- Positions: `QB`, `RB`, `WR`, `TE`, `OL`, `DL`, `LB`, `DB`, `K`, `P`

**Standings entry:** `{ w, l, pf, pa, matches: [] }`

**Player stats:** `{ passingYards, passingTDs, rushingYards, rushingTDs, receivingYards, receivingTDs, tackles, sacks }`

## Code Conventions

- **Pure JavaScript** — no TypeScript, no type annotations
- **Functional components** with React hooks (`useState`, `useEffect`, `useCallback`)
- **`StyleSheet.create()`** at the bottom of each screen file for styling
- **No external UI library** — uses built-in React Native components (`View`, `Text`, `TouchableOpacity`, `FlatList`, `Modal`, `ScrollView`, `SafeAreaView`)
- **No linter or formatter configured** — follow existing indentation (2-space) and style
- **Commit messages** use conventional format: `feat(scope): description`, `fix(scope): description`
- Screen files export a default function component
- Engine classes are ES6 classes exported as named exports
- Deep cloning via `JSON.parse(JSON.stringify(...))` for mutable copies of data

## Key Patterns to Follow

1. **Import the singleton:** `import { league } from '../engine/LeagueEngine';`
2. **Screen navigation:** `navigation.navigate('ScreenName', { param })` — screen names match the `name` prop in App.js
3. **Refresh on focus:** Use `navigation.addListener('focus', callback)` to re-read league state when a screen comes into view
4. **Persistence:** Call `StorageService.saveGame(league.getSaveData())` after state-changing operations
5. **New screens** must be registered in `App.js` as a `<Stack.Screen>` with appropriate header options
6. **Player creation:** Use the `p(id, name, position, overall, age)` helper from `src/data/rosters.js`
7. **Team ratings** are mutable at runtime (coach bonuses, progression) — original ratings are snapshotted in `_originalTeamRatings`

## Common Pitfalls

- The `league` singleton retains state across navigation. Calling `resetGame()` is required for a true new game.
- `ROSTERS` from `data/rosters.js` is the initial data; `league.rosters` is the mutable runtime copy. Always modify `league.rosters`, never `ROSTERS` directly.
- `MatchEngine` logs debug lines (`[DEBUG]`) in the constructor — these are intentional during development.
- No tests exist. Manual testing via Expo Go or the web target is the only verification method.
- The app has no error boundaries. Unhandled errors in engine code will crash the app.
