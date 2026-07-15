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
- **Card slider** (core interaction): 4 songs — 조깅, 수박깨러가, Straight Line, Flare — each a
  "frame" with album-art placeholder + short blurb. Navigable by drag/swipe, arrow buttons, or by
  clicking a peeking neighbor frame; non-centered cards sit at 75% scale / 50% opacity for a
  layered, receding side-card look. The viewport's top/bottom edges are framed by a two-tone SVG
  wave tile (ocean palette) instead of any film-reel/sprocket-hole motif.
- **Footer BGM player**: per-song tabs, play/pause, animated waveform, fake progress bar. The card
  slider and footer player share **one** current-song state, so driving either one keeps both in sync.
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

## Other files

`music.html` exists in the repo root as a standalone boilerplate HTML file — it is not linked from
`index.html` and has no defined purpose yet. Treat it as scaffolding for future work, not part of
the current SUMMER page architecture described above.
## 7. BGM 재생 기능 구현 (audioController.js)

### 7-1. 설계 개요
- 재생/제어 로직만 전담하는 **독립된 모듈 `audioController.js`**로 분리 (메인 UI 코드와 결합 없음)
- 곡 전환 시 **기존 트랙 fade-out → 정지**, **새 트랙 fade-in → 재생**이 겹쳐 진행되는 **크로스페이드** 방식
- 재생 상태(현재 곡, 재생 여부, 전환 중 여부, 재생 시간, 진행도)는 `onChange(callback)` 구독 방식으로 브로드캐스트되어 메인 UI(파형 애니메이션, 진행 바, 탭/슬라이드 active 표시)와 끊김 없이 동기화됨
- 크로스페이드는 두 개의 `<audio>` 엘리먼트(deckA/deckB)를 번갈아 사용해 구현 → 기존 곡이 서서히 사라지는 동안 새 곡이 겹쳐서 서서히 커지는 자연스러운 전환

### 7-2. 트랙 데이터 매핑
```js
export const TRACKS = [
  { id: "jogging", title: "조깅", src: "audio/jogging_short.mp3" },
  { id: "watermelon", title: "수박깨러가", src: "audio/watermelon_short.mp3" },
  { id: "straightline", title: "Straight Line", src: "audio/straightline_short.mp3" },
  { id: "flare", title: "Flare", src: "audio/flare_short.mp3" },
];
```

### 7-3. 모듈 API (`createAudioController()`이 반환하는 객체)
| 메서드 | 설명 |
|---|---|
| `play(trackId)` | 해당 트랙으로 크로스페이드 전환 (같은 곡 재클릭 시 재생/일시정지 토글) |
| `pause()` / `resume()` | 페이드아웃 정지 / 페이드인 재생 |
| `togglePlay()` | 재생/일시정지 토글 |
| `next()` / `prev()` | 플레이리스트 순서상 다음/이전 곡으로 전환 |
| `seek(time)` | 재생 위치 이동 |
| `onChange(callback)` | 상태 변경 구독, 구독 해제 함수 반환 |
| `getState()` | 현재 상태 스냅샷 반환 |
| `destroy()` | 리소스 정리 |

`PlayerState`: `{ currentTrackId, isPlaying, isTransitioning, currentTime, duration, progress }`

### 7-4. `audioController.js` 전체 코드
```js
export const TRACKS = [
  { id: "jogging", title: "조깅", src: "audio/jogging_short.mp3" },
  { id: "watermelon", title: "수박깨러가", src: "audio/watermelon_short.mp3" },
  { id: "straightline", title: "Straight Line", src: "audio/straightline_short.mp3" },
  { id: "flare", title: "Flare", src: "audio/flare_short.mp3" },
];

const FADE_OUT_MS = 500; // 기존 트랙 페이드아웃 시간
const FADE_IN_MS = 700; // 새 트랙 페이드인 시간
const FADE_STEP_MS = 20; // 페이드 갱신 간격

export function createAudioController(tracks = TRACKS) {
  const trackMap = new Map(tracks.map((t) => [t.id, t]));

  const deckA = new Audio();
  const deckB = new Audio();
  deckA.preload = "auto";
  deckB.preload = "auto";
  deckA.volume = 0;
  deckB.volume = 0;

  let activeDeck = deckA;
  let inactiveDeck = deckB;

  let currentTrackId = null;
  let isPlaying = false;
  let isTransitioning = false;
  let fadeTimer = null;

  const listeners = new Set();

  function getState() {
    const dur = activeDeck.duration || 0;
    const cur = activeDeck.currentTime || 0;
    return {
      currentTrackId,
      isPlaying,
      isTransitioning,
      currentTime: cur,
      duration: dur,
      progress: dur > 0 ? cur / dur : 0,
    };
  }

  function emitChange() {
    const state = getState();
    listeners.forEach((cb) => cb(state));
  }

  function bindTimeUpdates(deck) {
    deck.addEventListener("timeupdate", () => {
      if (deck === activeDeck) emitChange();
    });
    deck.addEventListener("ended", () => {
      if (deck === activeDeck) {
        isPlaying = false;
        emitChange();
      }
    });
  }
  bindTimeUpdates(deckA);
  bindTimeUpdates(deckB);

  function clearFadeTimer() {
    if (fadeTimer) {
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }

  function fade(deck, from, to, durationMs, onDone) {
    const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS));
    let step = 0;
    clearFadeTimer();
    fadeTimer = setInterval(() => {
      step += 1;
      const t = step / steps;
      deck.volume = from + (to - from) * t;
      if (step >= steps) {
        deck.volume = to;
        clearFadeTimer();
        if (onDone) onDone();
      }
    }, FADE_STEP_MS);
  }

  function play(trackId) {
    const track = trackMap.get(trackId);
    if (!track) return;

    if (trackId === currentTrackId) {
      togglePlay();
      return;
    }

    isTransitioning = true;
    emitChange();

    const outgoing = activeDeck;
    const incoming = inactiveDeck;

    incoming.src = track.src;
    incoming.currentTime = 0;
    incoming.volume = 0;

    const startIncoming = () => {
      incoming.play().catch((err) => console.warn("[audioController] play() 실패:", err));
    };

    if (isPlaying && !outgoing.paused) {
      fade(outgoing, outgoing.volume, 0, FADE_OUT_MS, () => {
        outgoing.pause();
      });
    }

    startIncoming();
    fade(incoming, 0, 1, FADE_IN_MS, () => {
      isTransitioning = false;
      emitChange();
    });

    activeDeck = incoming;
    inactiveDeck = outgoing;
    currentTrackId = trackId;
    isPlaying = true;
    emitChange();
  }

  function pause() {
    if (!isPlaying) return;
    fade(activeDeck, activeDeck.volume, 0, FADE_OUT_MS, () => {
      activeDeck.pause();
    });
    isPlaying = false;
    emitChange();
  }

  function resume() {
    if (isPlaying || !currentTrackId) return;
    activeDeck
      .play()
      .then(() => {
        fade(activeDeck, 0, 1, FADE_IN_MS);
        isPlaying = true;
        emitChange();
      })
      .catch((err) => console.warn("[audioController] resume() 실패:", err));
  }

  function togglePlay() {
    if (isPlaying) pause();
    else resume();
  }

  function next() {
    const ids = tracks.map((t) => t.id);
    const idx = ids.indexOf(currentTrackId);
    const nextId = ids[(idx + 1) % ids.length];
    play(nextId);
  }

  function prev() {
    const ids = tracks.map((t) => t.id);
    const idx = ids.indexOf(currentTrackId);
    const prevId = ids[(idx - 1 + ids.length) % ids.length];
    play(prevId);
  }

  function seek(time) {
    if (!activeDeck.duration) return;
    activeDeck.currentTime = Math.min(Math.max(0, time), activeDeck.duration);
    emitChange();
  }

  function onChange(callback) {
    listeners.add(callback);
    callback(getState());
    return () => listeners.delete(callback);
  }

  function destroy() {
    clearFadeTimer();
    listeners.clear();
    deckA.pause();
    deckB.pause();
    deckA.src = "";
    deckB.src = "";
  }

  return {
    tracks,
    play,
    pause,
    resume,
    togglePlay,
    next,
    prev,
    seek,
    onChange,
    getState,
    destroy,
  };
}
```

### 7-5. 메인 플레이어 UI 연결 예시 (`player-integration.js`)
```js
import { createAudioController, TRACKS } from "./audioController.js";

const audio = createAudioController();

const playPauseBtn = document.querySelector("[data-role='play-pause']");
const trackTitleEl = document.querySelector("[data-role='track-title']");
const progressBarEl = document.querySelector("[data-role='progress-bar']");
const waveformEl = document.querySelector("[data-role='waveform']");
const songTabEls = document.querySelectorAll("[data-role='song-tab']");
const filmSlideEls = document.querySelectorAll("[data-role='film-slide']");

// 상태 -> UI 동기화 (단일 지점)
audio.onChange((state) => {
  const track = TRACKS.find((t) => t.id === state.currentTrackId);

  playPauseBtn?.classList.toggle("is-playing", state.isPlaying);
  if (trackTitleEl) trackTitleEl.textContent = track ? track.title : "";
  if (progressBarEl) progressBarEl.style.width = `${state.progress * 100}%`;

  waveformEl?.classList.toggle("is-animating", state.isPlaying && !state.isTransitioning);
  waveformEl?.classList.toggle("is-transitioning", state.isTransitioning);

  songTabEls.forEach((el) => {
    el.classList.toggle("is-active", el.dataset.trackId === state.currentTrackId);
  });
  filmSlideEls.forEach((el) => {
    el.classList.toggle("is-active", el.dataset.trackId === state.currentTrackId);
  });
});

// 이벤트 바인딩
playPauseBtn?.addEventListener("click", () => audio.togglePlay());

songTabEls.forEach((el) => {
  el.addEventListener("click", () => audio.play(el.dataset.trackId));
});

filmSlideEls.forEach((el) => {
  el.addEventListener("click", () => audio.play(el.dataset.trackId));
});

// 자동재생 정책상 첫 곡 재생은 사용자의 첫 클릭 이후에 호출 권장
// audio.play(TRACKS[0].id);
```

### 7-6. 참고
- 각 `[data-role]`, `[data-track-id]` 셀렉터는 실제 마크업 구조에 맞춰 조정
- 오디오 파일은 1분 하이라이트 버전(`*_short.mp3`)을 `audio/` 폴더에 배치
- 자동재생 정책(브라우저 정책상 사용자 상호작용 이전 재생 제한)으로 인해 페이지 최초 진입 시 자동 재생은 권장하지 않음

