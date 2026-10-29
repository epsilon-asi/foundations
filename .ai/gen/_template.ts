export const config = {
  "description": "Describe what this generator should create.",
  "instructions": "Explain the generation rules here.\n- what patterns to copy\n- what not to invent\n- what files to inspect when uncertain",
  "output": {
    "pathTemplate": "src/path/to/{{entityKebab}}.ts",
    "maxFiles": 1
  },
  "parameters": {
    "entity": {
      "description": "Example parameter.",
      "required": true
    }
  },
  "examples": [
    "src/path/to/example-one.ts",
    "src/path/to/example-two.ts"
  ],
  "context": [
    {
      "kind": "path",
      "path": "src/entities/{{entityKebab}}.entity.ts",
      "required": false
    },
    {
      "kind": "pattern",
      "pattern": "*{{entityKebab}}*.service.ts",
      "limit": 3
    }
  ],
  "tooling": {
    "allowGetExistingCode": true,
    "allowFindFiles": true,
    "allowSearchRepo": true
  }
}

export default config;
