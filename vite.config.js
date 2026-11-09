import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  if (env.REQUIRE_SUPABASE === 'true') {
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in GitHub repository Actions variables.');
    }
    if (!env.VITE_SUPABASE_URL.startsWith('https://')) throw new Error('Supabase URL must use HTTPS.');
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!key.startsWith('sb_publishable_')) {
      throw new Error('Use a Supabase publishable key (sb_publishable_), never a secret or service_role key.');
    }
  }
  return { base: './' };
});
