import test from 'node:test';
import assert from 'node:assert/strict';
import {configuration} from '../config.mjs';
import {PROTECTED_PROJECT_REFS} from '../protected-projects.mjs';

const development={BACKEND_MODE:'supabase',SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_FIXTURE'};
const payments={...development,PAYMENTS_ENABLED:'true',PAYMENT_LAUNCH_APPROVED:'true',STRIPE_SECRET_KEY:'sk_test_FIXTURE',STRIPE_WEBHOOK_SECRET:'whsec_FIXTURE'};
const jwt=role=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.FIXTURE';
test('all four preserved projects are forbidden for development and staging adapters',()=>{
 for(const ref of PROTECTED_PROJECT_REFS) for(const APP_ENV of ['development','staging']) assert.throws(()=>configuration({...development,APP_ENV,SUPABASE_URL:`https://${ref}.supabase.co`}),/production_project_forbidden_in_development/);
});
test('Supabase checkout cannot start without a privileged billing credential',()=>{
 for(const key of [undefined,'',' ','sb_publishable_FIXTURE','sb_secret_',jwt('anon'),'eyJmalformed']) assert.throws(()=>configuration({...payments,SUPABASE_BILLING_SECRET_KEY:key}),/payment_billing_system_key_required/);
 for(const key of ['sb_secret_FIXTURE',jwt('service_role')]) assert.equal(configuration({...payments,SUPABASE_BILLING_SECRET_KEY:key}).paymentsEnabled,true);
});
test('payments stay off by default, require explicit approval and cannot use live keys in development',()=>{
 assert.equal(configuration(development).paymentsEnabled,false);
 assert.throws(()=>configuration({...payments,PAYMENT_LAUNCH_APPROVED:'false'}),/payment_launch_configuration_required/);
 assert.throws(()=>configuration({...payments,SUPABASE_BILLING_SECRET_KEY:'sb_secret_FIXTURE',STRIPE_SECRET_KEY:'sk_live_FIXTURE'}),/live_payments_forbidden_in_development/);
 assert.throws(()=>configuration({...development,SUPABASE_PUBLISHABLE_KEY:'sb_secret_FIXTURE'}),/privileged_key_forbidden_as_publishable/);
});
