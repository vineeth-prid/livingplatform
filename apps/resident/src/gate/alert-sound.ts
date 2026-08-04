/**
 * The gate notification sound and haptic.
 *
 * Synthesised with WebAudio rather than shipping an audio file: it is a few
 * lines, adds nothing to the bundle, works offline, and needs no decoding — a
 * two-note chime is not worth a network asset.
 *
 * Browser autoplay policy means audio only works after the user has interacted
 * with the page at least once. Rather than let the first alert fail silently, we
 * track that interaction and expose `canPlaySound` so the UI can be honest about
 * it (the modal and the vibration still fire regardless).
 */

let context: AudioContext | null = null;
let unlocked = false;

/** Called once from a real user gesture to satisfy the autoplay policy. */
export function unlockAudio(): void {
  if (unlocked) return;
  try {
    context ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    void context.resume();
    unlocked = true;
  } catch {
    // No WebAudio (or blocked) — the popup and vibration carry the alert.
  }
}

export function canPlaySound(): boolean {
  return unlocked && context?.state === 'running';
}

/** Two-note rising chime — attention-getting without being alarming. */
export function playGateChime(): void {
  if (!context || !unlocked) return;
  try {
    const now = context.currentTime;
    // E5 then A5: a clean interval that cuts through room noise.
    for (const [index, frequency] of [659.25, 880].entries()) {
      const start = now + index * 0.18;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      // Quick attack, smooth decay — a raw square edge sounds like an error.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.34);
    }
  } catch {
    // Audio is a nicety; never let it break the alert.
  }
}

/** Short double buzz. No-op on desktop and on iOS, which has no Vibration API. */
export function vibrateGate(): void {
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    // Ignored — some browsers throw when the page is not visible.
  }
}

/** Everything the arrival alert does, in one call. */
export function alertGateArrival(options: { sound: boolean }): void {
  if (options.sound) playGateChime();
  vibrateGate();
}
