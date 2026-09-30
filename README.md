# Find The Two That Match

Find The Two That Match is an offline-first matching game for early readers. Players drag an object from one side of the board onto its matching partner. The project is a React, TypeScript, and Vite app, with game content and media kept in language-pack folders.

This README is the practical starting point for running and continuing development. The approved product and behavior requirements live in the [specifications](#specifications).

## Run on your PC

### Play during development

Install [Node.js](https://nodejs.org/) (Node 20.19+ or 22.12+) and npm. From PowerShell, open the repository folder and run:

```powershell
npm ci
npm run dev
```

Vite prints a local URL, usually `http://localhost:5173/`. Open it in a browser. The trial selector appears by default; to open a specific trial directly, add its number, for example `http://localhost:5173/?trial=2`.

The dev server runs on your PC and does not require internet access after dependencies have been installed. It is for development; use the built output below to check the standalone offline game.

### Run the standalone offline build

Build the app, then open `dist/index.html` in a desktop browser. In PowerShell:

```powershell
npm run build
Start-Process (Resolve-Path .\dist\index.html)
```

The built game includes the English trial data and assets and is designed to run from a `file://` URL. For an offline check, disconnect the PC from the network before opening it. Select a trial from the game or add `?trial=2` to the file URL to open trial 2 directly.

Desktop Chrome blocks `XMLHttpRequest` to `file://` by default, so trial data will not load unless you start it with local file access enabled (the Android container WebView grants this itself):

```powershell
$url = 'file:///' + ((Resolve-Path .\dist\index.html).Path -replace '\\', '/') + '?cr_lang=english&cr_user_id=devtest'
Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList '--allow-file-access-from-files', "--user-data-dir=$env:TEMP\fm-file-test", $url
```

### Build delivery ZIPs

```powershell
npm run package
```

This builds the app and creates `artifacts/ftm-core.zip` and `artifacts/ftm-lang-english.zip`. The packaging script clears and recreates the `artifacts/` directory first, so move or back up anything there that you need to keep. Packaging currently uses Windows PowerShell.

## Developer commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite's development server with hot reload |
| `npm run typecheck` | Run the TypeScript project checks |
| `npm test` | Run the engine/data checks and layout checks |
| `npm run lint` | Run ESLint across the project |
| `npm run build` | Typecheck and build the standalone app into `dist/` |
| `npm run preview` | Serve the built app locally for a browser smoke test |
| `npm run package` | Build and create the engine and English language ZIPs |

Before sharing a change, run `npm run typecheck`, `npm test`, and `npm run build`. The automated tests cover focused engine/data and layout checks; use the manual offline and viewport checks in the [test specification](docs/TESTSPEC.md) for release-level verification.

## Where things live

| Path | What it contains |
| --- | --- |
| `src/App.tsx` | Game screens, board interactions, trial selection, and navigation |
| `src/game.ts` | Trial validation, board/layout helpers, progress storage, and audio helpers |
| `src/App.css`, `src/index.css` | Game and global styles |
| `public/lang/english/trials/index.json` | List of trials shipped in the English pack |
| `public/lang/english/trials/trial-<n>.json` | Trial boards and matching relationships |
| `public/lang/english/images/`, `public/lang/english/audios/` | Language-pack media referenced by trial data |
| `scripts/test-engine.mjs`, `scripts/test-layout.mjs` | Automated engine/data and layout checks |
| `scripts/package.mjs` | Standalone engine and language ZIP packaging |
| `dist/` | Generated standalone build; recreate with `npm run build` |
| `artifacts/` | Generated packaging output; recreate with `npm run package` |

## Working with trial content

Trial content is JSON, separate from the game code. The English pack currently in `public/lang/english/` — its trials, images, and audio — is placeholder content created for development and testing only. It is not approved learning content and must be replaced before release.

To add a trial to the English pack:

1. Add `trial-<n>.json` under `public/lang/english/trials/`.
2. Add its number to `public/lang/english/trials/index.json`.
3. Put referenced images and audio under `public/lang/english/images/` or `public/lang/english/audios/` and use paths relative to the language folder in the JSON.
4. Give each object a unique `object_id`; use reciprocal `pair_id` references for matching partners. Positions are `[x, y]` coordinates in the 1120 by 650 design space.
5. Run `npm test` to check the shipped trial data and assets.

The authoritative schema, validation behavior, and media-path rules are in [DEVSPEC.md](docs/DEVSPEC.md), section 2. Keep authored assets local: the shipped game is intended to run offline without network requests.

## Current implementation notes

- The checked-in English trial index lists trials 1 through 13. The content includes letter matching, audio-only objects, and word/image matching.
- The game currently uses the English pack directly. `cr_lang` language selection is part of the approved target behavior but is not yet wired into the app; do not assume a different language query parameter changes the selected pack.
- `?trial=<number>` opens a trial directly. With no valid trial number, the selector is shown.
- Learner progress is stored in browser `localStorage` on the device running the game.

## Specifications

These documents are the source of truth for scope, runtime behavior, UI requirements, and verification:

- [PRD.md](docs/PRD.md): product goals, scope, and milestones
- [DEVSPEC.md](docs/DEVSPEC.md): data schema, modules, runtime, and packaging behavior
- [UISPEC.md](docs/UISPEC.md): screens, interactions, accessibility, and layout requirements
- [TESTSPEC.md](docs/TESTSPEC.md): automated checks, acceptance cases, and offline release procedure
- [third-party-game-spec.md](docs/third-party-game-spec.md): Curious Reader container contract
