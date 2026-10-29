const abstract = {
  "abstract": true,
  "description": "Generate or update files based on the given instructions provided by the user.",
  "instructions": "FIRST you must thoroughly search the codebase for all possible relevant code before proceeding to creating the output that the user as requested.\nIf the user doesn't specify some details, you must infer that based on patterns shown in similar objects or files. For example, if the user asks for an Entity, you must look at other entities and see how they are defined before defining yours. \nGenerate or update files based on the given instructions provided by the user.\nThis file must match structure, imports, decorator usage, route naming, constructor style, DTO references, and service interaction patterns used by other similar files.\nIf you are replacing a file, you must copy it EXACTLY as it is, and then ONLY changing what you are asked to change or add.\n\nRules:\n- You must clearly define property types\n- You must properly type functions  \n- Do not map or expose any sensitive properties such as passwords. All other properties are fair game.\n- If you go against patterns shown in other files, you must leave comments explaining why",
  "output": {
    "pathTemplates": [],
    "maxFiles": 5
  },
  "parameters": {
    "instructions": {
      "description": "Guidelines for the agent to know how to define the files or code. i.e its purpose or use",
      "required": true
    }
  },
  "examples": [],
  "context": [],
  "tooling": {
    "allowGetExistingCode": true,
    "allowFindFiles": true,
    "allowSearchRepo": true
  }
}

export default abstract;
