import { useSyncExternalStore } from 'react';
import { getAudioState, getGateDismissed, subscribeAudioState, tapGate, unlockAudio } from '../lib/notify';

// Full-screen gate shown when audio is still locked, e.g. after a reload that
// restored the session without a login tap. Browsers only allow sound after a
// gesture, so the tap unlocks it. Hidden while a login-tap unlock is pending, and
// for good once the gate itself was tapped; after that SoundRetryButton takes over
// so nobody is trapped behind a full-screen overlay.
export function SoundGate() {
  const state = useSyncExternalStore(subscribeAudioState, getAudioState);
  const dismissed = useSyncExternalStore(subscribeAudioState, getGateDismissed);
  if (state !== 'locked' || dismissed) return null;
  return (
    <div
      role="dialog"
      aria-label="Enable sound"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'var(--surface-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <button className="btn btn-lg btn-primary" onClick={tapGate} style={{ minWidth: 280 }}>
        🔔 Tap to enable sound
      </button>
    </div>
  );
}

// Small persistent top-bar button: audio is still locked after the gate was dismissed.
export function SoundRetryButton() {
  const state = useSyncExternalStore(subscribeAudioState, getAudioState);
  const dismissed = useSyncExternalStore(subscribeAudioState, getGateDismissed);
  if (state !== 'locked' || !dismissed) return null;
  return (
    <button className="btn" onClick={unlockAudio}>
      🔕 Sound off · tap to retry
    </button>
  );
}
