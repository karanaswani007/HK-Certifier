export type DefaultAdminConfig = {
  email?: string;
  password?: string;
  name: string;
};

export function readDefaultAdminConfig(
  env: Record<string, string | undefined> = process.env,
): DefaultAdminConfig {
  const email = (env.ADMIN_EMAIL ?? env.VITE_ADMIN_EMAIL ?? "").trim();
  const password = (env.ADMIN_PASSWORD ?? env.ADMIN_PASS ?? "").trim();
  const name = (env.ADMIN_NAME ?? "Platform Admin").trim() || "Platform Admin";

  return {
    email: email || undefined,
    password: password || undefined,
    name,
  };
}

export function hasDefaultAdminConfig(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const config = readDefaultAdminConfig(env);
  return Boolean(config.email && config.password);
}
