const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Resolve @gastocheck/shared from the vendored local copy
// (avoids pnpm workspace:* protocol issues with EAS Build)
config.resolver.extraNodeModules = {
  '@gastocheck/shared': path.resolve(projectRoot, 'lib', 'shared'),
};

module.exports = config;
