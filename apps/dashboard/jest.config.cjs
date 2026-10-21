const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

module.exports = createJestConfig({
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    '{app,components,lib,src}/**/*.{js,jsx,ts,tsx}',
    '!**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  passWithNoTests: true,
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/src/**/*.(test|spec).{js,jsx,ts,tsx}',
    '<rootDir>/app/**/*.(test|spec).{ts,tsx}',
    '<rootDir>/lib/**/*.(test|spec).{ts,tsx}',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
});
