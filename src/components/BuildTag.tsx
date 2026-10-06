// Muted build id at the end of a scrolling page, so a phone's version can be read off the screen.
export function BuildTag() {
  return (
    <div className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 'var(--sp-5)' }}>
      build {__BUILD_ID__}
    </div>
  );
}
