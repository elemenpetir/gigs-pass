module.exports = {
  testEnvironment: "node",
  globalSetup: "<rootDir>/__tests__/integration/setup/globalSetup.js",
  setupFiles: ["<rootDir>/__tests__/integration/setup/env.js"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/integration/setup/teardown.js"],
  testMatch: ["**/__tests__/integration/db/**/*.test.js"],
  coveragePathIgnorePatterns: ["/node_modules/"],
  verbose: true,
};
