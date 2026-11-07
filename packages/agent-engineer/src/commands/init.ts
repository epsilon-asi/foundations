import {Argument, CliCommand, Command, type CommandContext, Option} from '@epsilon-asi/command-line';
import {relative, resolve} from 'node:path';
import type {AgentEngineer} from '../cli.js';
import {assertTargetDir, planFiles, writeFiles} from '../project-templates/apply.js';
import {getTemplate, type LoadedTemplate, listTemplates, TEMPLATES_DIR} from '../project-templates/registry.js';
import {parseVarArgs, resolveVariables} from '../project-templates/render.js';

/**
 * `agent-engineer init [template] [name] [key=value...]`: creates a project
 * from one of the templates in this package's `templates/` folder. With no
 * template it lists them.
 */
@Command({
    description: 'Create a project from a project template, or list the templates.',
})
export class InitCommand extends CliCommand<AgentEngineer> {
    @Argument.string({required: false, description: 'template id; omit to list the templates'})
    template?: string;

    @Argument.string({required: false, description: 'project name'})
    name?: string;

    @Argument.list({required: false, description: 'template variables as key=value'})
    vars!: string[];

    @Option.string({description: 'folder to create the project in (default: ./<name>)'})
    dir?: string;

    @Option.boolean({description: 'print the files that would be written, without writing them'})
    dryRun?: boolean;

    @Option.boolean({description: 'write into a folder that is not empty'})
    force?: boolean;

    async run({io, logger}: CommandContext<AgentEngineer>): Promise<void> {
        // TEMPLATES_DIR is passed explicitly so tests can point it at fixtures.
        if (this.template === undefined) {
            io.stdout(this.renderList(await listTemplates(TEMPLATES_DIR)));
            return;
        }

        const template = await getTemplate(this.template, TEMPLATES_DIR);
        if (this.name === undefined) {
            throw new Error(`Missing project name: agent-engineer init ${template.id} <name>`);
        }

        const vars = resolveVariables(template, this.name, parseVarArgs(this.vars ?? []));
        const targetDir = resolve(process.cwd(), this.dir ?? this.name);
        logger.debug(`rendering ${template.dir} into ${targetDir}`);

        const plan = await planFiles(template, targetDir, vars);
        const force = this.force ?? false;
        const dryRun = this.dryRun ?? false;
        if (dryRun) {
            await assertTargetDir(targetDir, force);
        } else {
            await writeFiles(plan, targetDir, {force});
        }

        const files = plan.map((file) => ({path: file.path, rendered: file.render}));
        if (this.format === 'json') {
            io.stdout(this.render({template: template.id, dir: targetDir, dryRun, files}));
            return;
        }

        const shownDir = relative(process.cwd(), targetDir) || '.';
        const lines = [
            dryRun
                ? `Would create ${shownDir} from ${template.id}:`
                : `Created ${shownDir} from ${template.id}:`,
            ...files.map((file) => `  ${file.path}${file.rendered ? '  (rendered)' : ''}`),
        ];
        io.stdout(`${lines.join('\n')}\n`);
    }

    private renderList(templates: LoadedTemplate[]): string {
        if (this.format === 'json') {
            return this.render(
                templates.map(({id, description, variables}) => ({id, description, variables})),
            );
        }
        if (templates.length === 0) {
            return 'No templates found.\n';
        }

        const width = Math.max(...templates.map((t) => t.id.length));
        const lines: string[] = [];
        for (const template of templates) {
            lines.push(`${template.id.padEnd(width)}  ${template.description}`);
            for (const [key, spec] of Object.entries(template.variables)) {
                const detail = spec.required
                    ? ' (required)'
                    : spec.default !== undefined
                        ? ` (default: ${spec.default})`
                        : '';
                lines.push(`${' '.repeat(width)}    ${key}=  ${spec.description}${detail}`);
            }
        }
        return `${lines.join('\n')}\n`;
    }
}
