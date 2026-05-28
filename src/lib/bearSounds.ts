/**
 * Tiny synthesized sound effects for the bear mascot.
 * No external assets — uses the Web Audio API.
 * Respects prefers-reduced-motion and a user mute preference.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx = new Ctx();
    return audioCtx;
  } catch {
    return null;
  }
}

function shouldPlay(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }
  if (localStorage.getItem('bearSoundsMuted') === 'true') return false;
  return true;
}

function beep(freq: number, duration: number, volume = 0.05) {
  if (!shouldPlay()) return;
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    ctx.currentTime + duration,
  );

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export const bearSounds = {
  hide: () => beep(220, 0.12),
  peek: () => beep(440, 0.08),
  sad: () => {
    beep(330, 0.1);
    setTimeout(() => beep(220, 0.18), 100);
  },
  happy: () => {
    beep(523, 0.1);
    setTimeout(() => beep(659, 0.1), 90);
    setTimeout(() => beep(784, 0.15), 180);
  },
  toggleMute: () => {
    const muted = localStorage.getItem('bearSoundsMuted') === 'true';
    localStorage.setItem('bearSoundsMuted', muted ? 'false' : 'true');
    return !muted;
  },
  isMuted: () =>
    typeof window !== 'undefined' &&
    localStorage.getItem('bearSoundsMuted') === 'true',
};