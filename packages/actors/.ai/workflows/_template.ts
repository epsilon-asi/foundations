export const workflow = {
  "description": "Describe what this workflow orchestrates.",
  "parameters": {
    "instructions": {
      "description": "User-provided instructions passed to the workflow steps.",
      "required": true
    }
  },
  "steps": [
    {
      "generationId": "abstract",
      "description": "Run one generation step with interpolated instructions.",
      "params": {
        "instructions": "{{instructions}}"
      }
    }
  ]
}

export default workflow;
