// Plays a short alert chime when a long-running process finishes
// (blueprint generation, a build, etc). The file lives in /public and is
// served from the site root. Playback is best-effort: browsers block audio
// until the user has interacted with the page, so we swallow rejections.

let alertAudio: HTMLAudioElement | null = null;

function getAlertAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!alertAudio) {
    alertAudio = new Audio("/alert_sound.mp3");
    alertAudio.preload = "auto";
    alertAudio.volume = 0.6; // play at 60% of the file's original volume
  }
  return alertAudio;
}

/** Play the completion alert sound. Safe to call from anywhere; never throws. */
export function playAlertSound() {
  const audio = getAlertAudio();
  if (!audio) return;
  try {
    audio.currentTime = 0;
    void audio.play().catch(() => {
      /* autoplay blocked — ignore */
    });
  } catch {
    /* ignore */
  }
}
