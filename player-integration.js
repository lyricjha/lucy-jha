// player-integration.js
import { createAudioController, TRACKS } from "./audioController.js";

const audio = createAudioController();

const playPauseBtn = document.querySelector("[data-role='play-pause']");
const trackTitleEl = document.querySelector("[data-role='track-title']");
const progressBarEl = document.querySelector("[data-role='progress-bar']");
const waveformEl = document.querySelector("[data-role='waveform']");
const songTabEls = document.querySelectorAll("[data-role='song-tab']");
const filmSlideEls = document.querySelectorAll("[data-role='film-slide']");

// 이전/다음 화살표 연동
const prevArrow = document.querySelector(".fs-arrow.prev");
const nextArrow = document.querySelector(".fs-arrow.next");

// 상태 -> UI 동기화 (단일 지점)
audio.onChange((state) => {
  const track = TRACKS.find((t) => t.id === state.currentTrackId);

  // 재생 버튼 모양 동기화 (재생 중일 때는 일시정지 아이콘 ❚❚ 표시)
  if (playPauseBtn) {
    playPauseBtn.textContent = state.isPlaying ? "❚❚" : "▶";
    playPauseBtn.setAttribute("aria-label", state.isPlaying ? "일시정지" : "재생");
  }

  // 실시간 진행도 게이지 조절
  if (progressBarEl) {
    progressBarEl.style.width = `${state.progress * 100}%`;
  }

  // 캔버스 애니메이션용 클래스 추가/제거
  if (waveformEl) {
    waveformEl.classList.toggle("is-animating", state.isPlaying && !state.isTransitioning);
    waveformEl.classList.toggle("is-transitioning", state.isTransitioning);
  }

  // 탭 및 슬라이드 카드 포커스 동기화
  songTabEls.forEach((el) => {
    el.classList.toggle("is-active", el.dataset.trackId === state.currentTrackId);
  });
  filmSlideEls.forEach((el) => {
    el.classList.toggle("is-active", el.dataset.trackId === state.currentTrackId);
  });

  // HTML 내 슬라이더 오프셋과 전역 연동
  if (state.currentTrackId) {
    const trackIdx = TRACKS.findIndex((t) => t.id === state.currentTrackId);
    if (trackIdx !== -1 && typeof window.syncHTMLSlider === "function") {
      window.syncHTMLSlider(trackIdx);
    }
  }
});

// 이벤트 바인딩
function triggerPlayPause() {
  // 재생 곡이 아직 없다면 첫 곡 로드
  if (!audio.getState().currentTrackId) {
    audio.play(TRACKS[0].id);
  } else {
    audio.togglePlay();
  }
}

playPauseBtn?.addEventListener("click", triggerPlayPause);

// 스페이스바는 재생/일시정지 전용 단축키로 전역에서 가로챈다.
// 화살표/탭 버튼 등에 포커스가 남아있는 상태에서 스페이스바를 누르면
// 브라우저가 "포커스된 버튼"을 기본 동작으로 활성화(다음 곡 이동 등)하면서
// 재생/일시정지와 곡 전환이 동시에 발생해 오디오가 겹치는 문제가 있었음.
window.addEventListener("keydown", (e) => {
  if (e.code !== "Space" && e.key !== " ") return;
  var tag = document.activeElement ? document.activeElement.tagName : "";
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  e.preventDefault();
  triggerPlayPause();
});

songTabEls.forEach((el) => {
  el.addEventListener("click", () => audio.play(el.dataset.trackId));
});

filmSlideEls.forEach((el) => {
  el.addEventListener("click", (e) => {
    // 슬라이드 내 텍스트나 카드 자체를 누르면 곡 전환
    audio.play(el.dataset.trackId);
  });
});

// 물리 화살표 클릭 이벤트 바인딩
prevArrow?.addEventListener("click", () => audio.prev());
nextArrow?.addEventListener("click", () => audio.next());