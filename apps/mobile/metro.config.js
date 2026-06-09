const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = ['ts', 'tsx', 'js', 'json', 'mjs'];

module.exports = config;
