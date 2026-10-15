import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequestLimiter} from '../security/request-limiter.mjs';

test('independent POST and credential limits share one bounded socket bucket',()=>{
  let time=0;
  const limiter=createRequestLimiter({now:()=>time,maxClients:2,windowMs:1000,sweepIntervalMs:500,
    postLimit:3,authLimit:1});
  assert.equal(limiter.allow('127.0.0.1','post'),true);
  assert.equal(limiter.allow('127.0.0.1','auth'),true);
  assert.equal(limiter.allow('127.0.0.1','auth'),false);
  assert.equal(limiter.allow('127.0.0.1','post'),true);
  assert.equal(limiter.allow('127.0.0.1','post'),true);
  assert.equal(limiter.allow('127.0.0.1','post'),false);
  assert.equal(limiter.activeClients(),1);
  assert.equal(limiter.allow('::1','post'),true);
  assert.equal(limiter.activeClients(),2);
  assert.equal(limiter.allow('198.51.100.9','post'),false);
  time=501; // bounded sweep does not evict a live bucket early.
  assert.equal(limiter.allow('198.51.100.9','post'),false);
  time=1001;
  assert.equal(limiter.allow('198.51.100.9','post'),true);
  assert.equal(limiter.activeClients(),1);
});

test('unknown peers share one conservative bucket; forwarded identities are not accepted',()=>{
  const limiter=createRequestLimiter({postLimit:2,authLimit:1});
  assert.equal(limiter.allow(null),true);
  assert.equal(limiter.allow('', 'post'),true);
  assert.equal(limiter.allow('unknown-peer','post'),false);
  assert.equal(limiter.activeClients(),1);
  // Auth requests are still separately limited within the same bucket.
  assert.equal(limiter.allow(undefined,'auth'),true);
  assert.equal(limiter.allow(undefined,'auth'),false);
});

test('misconfigured capacity, invalid clocks and unexpected scopes fail closed',()=>{
  for(const config of [
    {postLimit:0},{authLimit:-1},{maxClients:Infinity},{sweepIntervalMs:0},{windowMs:1.5},
    {now:'visitor-controlled'}
  ])assert.throws(()=>createRequestLimiter(config),/invalid_rate_limit_/);
  const bad=createRequestLimiter({now:()=>NaN});
  assert.throws(()=>bad.allow('127.0.0.1'),/invalid_rate_limit_time/);
  assert.throws(()=>createRequestLimiter().allow('127.0.0.1','admin'),/invalid_rate_limit_scope/);
});
