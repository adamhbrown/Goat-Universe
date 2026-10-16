// Trust anchor for the reviewed prototype. These hashes were independently read
// from this Git commit, not from the candidate's editable deployment manifest.
// Changes to this file require security review together with the actual SQL diff.
export const REVIEWED_PROTOTYPE_COMMIT = 'c8b120dfc0f81bcc480408d6eee914893bd6ad84';
export const REVIEWED_MIGRATIONS = Object.freeze({
  'supabase/migrations/20261014000100_foundations.sql': 'f076b24ae9a0716e4efb8e8c0a776f548d53e3cc9749de51f8d0f549ede76b8c',
  'supabase/migrations/20261014000200_workflows.sql': '09f153d12c592db5e25f5a578ec7ec99bb306b5d96dbde05c40e8fb9da9e98ea',
  'supabase/migrations/20261014092016_portal_and_security.sql': '9415e31aeee3f0a93cdb59b8efe2f4970082c8848556da52e9f6934c545f5753',
  'supabase/migrations/20261014095916_march_madness_and_five_game_drafts.sql': 'fd4fe1b49b2058c1a0fb6567863e0a5551bdfabfd13530e4d1d63108077e8b0d',
  'supabase/migrations/20261014221554_bullpen_private_boardroom.sql': '1883649abf9342be1efc28936d92b373ce48be68f6d9ae72b494cda4e1843a08'
});
