/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/tests/**/*.test.ts'],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/test/",
    "/tests/"
  ]
};
