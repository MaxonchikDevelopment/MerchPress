// Short build id shown in the UI: the env value (Vercel commit sha) wins, then the
// local git sha, then "dev". Trimmed and cut to 7 characters.
const clean = (v: string | undefined | null) => (v ?? '').trim();

export function buildId(env: string | undefined | null, gitSha: string | undefined | null): string {
  const id = clean(env) || clean(gitSha);
  return id ? id.slice(0, 7) : 'dev';
}
