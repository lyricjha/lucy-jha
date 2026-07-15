# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Interactive seasonal website prototype for the band **LUCY**. Only the **SUMMER** page is being
built out; Spring/Fall/Winter are locked "Coming Soon" placeholders in the sidebar.

**Running it**: this is *not* a plain double-click-to-open `file://` page anymore — `index.html`
loads `player-integration.js` via `<script type="module">`, and ES module scripts are blocked by
CORS when loaded from `file://` in every major browser. Serve the directory over HTTP instead, e.g.
`npx serve .` or `python -m http.server` from the repo root, then open the printed `localhost` URL.
There is no build step, bundler, package manager, linter, or test suite — just a static file server.

## Architecture

Three files split cleanly by responsibility:

- **`index.html`** — all markup + inline `<style>` + one non-module `<script>` IIFE. Owns: the
  sidebar/cover-screen reveal (`showSummerPage()`), the card slider's drag/swipe positioning
  (`positionTrack()`), and the waveform `<canvas>` animation. It has **no audio logic** — no
  `<audio>` element exists in the markup at all.
- **`audioController.js`** (ES module) — all real audio playback, decoupled from the DOM. Exposes
  `createAudioController()` returning `{ play, pause, resume, togglePlay, next, prev, seek,
  onChange, getState, destroy }`. `TRACKS` maps each song id to a real file under `audio/*.mp3`.
- **`player-integration.js`** (ES module, the `<script type="module">` entry point) — wires DOM
  elements (via `[data-role="..."]` / `[data-track-id="..."]` selectors) to the audio controller,
  and owns global keyboard shortcuts.

**Cross-file song-state bridge**: `index.html`'s inline script keeps its own local `state` (for
drag/position math) and exposes `window.syncHTMLSlider(index)` as the *only* way anything external
mutates its DOM (toggles `.is-active` on the matching frame, sets `#summer-page`'s `data-theme`,
repositions the track, updates arrow `disabled` state). `player-integration.js`'s single
`audio.onChange(state => ...)` callback is the other half: it's the one place that syncs play
button/progress bar/waveform classes/tab-and-slide `.is-active`, and also calls
`window.syncHTMLSlider(...)`. Together these two callbacks are the *entire* DOM-mutation surface for
a song change — never update card/tab/theme state from anywhere else, or the module-driven audio
and the inline-script-driven slider will desync.

**Audio crossfade** (`audioController.js`): two alternating `<audio>` "decks" (`deckA`/`deckB`).
`play(trackId)` fades the outgoing deck's volume to 0 (then pauses it) while fading the incoming
deck in, swapping which deck is "active" when done. Fade timers are stored per-deck
(`fadeTimers: Map<deck, intervalId>`), not in one shared variable — a single shared timer would mean
starting the incoming deck's fade-in immediately cancels the outgoing deck's fade-out before it ever
runs a step, leaving the old track playing at full volume under the new one.

**Card slider drag** (`index.html`): dragging computes a *live* candidate index on every
`pointermove` (not just on release) using the distance between adjacent card centers
(`dragStepDistance`) — as soon as the drag crosses roughly the midpoint toward a neighboring card,
it programmatically clicks that card's footer tab (`switchToIndex()`), which routes through
`audioController.play()` and crossfades immediately, mid-drag. `positionTrack()` bails out early
whenever `state.isDragging` is true, since `pointermove` is already driving the track's `transform`
per-pixel and re-positioning here would fight it; `endDrag()` just snaps to the final centered
position once the pointer is released.

**Keyboard shortcuts** (`player-integration.js`): a single global `keydown` listener owns Space
(play/pause) and ArrowLeft/ArrowRight — it calls `preventDefault()` and explicitly triggers the
action itself, rather than letting the browser's native "activate the focused button" behavior fire.
Without this, Space would both toggle play *and* re-trigger whatever arrow/tab button last had
focus, double-firing. ArrowLeft/Right click the physical `.fs-arrow` buttons (rather than calling
`audio.prev()/next()` directly) so the keyboard respects the same first/last-track disabled state as
the on-screen arrows.

**Per-song theming**: `#summer-page[data-theme="..."]` blocks redefine `--accent`, `--mood-a/b`,
`--wave-a/b`, `--frame-art-gradient`, `--tab-active-text`. Both `syncHTMLSlider()` and the audio
`onChange` path only ever set the `data-theme` attribute — CSS cascades all the color changes, and
the waveform canvas reads `--wave-a`/`--wave-b` via `getComputedStyle` once per song change.

**Waveform**: `<canvas>` + `requestAnimationFrame`, purely decorative (not driven by real audio
frequency data). A per-song seeded base-height array is animated with a `sin()` wobble;
`.is-animating`/`.is-transitioning` classes (set from `audioController`'s `isPlaying`/
`isTransitioning`) gate whether time advances.

**Visibility gotcha**: `#placeholder-view`/`#summer-page` are toggled via the `hidden` attribute but
each also has an unconditional `display: flex`/`column` rule for when *not* hidden — author-origin
CSS always beats the browser's default `[hidden] { display: none }` UA rule regardless of
specificity, so each needs its own explicit `#id[hidden] { display: none; }` override. Any new
`hidden`-toggled section needs the same treatment.

**Card art**: `.frame-art` is a shared `aspect-ratio: 16 / 9` box (not a fixed height) for every
song card. Only 조깅/jogging currently has real album art (`assets/panorama-cover.png`, via
`.frame-art-cover` with `object-fit: cover; object-position: 48% 72%`, tuned to keep the runner
figure in frame). The other three songs still render an emoji on `--frame-art-gradient`.
`assets/watermelon-cover.png` and `assets/watermelon-cover.jpg` exist in `assets/` but are not yet
referenced anywhere — not wired up.

## Other files

- `assets/lucy-logo.png` — the LUCY wordmark, tightly cropped with no padding so it stays sharp when
  scaled; keep any replacement cropped the same way.
- `audio/*_short.mp3` — real ~1-minute highlight clips, one per song, matching `TRACKS` in
  `audioController.js`.
