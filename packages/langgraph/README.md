# LangGraph Zod Standard Builder

A small Zod v4-first wrapper around LangGraph `StateGraph` that standardizes graph input, graph output, graph working state, every node input, every node output, and every node-local working state.

It also adds hooks, logging, default checkpointing, resume helpers, and direct node-testing tools.

## Install

```bash
npm install @langchain/langgraph @langchain/core zod
npm install -D typescript vitest @vitest/coverage-v8 @types/node
```

## Compatibility

This package is written for a strict CommonJS project style:

```json
{
  "compilerOptions": {
    "target": "es2016",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "./build"
  }
}
```

## Core idea

You define schemas once with Zod. TypeScript types are inferred from those schemas, and runtime values are validated at graph and node boundaries.

```ts
import { z } from "zod";
import { defineGraph, END, nodeResult, START } from "./src";

const Input = z.object({ text: z.string().min(1) });
const Output = z.object({ answer: z.string(), length: z.number() });
const Working = z.object({ requestId: z.string().optional() });

const graph = defineGraph({
  name: "qa",
  input: Input,
  output: Output,
  state: Working,
})
  .addNode("normalize", {
    input: z.string(),
    output: z.object({ normalized: z.string(), length: z.number() }),
    state: z.object({ runs: z.number() }),
    initialState: () => ({ runs: 0 }),
    select: (state) => state.in.text,
    run: ({ input, state }) =>
      nodeResult(
        { normalized: input.trim().toLowerCase(), length: input.trim().length },
        { runs: state.runs + 1 }
      ),
  })
  .addNode("answer", {
    input: z.object({ normalized: z.string(), length: z.number() }),
    output: Output,
    select: (state) => state.state.normalize!,
    run: ({ input }) => nodeResult({ answer: input.normalized, length: input.length }),
    writes: { graphOutput: true },
  })
  .addEdge(START, "normalize")
  .addEdge("normalize", "answer")
  .addEdge("answer", END)
  .compile();

const result = await graph.invoke({ text: "  Hello  " }, { threadId: "example-thread" });

result.in.text;                    // string, parsed by Input
result.out?.answer;                // string, parsed by Output
result.state.normalize?.length;    // number, parsed by normalize.output
result.nodes.normalize?.state.runs // number, parsed by normalize.state
```

## Inferred state shape

Each node contributes two typed areas automatically:

```ts
result.state.<nodeName>       // parsed node output
result.nodes.<nodeName>.in    // parsed node input
result.nodes.<nodeName>.out   // parsed node output
result.nodes.<nodeName>.state // parsed node-local state
```

The exported `GraphStateSchemaUnion` type is the union of:

```ts
graph input output
graph output output
graph working state output
every node input output
every node output output
every node working-state output
```

The compiled graph also exposes runtime schemas:

```ts
graph.schemas.input.parse(value);
graph.schemas.output.parse(value);
graph.schemas.state.parse(value);
graph.schemas.union().safeParse(value);
graph.schemas.graphState().parse(result);
graph.schemas.node("normalize");
graph.schemas.nodes();
```

## Hooks and logging

```ts
const events: string[] = [];
const graph = defineGraph({
  input: Input,
  output: Output,
  hooks: [(event) => events.push(event.type)],
});
```

Hook event types include graph lifecycle events, node lifecycle events, and checkpoint lifecycle events.

## Checkpointing and resume

Checkpointing defaults to LangGraph `MemorySaver`. Disable it with:

```ts
.compile({ checkpointer: false })
```

Resume an interrupted graph with:

```ts
await graph.resume(true, { threadId: "example-thread" });
```

## Testing helpers

```ts
const initial = graph.test.makeInitialState({ text: "unit" });
const update = await graph.test.invokeNode("normalize", initial);
```

## Verification

The included test suite was run with:

```bash
npm run test:all
```

Latest result:

```text
Typecheck: passed
Tests:     24 passed
Build:     passed
Coverage:
  Statements: 99.36%
  Branches:   99.24%
  Functions:  100%
  Lines:      99.33%
```
