const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Resolve @gastocheck/shared from the vendored local copy
config.resolver.extraNodeModules = {
  '@gastocheck/shared': path.resolve(projectRoot, 'lib', 'shared'),
};

module.exports = config;
