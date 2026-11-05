export class EnvParseError extends Error {
    public readonly envName?: string;
    public readonly propertyName?: string;
    /** The dotenv file involved, for errors raised while reading one. */
    public readonly filePath?: string;

    public constructor(
        message: string,
        details: { envName?: string; propertyName?: string; filePath?: string; cause?: unknown } = {},
    ) {
        super(message, details.cause === undefined ? undefined : {cause: details.cause});
        this.name = 'EnvParseError';
        this.envName = details.envName;
        this.propertyName = details.propertyName;
        this.filePath = details.filePath;
    }
}
