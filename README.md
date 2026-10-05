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

The built game includes the available language packs and is designed to run from a `file://` URL. For an offline check, disconnect the PC from the network before opening it. Select a trial from the game or add `?cr_lang=english&trial=1` to the file URL to open the sample english trial directly.

Desktop Chrome blocks `XMLHttpRequest` to `file://` by default, so trial data will not load unless you start it with local file access enabled (the Android container WebView grants this itself):

```powershell
$url = 'file:///' + ((Resolve-Path .\dist\index.html).Path -replace '\\', '/') + '?cr_lang=english&cr_user_id=devtest'
Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList '--allow-file-access-from-files', "--user-data-dir=$env:TEMP\fm-file-test", $url
```

### Build delivery ZIPs

```powershell
npm run package
```

This builds the app and creates `artifacts/ftm-core.zip` plus one `artifacts/ftm-lang-<code>.zip` per language folder. The packaging script clears and recreates the `artifacts/` directory first, so move or back up anything there that you need to keep. Packaging uses `tar.exe` to write portable ZIP paths.

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
| `npm run package` | Build the engine and one ZIP per language folder |
| `node scripts/validate-packs.mjs` | Check all language packs before packaging |

Before sharing a change, run `npm run typecheck`, `npm test`, and `npm run build`. The automated tests cover focused engine/data and layout checks; use the manual offline and viewport checks in the [test specification](docs/TESTSPEC.md) for release-level verification.

## Where things live

| Path | What it contains |
| --- | --- |
| `src/App.tsx` | Game screens, board interactions, trial selection, and navigation |
| `src/game.ts` | Trial validation, board/layout helpers, progress storage, and audio helpers |
| `src/App.css`, `src/index.css` | Game and global styles |
| `public/lang/<code>/pack.json` | Language identity and offline speech locale only |
| `public/lang/<code>/trials/index.json` | List of trials shipped in each pack |
| `public/lang/english/trials/trial-<n>.json` | Trial boards and matching relationships |
| `public/lang/english/images/`, `public/lang/english/audios/` | Language-pack media referenced by trial data |
| `scripts/test-engine.mjs`, `scripts/test-layout.mjs` | Automated engine/data and layout checks |
| `scripts/package.mjs` | Standalone engine and language ZIP packaging |
| `dist/` | Generated standalone build; recreate with `npm run build` |
| `artifacts/` | Generated packaging output; recreate with `npm run package` |

## Working with trial content

Trial content is JSON, separate from the game code. The English pack currently in `public/lang/english/` — its trials, images, and audio — is placeholder content created for development and testing only. It is not approved learning content and must be replaced before release.

To add a language, copy the folder layout under `public/lang/english/` to
`public/lang/<code>/`, keeping only content appropriate to the new language:

1. Use the exact CMS language code for the folder and for `pack.json`'s `code`.
	Set `speechLocale` to its BCP 47 voice locale (for example `fr-FR`). No
	buttons, labels, or other game text need translating: those are shared by
	the engine in English.
2. Set `trials/index.json` to `{ "trials": [1, 2] }` with the numbers you ship.
	Add one `trials/trial-<n>.json` for each number, with the matching
	`trial_num`. Each object's `target`, `pair_id`, and `[x, y]` position are
	part of the trial data. Reauthor trial words, pairs, and audio for the
	learning language rather than copying the English content unchanged.
3. Put any referenced audio and images in `audios/` and `images/`. In new
	trials use paths such as `audios/a.wav` and `images/a.png`; paths cannot
	point outside the pack or to the internet. Audio is optional, but supplying
	recordings avoids reliance on device-installed speech voices.
4. Run `node scripts/validate-packs.mjs` to find incomplete trial references,
	missing files, and invalid pack metadata. A release operator can run
	`npm run package` to make the ZIP; packaging discovers new folders
	automatically, with no game-code changes. Upload the language ZIP and its
	separate tile icon via the Curious Reader CMS. Ask Curious Learning staff
	to register a new language code before uploading it.

To add a trial to an existing pack:

1. Add `trial-<n>.json` under `public/lang/english/trials/`.
2. Add its number to `public/lang/english/trials/index.json`.
3. Put referenced images and audio under `public/lang/english/images/` or `public/lang/english/audios/` and use paths relative to the language folder in the JSON. Older English trials also use `lang/english/...` paths, which remain supported.
4. Give each object a unique `object_id`; use reciprocal `pair_id` references for matching partners. Positions are `[x, y]` coordinates in the 1120 by 650 design space.
5. Run `npm test` to check the shipped trial data and assets.

The authoritative schema, validation behavior, and media-path rules are in [DEVSPEC.md](docs/DEVSPEC.md), section 2. Keep authored assets local: the shipped game is intended to run offline without network requests.

## Current implementation notes

- The checked-in English trial index lists trials 1 through 13. The content includes letter matching, audio-only objects, and word/image matching.
- `cr_lang` selects the pack. An absent or unsupported code falls back to English; an installed but broken pack shows an error instead of silently showing English content. Only English is checked in; replace its placeholder content with reviewed learning content before publishing.
- `?trial=<number>` opens a trial directly. With no valid trial number, the selector is shown.
- Learner progress is stored in browser `localStorage` on the device running the game.

## Specifications

These documents are the source of truth for scope, runtime behavior, UI requirements, and verification:

- [PRD.md](docs/PRD.md): product goals, scope, and milestones
- [DEVSPEC.md](docs/DEVSPEC.md): data schema, modules, runtime, and packaging behavior
- [UISPEC.md](docs/UISPEC.md): screens, interactions, accessibility, and layout requirements
- [TESTSPEC.md](docs/TESTSPEC.md): automated checks, acceptance cases, and offline release procedure
- [third-party-game-spec.md](docs/third-party-game-spec.md): Curious Reader container contract
