/**
 * Shared LIVE-PREVIEW OAuth client (server-only — NEVER import from the client).
 *
 * The sandbox serves each live preview on a dynamic `https://*.grok-sandbox.com`
 * URL, which can't be pre-registered per app. The broker instead exposes ONE
 * shared "preview" client that accepts any
 * `https://*.grok-sandbox.com/api/auth/oauth2/callback/*`
 * (broker: `app-builder-deployer/auth/src/preview-oauth.ts`). These values come
 * from the environment so the app never ships a preview OAuth secret in source.
 */
function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export const PREVIEW_CLIENT_ID = env("GROK_PREVIEW_CLIENT_ID") ?? "grok_preview";
export const PREVIEW_CLIENT_SECRET = env("GROK_PREVIEW_CLIENT_SECRET") ?? "";

/** The shared auth broker issuer (OIDC discovery lives under it). */
export const GROK_ISSUER_DEFAULT = env("GROK_ISSUER_DEFAULT") ?? "https://auth.grok.me";

/**
 * Host patterns whose callbacks the preview client accepts. Better Auth derives
 * the live preview's real origin from the request host and validates it against
 * this list (wildcard-matched), so the OAuth `redirect_uri` becomes the concrete
 * `https://<preview-host>/api/auth/oauth2/callback/...` the broker allows.
 */
export const PREVIEW_ALLOWED_HOSTS = (
  env("GROK_PREVIEW_ALLOWED_HOSTS")
    ? env("GROK_PREVIEW_ALLOWED_HOSTS")!.split(",").map((host) => host.trim()).filter(Boolean)
    : ["*.grok-sandbox.com"]
) as readonly string[];
