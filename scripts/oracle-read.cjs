require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'es2015', moduleResolution: 'node' }
});
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
require('../lib/oracles/readOracles.ts');


