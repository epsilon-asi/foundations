import type {CliInfo, OutputFormat, RuntimeInfo} from "../types.js";

export function renderOutput(data: object, format: OutputFormat): string {
    switch (format) {
        case 'json':
            return `${JSON.stringify(data, null, 2)}\n`;
        case 'text': {
            const entries = Object.entries(data);
            const width = Math.max(10, ...entries.map(([key]) => key.length + 2));
            return entries.map(([key, value]) => `${key.padEnd(width)}${textValue(value)}\n`).join('');
        }
    }
}

function textValue(value: unknown): string {
    return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}

/** The CLI's name and version and the Node.js version and platform it runs on. */
export function runtimeInfo(cli: CliInfo): RuntimeInfo {
    return {
        name: cli.name,
        version: cli.version,
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
    };
}
