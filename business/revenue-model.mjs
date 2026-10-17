// GOAT Universe revenue scenario calculator. Planning only: no payment processing.
// Inputs are explicit assumptions, never actual users or contracted revenue.
export function projectAnnualRevenue({
  payingLeagues = 0, monthlyLeagueFee = 0,
  paidParticipants = 0, annualNetParticipantFee = 0,
  annualContractedSponsorship = 0, annualPremiumRevenue = 0,
  annualPlatformCosts = 0, annualAcquisitionCosts = 0,
  annualSupportCosts = 0, annualPrizeAndFulfillmentCosts = 0,
  annualOtherCosts = 0
} = {}) {
  const inputs = { payingLeagues, monthlyLeagueFee, paidParticipants, annualNetParticipantFee, annualContractedSponsorship, annualPremiumRevenue, annualPlatformCosts, annualAcquisitionCosts, annualSupportCosts, annualPrizeAndFulfillmentCosts, annualOtherCosts };
  for (const [name, value] of Object.entries(inputs)) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(name + ' must be a nonnegative finite number');
  }
  const leagueRevenue = payingLeagues * monthlyLeagueFee * 12;
  const participantRevenue = paidParticipants * annualNetParticipantFee;
  const grossRevenue = leagueRevenue + participantRevenue + annualContractedSponsorship + annualPremiumRevenue;
  const operatingCosts = annualPlatformCosts + annualAcquisitionCosts + annualSupportCosts + annualPrizeAndFulfillmentCosts + annualOtherCosts;
  return { leagueRevenue, participantRevenue, sponsorshipRevenue: annualContractedSponsorship, premiumRevenue: annualPremiumRevenue, grossRevenue, operatingCosts, contributionBeforeTax: grossRevenue - operatingCosts };
}
