import {EnvParseError} from './errors';
import type {
    EnvBooleanFalseValue,
    EnvBooleanTrueValue,
    EnvPrimitiveOrUndefined,
    EnvVarMetadata,
    NumberEnvVarMetadata,
} from './types';

export function toEnvKey(propertyName: string): string {
    return propertyName
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[-\s]+/g, '_')
        .toUpperCase();
}

export function parseEnvValue(args: {
    envName: string;
    propertyName: string;
    rawValue: string | undefined;
    metadata: EnvVarMetadata;
    emptyStringAsMissing: boolean;
}): EnvPrimitiveOrUndefined {
    const {envName, propertyName, rawValue, metadata, emptyStringAsMissing} = args;

    const missing =
        rawValue === undefined || (emptyStringAsMissing && rawValue.trim() === '');

    if (missing) {
        if ('default' in metadata) return metadata.default;
        if (metadata.required === false) return undefined;

        throw new EnvParseError(`Missing required environment variable "${envName}".`, {
            envName,
            propertyName,
        });
    }

    switch (metadata.type) {
        case 'string':
            return rawValue;

        case 'number':
            return parseNumberValue({
                envName,
                propertyName,
                rawValue,
                metadata,
            });

        case 'boolean':
            return parseBooleanValue({
                envName,
                propertyName,
                rawValue,
            });

        default:
            return assertNever(metadata);
    }
}

function parseNumberValue(args: {
    envName: string;
    propertyName: string;
    rawValue: string;
    metadata: NumberEnvVarMetadata;
}): number {
    const {envName, propertyName, rawValue, metadata} = args;
    const value = Number(rawValue);

    if (!Number.isFinite(value)) {
        throw new EnvParseError(
            `Environment variable "${envName}" must be a finite number. Received "${rawValue}".`,
            {envName, propertyName},
        );
    }

    if (metadata.integer === true && !Number.isInteger(value)) {
        throw new EnvParseError(
            `Environment variable "${envName}" must be an integer. Received "${rawValue}".`,
            {envName, propertyName},
        );
    }

    if (metadata.min !== undefined && value < metadata.min) {
        throw new EnvParseError(
            `Environment variable "${envName}" must be >= ${metadata.min}. Received "${rawValue}".`,
            {envName, propertyName},
        );
    }

    if (metadata.max !== undefined && value > metadata.max) {
        throw new EnvParseError(
            `Environment variable "${envName}" must be <= ${metadata.max}. Received "${rawValue}".`,
            {envName, propertyName},
        );
    }

    return value;
}

function parseBooleanValue(args: {
    envName: string;
    propertyName: string;
    rawValue: string;
}): boolean {
    const {envName, propertyName, rawValue} = args;
    const normalized = rawValue.trim().toLowerCase();

    if (isTruthyEnvValue(normalized)) return true;
    if (isFalsyEnvValue(normalized)) return false;

    throw new EnvParseError(
        `Environment variable "${envName}" must be a boolean. Received "${rawValue}".`,
        {envName, propertyName},
    );
}

function isTruthyEnvValue(value: string): value is EnvBooleanTrueValue {
    return value === 'true'
        || value === '1'
        || value === 'yes'
        || value === 'y'
        || value === 'on';
}

function isFalsyEnvValue(value: string): value is EnvBooleanFalseValue {
    return value === 'false'
        || value === '0'
        || value === 'no'
        || value === 'n'
        || value === 'off';
}

function assertNever(value: never): never {
    throw new EnvParseError(`Unsupported env metadata: ${JSON.stringify(value)}`);
}
