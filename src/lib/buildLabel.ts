// Label shown by BuildTag: "v1.9 · be207e4". Only major.minor of the package version is
// shown (patch hidden). A missing or invalid version gives the build id alone. The id is
// always kept: the deploy check greps the production bundle for it.
const VERSION = /^v?(\d+)\.(\d+)(?:\.\d+)?(?:[-+].*)?$/;

export function formatBuildLabel(version: string | undefined | null, id: string | undefined | null): string {
  const m = VERSION.exec((version ?? '').trim());
  const tag = (id ?? '').trim();
  if (!m) return tag;
  const v = `v${Number(m[1])}.${Number(m[2])}`;
  return tag ? `${v} · ${tag}` : v;
}
