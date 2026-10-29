const starter = {
  "description": "A minimal starter workflow that forwards instructions to the abstract generator.",
  "parameters": {
    "instructions": {
      "description": "Guidance for what to generate.",
      "required": true
    }
  },
  "steps": [
    {
      "generationId": "abstract",
      "description": "Run abstract generation with workflow-provided instructions.",
      "params": {
        "instructions": "{{instructions}}"
      }
    }
  ]
}

export default starter;
