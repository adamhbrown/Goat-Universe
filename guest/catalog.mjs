// Explicitly reviewed guest attraction catalog; never accept arbitrary HTML
// just because it is served from the GOATVILLE domain.
// This is recreational and can issue only local-unverified souvenirs.
const FIELD_VISION=Object.freeze({
  id:'field-vision',
  version:1,
  title:'GOATVILLE Field Vision strategy drill',
  achievements:Object.freeze(['field-vision-clear']),
  entry:'./field-vision.html'
});

export function resolveApprovedGuestEntry({attraction,entryURL,origin,hostModuleURL}) {
  const approved=FIELD_VISION;
  if (!attraction || attraction.id!==approved.id ||
      attraction.version!==approved.version || attraction.title!==approved.title ||
      !Array.isArray(attraction.achievements) ||
      attraction.achievements.length!==approved.achievements.length ||
      !attraction.achievements.every((value,index)=>value===approved.achievements[index]))
    throw new Error('unreviewed_game');

  const expected=new URL(approved.entry,hostModuleURL);
  const proposed=new URL(entryURL,origin+'/');
  if (!['http:','https:'].includes(proposed.protocol) ||
      proposed.origin!==origin || expected.origin!==origin ||
      proposed.username || proposed.password || proposed.search || proposed.hash ||
      proposed.href!==expected.href)
    throw new Error('invalid_game_entry');
  return expected;
}
