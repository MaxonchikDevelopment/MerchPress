// Sound + vibration helpers with dedupe so refresh/reconnect never replays alerts.

const NEW_ORDER_SRC = '/sounds/new-order.wav';
const READY_SRC = '/sounds/ready.wav';

const audioCache = new Map<string, HTMLAudioElement>();

// 'locked' until a play() has resolved from a user gesture; 'pending' while that
// attempt is in flight. Only unlockAudio() (called from taps) moves it.
type AudioState = 'locked' | 'pending' | 'unlocked';
let audioState: AudioState = 'locked';
const listeners = new Set<() => void>();

function setAudioState(next: AudioState) {
  if (audioState === next) return;
  audioState = next;
  listeners.forEach((l) => l());
}

export const getAudioState = (): AudioState => audioState;
export const isAudioUnlocked = (): boolean => audioState === 'unlocked';
export function subscribeAudioState(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getAudio(src: string): HTMLAudioElement {
  let a = audioCache.get(src);
  if (!a) {
    a = new Audio(src);
    a.preload = 'auto';
    audioCache.set(src, a);
  }
  return a;
}

// Browsers block audio until a user gesture. Call this from a tap (role select,
// the "Tap to enable sound" gate) to unlock playback on the tablet. It only
// counts as unlocked once every play() promise resolves; a failure leaves it
// locked so a later tap can retry.
export function unlockAudio(): void {
  if (audioState !== 'locked') return;
  setAudioState('pending');
  const attempts = [NEW_ORDER_SRC, READY_SRC].map((src) => {
    const a = getAudio(src);
    a.muted = true;
    return a
      .play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
      })
      .finally(() => {
        a.muted = false;
      });
  });
  Promise.all(attempts).then(
    () => setAudioState('unlocked'),
    () => setAudioState('locked'),
  );
}

function play(src: string) {
  const a = getAudio(src);
  try {
    a.currentTime = 0;
    a.play().catch(() => {
      /* blocked or interrupted; nothing to do */
    });
  } catch {
    /* ignore */
  }
}

function vibrate(pattern: number[]) {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* iOS Safari ignores this; sound is the primary signal */
    }
  }
}

export function alertNewOrder() {
  play(NEW_ORDER_SRC);
  vibrate([200, 100, 200]);
}

export function alertReady() {
  play(READY_SRC);
  vibrate([300, 150, 300, 150, 300]);
}

// ---------- Dedupe: which order ids already triggered an alert ----------
// Persisted in sessionStorage so a page refresh in the same tab does not
// re-fire alerts for orders that were already on screen.

function loadSeen(key: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSeen(key: string, set: Set<string>) {
  try {
    sessionStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* storage full / disabled — alerts may repeat but app still works */
  }
}

export class SeenSet {
  private set: Set<string>;
  private key: string;
  constructor(key: string) {
    this.key = key;
    this.set = loadSeen(key);
  }
  has(id: string) {
    return this.set.has(id);
  }
  // Returns true if this id is newly seen (i.e. you should alert now).
  markIfNew(id: string): boolean {
    if (this.set.has(id)) return false;
    this.set.add(id);
    saveSeen(this.key, this.set);
    return true;
  }
  // Seed already-known ids without alerting (used on initial query load).
  seed(ids: string[]) {
    let changed = false;
    for (const id of ids) {
      if (!this.set.has(id)) {
        this.set.add(id);
        changed = true;
      }
    }
    if (changed) saveSeen(this.key, this.set);
  }
}
