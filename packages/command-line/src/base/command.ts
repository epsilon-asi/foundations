import type {CliInfo, CommandContext, CommandResult, OutputFormat, RunnableCommand, RuntimeInfo} from "../types.js";
import {Option} from "../createCliSystem.js";
import {renderOutput, runtimeInfo} from "./util.js";
import {OUTPUT_FORMATS,} from "./static.js";

/**
 * The base a command extends. It brings the `-f, --format <format>` option
 * (`text` or `json`, default `text`) and `render()` to print data in that
 * format, so a command declares only its own options and `run()`:
 *
 * ```ts
 * @Command({ description: 'Print CLI and runtime information.' })
 * export class InfoCommand extends CliCommand<App> {
 *   run({ io, cli }: CommandContext<App>): void {
 *     io.stdout(this.render(this.runtimeInfo(cli)));
 *   }
 * }
 * ```
 *
 * `@Option` is inherited, so a subclass must not declare `format` again.
 * `@Command` is not: every concrete command declares its own.
 */
export abstract class CliCommand<TRoot extends object = object> implements RunnableCommand<TRoot> {
    @Option.choice({short: 'f', choices: OUTPUT_FORMATS, default: 'text', description: 'output format'})
    format!: OutputFormat;

    abstract run(context: CommandContext<TRoot>): CommandResult | Promise<CommandResult>;

    /** `data` as `--format` asks for it. Override to print something else for `text`. */
    protected render(data: object): string {
        return renderOutput(data, this.format);
    }

    /** The CLI and runtime facts an info command reports. */
    protected runtimeInfo(cli: CliInfo): RuntimeInfo {
        return runtimeInfo(cli);
    }
}