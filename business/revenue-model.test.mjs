import test from 'node:test';
import assert from 'node:assert/strict';
import { projectAnnualRevenue } from './revenue-model.mjs';

test('empty assumptions are zero rather than invented traction', () => {
  assert.equal(projectAnnualRevenue().grossRevenue, 0);
});
test('annualizes leagues and accounts for all explicit revenue and costs', () => {
  assert.deepEqual(projectAnnualRevenue({
    payingLeagues: 10, monthlyLeagueFee: 50, paidParticipants: 100,
    annualNetParticipantFee: 20, annualContractedSponsorship: 1000,
    annualPremiumRevenue: 500, annualPlatformCosts: 2000,
    annualAcquisitionCosts: 500, annualSupportCosts: 300,
    annualPrizeAndFulfillmentCosts: 200, annualOtherCosts: 100
  }), {
    leagueRevenue: 6000, participantRevenue: 2000, sponsorshipRevenue: 1000,
    premiumRevenue: 500, grossRevenue: 9500, operatingCosts: 3100,
    contributionBeforeTax: 6400
  });
});
test('rejects negative and nonfinite assumptions', () => {
  assert.throws(() => projectAnnualRevenue({ payingLeagues: -1 }), RangeError);
  assert.throws(() => projectAnnualRevenue({ monthlyLeagueFee: Infinity }), RangeError);
});
