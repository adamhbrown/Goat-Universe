import {assertMigrationExecutionAllowed} from '../migration-hold.mjs';
try { assertMigrationExecutionAllowed(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
