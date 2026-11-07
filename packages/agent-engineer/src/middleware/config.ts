import {defineMiddleware} from '@epsilon-asi/command-line';
import {createLayeredFile} from '@epsilon-asi/foundation/files';
import {GlobalConfigSchema} from '../config/global-config.js';


export const CONFIG_FILE_NAME = 'agent-engineer.yaml';

export const USER_CONFIG_PATH = `~/.easi/${CONFIG_FILE_NAME}`;

export const AgentEngineerConfig = createLayeredFile(GlobalConfigSchema, CONFIG_FILE_NAME, {
    fallbacks: [USER_CONFIG_PATH],
});

export const config = defineMiddleware({
    name: 'config',
    options: {
        config: {
            type: 'string',
            short: 'c',
            env: 'EASI_AGENT_CONFIG',
            description: 'Relative or absolute path to additional config to load. This config takes precedence over all others.'
        }
    },
    async handle(ctx, next) {
        const {value, layers} = await AgentEngineerConfig.load({
            extraFiles: []
        }, );

        ctx.logger.debug(
            layers.length === 0
                ? `no ${CONFIG_FILE_NAME} found; using the default config`
                : `config merged from ${layers.map(({filePath, origin}) => `${filePath} (${origin})`).join(', ')}`,
        );

        return next({config: value, configLayers: layers});
    },
});
