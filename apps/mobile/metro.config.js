const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// --- Monorepo (pnpm) support ---
// 1. Watch all files in the monorepo so Metro can serve hoisted packages.
config.watchFolders = [monorepoRoot];

// 2. Let Metro resolve modules from BOTH the app's node_modules and the
//    monorepo root node_modules (where pnpm hoists shared deps like expo-router).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. pnpm uses symlinks/junctions — Metro must follow them.
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = false;

// Resolve @gastocheck/shared from the vendored local copy
// (avoids pnpm workspace:* protocol issues with EAS Build)
config.resolver.extraNodeModules = {
  '@gastocheck/shared': path.resolve(projectRoot, 'lib', 'shared'),
};

module.exports = config;
