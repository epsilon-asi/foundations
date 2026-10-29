import OpenAI from "openai";
import {EnvVar, loadEnvVars, StringEnvVar} from "../../environment/types";
import {GenerateResponseOpts, ZodInputType, ZodOutputType} from "./types";
import {z} from "zod/v4";
import ComparisonFilter = OpenAI.ComparisonFilter;
import CompoundFilter = OpenAI.CompoundFilter;

export class OpenAIApiServiceEnvironment {
    @StringEnvVar()
    OPENAI_API_KEY!: string
    @StringEnvVar()
    OPENAI_PROJECT!: string
}

export class OpenAIApiService {
    private debug: boolean = true;
    private client!: OpenAI;
    private readonly config!: OpenAIApiServiceEnvironment;

    constructor(overrides: ConstructorParameters<typeof OpenAI>) {
        this.config = new OpenAIApiServiceEnvironment();
        loadEnvVars(this.config);
        this.client = new OpenAI({
            timeout: 300000,
            apiKey: this.config.OPENAI_API_KEY,
            project: this.config.OPENAI_PROJECT,
        });

    }

    async searchVectorStore(opts: {
        vectorStoreId: string,
        query: string,
        filter?: ComparisonFilter | CompoundFilter,
        scoreThreshold?: number
    }): Promise<OpenAI.VectorStores.VectorStoreSearchResponsesPage> {

        return this.client.vectorStores.search(opts.vectorStoreId, {
            query: opts.query,
            ranking_options: {
                score_threshold: opts.scoreThreshold ?? 0.5,
            },
            filters: opts.filter
        })
    }

    async deleteFile(opts: {
        vectorStoreId: string,
        fileId: string,
        deleteUnderlyingFile?: boolean
    }): Promise<OpenAI.VectorStores.Files.VectorStoreFileDeleted> {

        const result = await this.client.vectorStores.files.delete(opts.fileId, {
            vector_store_id: opts.vectorStoreId,
        });

        if (opts.deleteUnderlyingFile ?? true) {
            await this.client.files.delete(opts.fileId);
        }

        return result;
    }

    async createVectorStore(opts: {
        name: string,
        metadata?: Record<string, string>,
    }): Promise<OpenAI.VectorStores.VectorStore> {
        return this.client.vectorStores.create({
            name: opts.name,
            metadata: opts.metadata,
        });
    }

    async deleteVectorStore(opts: {
        vectorStoreId: string
    }): Promise<OpenAI.VectorStores.VectorStoreDeleted> {

        return this.client.vectorStores.delete(opts.vectorStoreId);
    }

    async generateResponse<Type extends string | ZodInputType = string, ApplicationMetadata extends Record<string, string> = {}>(
        opts: GenerateResponseOpts<Type, ApplicationMetadata>
    ): Promise<ZodOutputType<Type>> {

        const {
            reasoning,
            metadata,
            model,
            vectorStores,
            previousResponseId,
            tools,
            web_search,
            tool_choice,
            schema,
            input
        } = opts;

        let data: ApplicationMetadata | undefined

        const defaultProps: any = {};

        const compiledTools = {
            ...tools,
        };

        if (metadata) {
            if (this.debug) console.debug("Metadata was provided.");

            data = {
                ...metadata
            };

            for (const key of Object.keys(metadata)) {
                const providedValue = metadata[key as keyof ApplicationMetadata];

                if (providedValue !== undefined && providedValue !== null) {
                    data[key as keyof ApplicationMetadata] = providedValue;
                }
            }
        }

        const toolDefs: OpenAI.Responses.Tool[] = Object
            .values(compiledTools)
            .map(obj => obj.tool);

        if (web_search) {
            toolDefs.push(web_search);
        }

        if (toolDefs.length > 0) {
            if (this.debug) console.debug("Tools were provided, setting up tools object");

            defaultProps.tools = toolDefs;
        }

        if (previousResponseId) {
            defaultProps.previous_response_id = previousResponseId;
        }

        if (model) {
            defaultProps.model = model;
        }

        if (typeof schema !== "string" && typeof schema !== "undefined") {
            if (this.debug) console.debug("Setting up schema response object");

            defaultProps.text = {
                format: {
                    type: "json_schema",
                    name: "output_object",
                    schema: z.toJSONSchema(schema),
                }
            };
        }

        if (vectorStores) {
            if (!defaultProps.tools) {
                defaultProps.tools = [];
            }

            const uniqueVectorStores = new Set(vectorStores);

            if (this.debug) {
                console.debug(`Using ${uniqueVectorStores.size} vector stores.`, uniqueVectorStores);
            }

            defaultProps.tools.push({
                type: "file_search",
                vector_store_ids: [...uniqueVectorStores],
            });
        }

        if (reasoning) {
            defaultProps.reasoning = reasoning;
        }

        if (this.debug) {
            console.debug("Calling model with props", defaultProps);
        }

        const promise = this.client.responses.create({
            ...defaultProps,
            tool_choice: tool_choice
                ? tool_choice
                : undefined,
            input,
        }, {
            timeout: 100_000
        });

        if (this.debug) {
            console.debug(promise);

            for (const time of [1, 2, 3, 4, 5]) {
                setTimeout(() => {
                    console.debug(promise);
                }, time * 1000);
            }
        }

        await promise.asResponse();

        if (this.debug) {
            console.debug(promise);
        }

        const result = await promise;

        if (result.status !== "completed") {
            throw Error("Failed to generate OpenAI response");
        }

        const lastMessage = result.output[result.output.length - 1];

        if (lastMessage.type === "function_call") {
            console.log(`handling function call - ${lastMessage.name}`);

            const toolCallResult = await compiledTools[lastMessage.name].cb(
                JSON.parse(lastMessage.arguments)
            );

            const nextToolChoice =
                opts.tool_choice === "required" || previousResponseId
                    ? "auto"
                    : opts.tool_choice;

            return this.generateResponse<Type>({
                ...opts,
                tool_choice: nextToolChoice,
                previousResponseId: result.id,
                input: [{
                    type: "function_call_output",
                    call_id: lastMessage.call_id,
                    output: JSON.stringify(toolCallResult)
                }],
            });
        }

        if (schema) {
            return JSON.parse(result.output_text) as ZodOutputType<Type>;
        }

        return result.output_text as ZodOutputType<Type>;
    }

}

