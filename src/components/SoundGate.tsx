import { useSyncExternalStore } from 'react';
import { getAudioState, subscribeAudioState, unlockAudio } from '../lib/notify';

// Full-screen gate shown when audio is still locked, e.g. after a reload that
// restored the session without a login tap. Browsers only allow sound after a
// gesture, so the tap unlocks it. Hidden while a login-tap unlock is pending.
export function SoundGate() {
  const state = useSyncExternalStore(subscribeAudioState, getAudioState);
  if (state !== 'locked') return null;
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
      <button className="btn btn-lg btn-primary" onClick={unlockAudio} style={{ minWidth: 280 }}>
        🔔 Tap to enable sound
      </button>
    </div>
  );
}
