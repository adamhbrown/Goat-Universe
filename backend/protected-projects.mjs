// Preserved projects are never valid development migration targets.
// Additions require review; do not replace this policy with an environment value.
export const PROTECTED_PROJECT_REFS = Object.freeze([
  'opvoemihfyxidzbdyory',
  'xcvptuqqtcebxorqlnsv',
  'lbzdmniuskyytwoaeyjn',
  'tyuhnlmrczwekqjnjdcw'
]);
export const isProtectedProject = ref => PROTECTED_PROJECT_REFS.includes(ref);
