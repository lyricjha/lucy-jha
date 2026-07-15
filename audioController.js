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
  const fadeTimers = new Map(); // deck -> intervalId, per-deck so one fade never cancels another deck's fade

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

  function clearFadeTimer(deck) {
    const timer = fadeTimers.get(deck);
    if (timer) {
      clearInterval(timer);
      fadeTimers.delete(deck);
    }
  }

  function fade(deck, from, to, durationMs, onDone) {
    const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS));
    let step = 0;
    clearFadeTimer(deck);
    const timer = setInterval(() => {
      step += 1;
      const t = step / steps;
      deck.volume = from + (to - from) * t;
      if (step >= steps) {
        deck.volume = to;
        clearFadeTimer(deck);
        if (onDone) onDone();
      }
    }, FADE_STEP_MS);
    fadeTimers.set(deck, timer);
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
    fadeTimers.forEach((timer) => clearInterval(timer));
    fadeTimers.clear();
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