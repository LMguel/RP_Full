module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.ts', '.android.ts', '.ts', '.ios.tsx', '.android.tsx', '.tsx', '.jsx', '.js', '.json'],
        alias: {
          '@': './src',
          '@api': './src/api',
          '@app': './src/app',
          '@components': './src/components',
          '@database': './src/database',
          '@features': './src/features',
          '@hooks': './src/hooks',
          '@navigation': './src/navigation',
          '@repositories': './src/repositories',
          '@services': './src/services',
          '@storage': './src/storage',
          '@types': './src/types',
          '@utils': './src/utils',
          '@workers': './src/workers',
        },
      },
    ],
    [
      'react-native-worklets-core/plugin',
    ],
    // Reanimated deve ser sempre o último plugin (documentação oficial).
    'react-native-reanimated/plugin',
  ],
};
