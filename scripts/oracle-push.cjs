// Register ts-node overriding bundler settings for CLI scripts
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'es2015', moduleResolution: 'node' }
});

// Always load the project's root .env regardless of where this script is invoked from
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

require('../lib/oracles/pushPrices.ts');


