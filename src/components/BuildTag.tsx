// Muted build id at the very end of the scrolling page, so a phone's version can be read off the screen.
export function BuildTag() {
  return (
    <div
      className="muted"
      style={{
        fontSize: 12,
        textAlign: 'center',
        marginTop: 'var(--sp-8)',
        paddingBottom: 'var(--sp-2)',
        fontVariantNumeric: 'tabular-nums',
        userSelect: 'text',
      }}
    >
      build {__BUILD_ID__}
    </div>
  );
}
