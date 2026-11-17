import {runCli} from '@epsilon-asi/command-line';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createOpenAIModel, ENCRYPTED_REASONING, isReasoningModel} from '../../src/agents/index.js';
import {AgentEngineer} from '../../src/cli.js';
import {captureIO} from '../helpers/captureIO.js';
import {useConfigSandbox} from '../helpers/configSandbox.js';
import {initGitRepo} from '../helpers/gitRepo.js';

/**
 * Zero data retention, checked on the wire: the real CLI and the real OpenAI client, with fetch answered by a fake
 * OpenAI that records every request it is sent.
 */
interface SentRequest {
    url: string;
    body: Record<string, unknown> & { input?: unknown[]; tools?: unknown[] };
}

const USAGE = {
    input_tokens: 10,
    output_tokens: 5,
    total_tokens: 15,
    input_tokens_details: {cached_tokens: 0},
    output_tokens_details: {reasoning_tokens: 0},
};

const message = (text: string) => ({
    type: 'message',
    id: 'msg_1',
    status: 'completed',
    role: 'assistant',
    content: [{type: 'output_text', text, annotations: []}],
});

const SEALED = 'sealed-reasoning';

/** The intent request gets its choice; the agent reads a file on its first turn and answers on its second. */
function fakeOpenAI(): SentRequest[] {
    const requests: SentRequest[] = [];
    let agentTurns = 0;
    vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as SentRequest['body'];
        requests.push({url: String(url), body});
        const output = body.tools === undefined
            ? [message(JSON.stringify({choice: 'answer_question', reasoning: 'It asks about the code.'}))]
            : agentTurns++ === 0
                ? [
                    {type: 'reasoning', id: 'rs_1', summary: [], encrypted_content: SEALED},
                    {type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'read_file', arguments: '{"path":"pkg/src/greet.ts"}', status: 'completed'},
                ]
                : [message('greet returns a greeting.')];
        const response = {id: `resp_${requests.length}`, object: 'response', created_at: 0, status: 'completed', model: body['model'], output, usage: USAGE};
        return new Response(JSON.stringify(response), {status: 200, headers: {'content-type': 'application/json'}});
    });
    return requests;
}

describe('zero data retention', () => {
    const sandbox = useConfigSandbox();

    beforeEach(() => {
        initGitRepo(sandbox.project, {'pkg/src/greet.ts': 'export const greet = (name: string) => `Hello, ${name}!`;\n'});
        vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sends every request unstored, carrying the conversation instead of referring to stored responses', async () => {
        const requests = fakeOpenAI();
        const {io, stderr} = captureIO();

        // No models given, so the CLI builds its own: the default intent model and the config's agent model.
        const exitCode = await runCli(AgentEngineer, ['do', 'what', 'does', 'greet', 'return?'], {io});

        expect(exitCode, stderr()).toBe(0);
        // The intent, then the agent's turn that reads a file, then its answer.
        expect(requests).toHaveLength(3);
        for (const {url, body} of requests) {
            expect(url).toBe('https://api.openai.com/v1/responses');
            expect(body['store']).toBe(false);
            expect(body).not.toHaveProperty('previous_response_id');
            expect(body).not.toHaveProperty('background');
            expect(body).not.toHaveProperty('conversation');
            // Nothing points at a stored item: each one is sent in full, reasoning sealed.
            for (const item of body.input ?? []) {
                expect(item).not.toMatchObject({type: 'item_reference'});
                if ((item as { type?: string }).type === 'reasoning') {
                    expect(item).toHaveProperty('encrypted_content');
                }
            }
        }
        const [, firstTurn, secondTurn] = requests.map((request) => request.body);
        expect(firstTurn!['include']).toEqual([ENCRYPTED_REASONING]);
        // The agent's second turn sends back its sealed reasoning, its tool call and the tool's output.
        expect(secondTurn!.input).toContainEqual(expect.objectContaining({type: 'reasoning', encrypted_content: SEALED}));
        expect(secondTurn!.input).toContainEqual(expect.objectContaining({type: 'function_call', call_id: 'call_1', name: 'read_file'}));
        expect(secondTurn!.input).toContainEqual(expect.objectContaining({type: 'function_call_output', call_id: 'call_1'}));
    });

    it('asks only reasoning models for their reasoning', async () => {
        const requests = fakeOpenAI();

        await createOpenAIModel('gpt-4.1').invoke('hello');
        await createOpenAIModel('gpt-5.5').invoke('hello');

        expect(requests.map(({body}) => [body['model'], body['store'], body['include']])).toEqual([
            ['gpt-4.1', false, undefined],
            ['gpt-5.5', false, [ENCRYPTED_REASONING]],
        ]);
    });

    it.each([
        ['gpt-5.3-codex', true],
        ['gpt-5.5', true],
        ['gpt-6', true],
        ['o3', true],
        ['o4-mini', true],
        ['gpt-5-chat-latest', false],
        ['gpt-4.1-mini', false],
        ['gpt-4o', false],
        ['ft:gpt-5.5:org::id', false],
    ])('counts %s as reasoning: %s', (model, reasoning) => {
        expect(isReasoningModel(model)).toBe(reasoning);
    });
});
