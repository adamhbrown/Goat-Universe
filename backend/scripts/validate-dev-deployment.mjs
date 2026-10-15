import {developmentMigrationTarget} from '../deployment-target.mjs';
try{console.log(JSON.stringify({target:'development',project_ref:developmentMigrationTarget(process.env)}));}
catch(error){console.error(error.message);process.exitCode=1;}
