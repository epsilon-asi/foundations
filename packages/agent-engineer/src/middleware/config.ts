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
        config: {}
    },
    async handle(ctx, next) {
        const {value, layers} = await AgentEngineerConfig.load();
        AgentEngineerConfig.l
        ctx.logger.debug(
            layers.length === 0
                ? `no ${CONFIG_FILE_NAME} found; using the default config`
                : `config merged from ${layers.map(({filePath, origin}) => `${filePath} (${origin})`).join(', ')}`,
        );

        return next({config: value, configLayers: layers});
    },
});
