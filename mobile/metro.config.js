const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    sourceExts: [...defaultConfig.resolver.sourceExts, 'ts', 'tsx', 'cjs', 'mjs'],
    assetExts: [
      ...defaultConfig.resolver.assetExts.filter(ext => ext !== 'tflite'),
      'tflite',
      'bin',
      'pb',
    ],
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(defaultConfig, config);
