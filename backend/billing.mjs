import { createHmac, timingSafeEqual } from 'node:crypto';
export function verifiedStripeEvent(raw, signature, secret, now = Date.now()) {
  if (!secret || typeof signature !== 'string') throw new Error('invalid_webhook_signature');
  const pairs = signature.split(',').map(x => x.split('='));
  const times = pairs.filter(x => x[0] === 't');
  if (times.length !== 1 || !/^\d+$/.test(times[0][1])) throw new Error('invalid_webhook_signature');
  const timestamp = Number(times[0][1]);
  if (Math.abs(now / 1000 - timestamp) > 300) throw new Error('webhook_timestamp_expired');
  const digest = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest();
  const valid = pairs.filter(x => x[0] === 'v1').some(([, value]) => /^[a-f0-9]{64}$/i.test(value) && timingSafeEqual(digest, Buffer.from(value, 'hex')));
  if (!valid) throw new Error('invalid_webhook_signature');
  const event = JSON.parse(raw.toString('utf8'));
  if (typeof event.id !== 'string' || !event.id.startsWith('evt_') || !Number.isSafeInteger(event.created)) throw new Error('invalid_payment_event');
  return event;
}
export function paymentRecord(event, tiers) {
  const record = { event_id: event.id, event_type: event.type };
  if (!['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type)) return record;
  const sub = event.data?.object;
  if (!sub || !/^sub_[a-zA-Z0-9]+$/.test(sub.id) || !/^[0-9a-f-]{36}$/i.test(sub.metadata?.user_id || '')) throw new Error('invalid_subscription');
  const items = sub.items?.data;
  if (!Array.isArray(items) || items.length !== 1) throw new Error('unknown_subscription_price');
  const tier = Object.entries(tiers).find(([, value]) => value === items[0].price?.id)?.[0];
  if (!tier) throw new Error('unknown_subscription_price');
  const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status;
  const expires = items[0].current_period_end || sub.current_period_end;
  if (!Number.isSafeInteger(expires)) throw new Error('subscription_expiry_required');
  return { ...record, user_id: sub.metadata.user_id, tier, status,
    subscription_id: sub.id, event_time: event.created, expires_at: new Date(expires * 1000).toISOString() };
}
export async function checkout(userId, tier, config, fetchImpl = fetch) {
  if (!config.paymentsEnabled || !config.paymentLaunchApproved) throw new Error('payments_not_enabled');
  const price = config.tiers[tier];
  if (!price || !/^price_[A-Za-z0-9]+$/.test(price)) throw new Error('approved_price_required');
  const params = new URLSearchParams({ mode: 'subscription', 'line_items[0][price]': price,
    'line_items[0][quantity]': '1', success_url: `${config.appOrigin}/billing/success`,
    cancel_url: `${config.appOrigin}/billing/cancel`, client_reference_id: userId,
    'subscription_data[metadata][user_id]': userId, 'metadata[user_id]': userId });
  const response = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST', headers: { Authorization: `Bearer ${config.stripeSecret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params, signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || !result.url?.startsWith('https://checkout.stripe.com/')) throw new Error('checkout_unavailable');
  return { url: result.url };
}
