export const config = {
  "repoRoot": ".",
  "generationsDir": ".ai/gen",
  "workflowsDir": ".ai/flows",
  "model": "gpt-5.3-codex",
  "maxToolRounds": 100,
  "maxContextFileSizeBytes": 60000,
  "defaultMaxOutputFiles": 10,
  "ignore": [
    ".git",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".turbo",
    ".cache",
    "coverage",
    ".idea",
    ".vscode",
    ".langgraph_api",
    ".langgraph_checkpoint"
  ],
  "offLimits": [
    ".env",
    ".env.*",
    "*.pem",
    "*.key",
    "*.crt",
    "*.p12",
    "*.pfx"
  ],
  "defaultContext": [
    {
      "kind": "path",
      "path": "docs/ARCHITECTURE_AND_PHILOSOPHY.md",
      "description": "Repository design rules: minimal call sites, defaults over required inputs, one options object. New code follows them.",
      "required": true
    }
  ],
  "defaultKeywordContexts": [],
  "openai": {
    "timeoutMs": 120000,
    "reconnectPollTimeoutMs": 30000,
    "reconnectPollIntervalMs": 2000
  },
  "logging": {
    "level": "info",
    "pretty": true
  }
};
export default config;
