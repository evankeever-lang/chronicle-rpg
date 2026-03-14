const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// three@0.166 ships with "type":"module". Metro validates resolved paths
// against the package exports map and rejects the CJS build.
// Disable exports-field resolution so Metro falls back to the "main" field
// (which correctly points to three.cjs).
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
