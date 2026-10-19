// Founder-confirmed 1st & BAA playoff league finishing-place BAAS curve.
// This is ONE game-specific awards table, not the five-game annual policy.
// A lookup is not a payment, membership benefit, eligibility decision or
// authorized annual-award transaction. Do not infer unapproved tie handling.
export const FIRST_AND_BAA_BAAS = Object.freeze([
  100,90,80,70,65,60,55,50,45,40,
  35,30,25,20,15,10,5,0,0,0
]);
export const FIRST_AND_BAA_FIELD_LIMIT = FIRST_AND_BAA_BAAS.length;

/**
 * A reviewed finishing place in a field of up to 20 entrants.
 * Returns the table's BAAS number only; the caller must separately verify the
 * actual member, rank, field size and founder-approved tie treatment.
 */
export function firstAndBaaBaasAtPlace(place, fieldSize) {
  if (!Number.isSafeInteger(fieldSize) || fieldSize<1 || fieldSize>FIRST_AND_BAA_FIELD_LIMIT)
    throw new Error('nfl_baas_field_size_invalid');
  if (!Number.isSafeInteger(place) || place<1 || place>fieldSize)
    throw new Error('nfl_baas_finish_place_invalid');
  return FIRST_AND_BAA_BAAS[place-1];
}
