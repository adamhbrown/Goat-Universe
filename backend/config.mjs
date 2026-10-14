export function configuration(env = process.env) {
  const mode = env.BACKEND_MODE || 'local';
  const appEnv = env.APP_ENV || 'development';
  if (!['local','supabase'].includes(mode) || !['development','staging','production'].includes(appEnv)) throw new Error('invalid_environment');
  if ((appEnv === 'production' || env.NODE_ENV === 'production') && mode === 'local') throw new Error('local_auth_forbidden_in_production');
  const url = env.SUPABASE_URL?.replace(/\/$/, '');
  if (mode === 'supabase') {
    if (!url || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !env.SUPABASE_PUBLISHABLE_KEY) throw new Error('supabase_configuration_required');
    if (env.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_')) throw new Error('privileged_key_forbidden_as_publishable_key');
    if (env.SUPABASE_PUBLISHABLE_KEY.startsWith('eyJ')) {
      let role; try { role=JSON.parse(Buffer.from(env.SUPABASE_PUBLISHABLE_KEY.split('.')[1],'base64url').toString()).role; } catch { throw new Error('invalid_publishable_key'); }
      if (role!=='anon') throw new Error('privileged_key_forbidden_as_publishable_key');
    }
    if (appEnv !== 'production' && url.includes('opvoemihfyxidzbdyory')) throw new Error('production_project_forbidden_in_development');
  }
  const host = env.HOST || '127.0.0.1';
  const port = Number(env.PORT || 8787);
  // Match the URL the local development server actually listens on. Otherwise
  // browser POSTs from http://127.0.0.1:8787 fail the same-origin guard.
  const appOrigin = env.APP_ORIGIN || `http://${host}:${port}`;
  if (appEnv === 'production' && (!appOrigin.startsWith('https://') || env.PRODUCTION_LAUNCH_APPROVED !== 'true')) throw new Error('production_launch_approval_required');
  const authEmailEnabled = env.AUTH_EMAIL_ENABLED === 'true';
  const paymentsEnabled = env.PAYMENTS_ENABLED === 'true';
  const paymentLaunchApproved = env.PAYMENT_LAUNCH_APPROVED === 'true';
  if (paymentsEnabled && (!paymentLaunchApproved || !env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET)) throw new Error('payment_launch_configuration_required');
  if (paymentsEnabled && appEnv !== 'production' && !env.STRIPE_SECRET_KEY.startsWith('sk_test_')) throw new Error('live_payments_forbidden_in_development');
  const tiers = JSON.parse(env.STRIPE_APPROVED_PRICES || '{}');
  return { mode, appEnv, url, appOrigin, authEmailEnabled, publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
    systemKey: env.SUPABASE_BILLING_SECRET_KEY, stripeSecret: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET, tiers, paymentsEnabled, paymentLaunchApproved,
    localPath: env.LOCAL_DATABASE_PATH || '.local/postgres', host, port };
}
