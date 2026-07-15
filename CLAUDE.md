# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Interactive seasonal website prototype for the band **LUCY**. Only the **SUMMER** page is being
built out; Spring/Fall/Winter are locked "Coming Soon" placeholders in the sidebar. Tech stack is
intentionally minimal: a single self-contained `index.html` (inline `<style>`/`<script>`, no
framework, no build step, no package manager) plus one image asset. Open `index.html` directly in
a browser (double-click / `file://`) to view — there is nothing to build, lint, or test.

### SUMMER page spec
- **Landing/cover screen**: full-bleed LUCY wordmark (`assets/lucy-logo.png`) filling the area
  right of the sidebar, with a small SPRING/**SUMMER**/FALL/WINTER caption line. Clicking "여름" in
  the sidebar hides this screen entirely and reveals the SUMMER page.
- **Header**: LUCY logo + inline SVG sea/sky/wave decoration on a bright gradient.
- **Film strip slider** (core interaction): 4 songs — 조깅, 수박깨러가, Straight Line, Flare — each
  a "frame" with album-art placeholder + short blurb. Navigable by drag/swipe, arrow buttons, or by
  clicking a peeking neighbor frame. Sprocket-hole detailing on the strip's top/bottom edge
  reinforces the "watch songs like a film reel" concept.
- **Footer BGM player**: per-song tabs, play/pause, animated waveform, fake progress bar. The film
  strip and footer player share **one** current-song state, so driving either one keeps both in sync.
- Each song has its own color theme (accent, gradient, waveform colors) and waveform motion
  character: 조깅 = calm/even (cool morning sea), 수박깨러가 = bouncy/bright (midday, watermelon
  field), Straight Line = slow/flat/dreamy (pastel), Flare = fast/jagged (storm).
- No real audio/image assets exist beyond the logo — album art is emoji-on-gradient, waveforms are
  procedurally drawn, and `<audio id="bgm-audio">` is present but fully inert (no `src`).

## Architecture (`index.html`)

Everything lives in one file, organized top-to-bottom as: `<style>` → sidebar/cover/header/
filmstrip/footer markup → one `<script>` IIFE. There are no ES modules, no `fetch`/XHR of local
files, and no external `<link>` (fonts, CSS, JS) — this is deliberate so the file keeps working
when opened directly via `file://` (module loading and local-file fetches fail under `file://` CORS).

**State model**: a single `state = { currentSongIndex, isPlaying, isDragging }` plus a `SONGS`
array (id, title, waveform-shape params, per-song `bars` seeded once at load). Every interaction
path — footer tabs, film-strip arrows, drag/swipe release, clicking a peeking frame — funnels
through `setSong(index)` → `render()`. `render()` is the *only* function that touches the DOM based
on state: it toggles `.is-active` on the matching frame/tab, sets `data-theme` on `#summer-page`,
repositions the film strip track, and updates play/pause + progress. Keep this pattern when adding
new interactions — never mutate the DOM for a song change outside of `render()`, or the film strip
and footer player will desync.

**Per-song theming**: `#summer-page[data-theme="..."]` blocks redefine a small set of CSS custom
properties (`--accent`, `--mood-a/b`, `--wave-a/b`, `--frame-art-gradient`, `--tab-active-text`).
JS only ever sets the `data-theme` attribute (in `render()`); CSS cascades all the color changes.
The waveform canvas reads `--wave-a`/`--wave-b` via `getComputedStyle` once per song change, so
adding a new theme is just adding another `[data-theme="..."]` block — no JS changes needed.

**Waveform**: `<canvas>` + `requestAnimationFrame`, no real audio. Each song gets a small
deterministic seeded RNG (seeded from the song id via `mulberry32`) producing stable per-bar base
heights, animated with a `sin()` wobble whose frequency/amplitude/jaggedness (`freq`/`amp`/`jag` on
each `SONGS` entry) express that song's mood. `state.isPlaying` gates whether time advances (paused
= bars freeze) rather than starting/stopping the rAF loop.

**Visibility gotcha**: elements toggled via the `hidden` attribute (`#placeholder-view`,
`#summer-page`) each need an explicit `#id[hidden] { display: none; }` rule. Any unconditional
`display: flex` (etc.) declared on that same ID otherwise beats the browser's default
`[hidden] { display: none }` UA rule (author-origin CSS always wins over user-agent-origin CSS,
regardless of specificity), so the element stays visible even after JS sets `.hidden = true`. If
you add another `hidden`-toggled section, remember this override.

**Assets**: `assets/lucy-logo.png` is the only asset. It's been tightly cropped to the wordmark
itself (no padding) so it stays sharp when scaled — if replacing it, keep it cropped tight rather
than re-adding whitespace margins, since that's what keeps the logo looking crisp at display size.

As real assets (audio files, illustrated album art, other seasons) are added, or if a build step is
ever introduced, update this file with the relevant commands and any new architectural seams.
