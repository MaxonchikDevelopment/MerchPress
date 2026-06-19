// Single source of truth for the development-only quick-login.
//
// `import.meta.env.DEV` is statically replaced by Vite at build time: it is
// `true` under `vite dev` and `false` in any production build. Because the
// value is a compile-time constant, every `if (DEV_LOGIN) { … }` branch is
// dead-code-eliminated from the production bundle — the quick-login button and
// its code path cannot exist in production. There is no env var or runtime flag
// that can turn it on: it fails closed by construction.
export const DEV_LOGIN = import.meta.env.DEV;
