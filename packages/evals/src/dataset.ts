import {readFile} from 'node:fs/promises';
import {extname} from 'node:path';
import {parse as parseYaml} from 'yaml';

/**
 * Reads the records of a dataset file and turns each into what the eval needs with `parse`, which throws to reject
 * one. `.json` holds an array (or an object with a `cases` array), `.jsonl` one record per line, and `.yaml` / `.yml`
 * an array or a `cases` array. Errors name the file and the record.
 */
export async function loadDataset<T>(path: string, parse: (record: unknown, index: number) => T): Promise<T[]> {
    const text = await readFile(path, 'utf8');
    const extension = extname(path).toLowerCase();
    let records: unknown;
    if (extension === '.jsonl') {
        records = text.split('\n').filter((line) => line.trim() !== '').map((line, index) => {
            try {
                return JSON.parse(line) as unknown;
            } catch (error) {
                throw new Error(`${path}: line ${index + 1} is not JSON: ${(error as Error).message}`);
            }
        });
    } else if (extension === '.json') {
        records = JSON.parse(text) as unknown;
    } else if (extension === '.yaml' || extension === '.yml') {
        records = parseYaml(text) as unknown;
    } else {
        throw new Error(`${path}: datasets are .json, .jsonl, .yaml or .yml files.`);
    }

    const list = Array.isArray(records) ? records : (records as { cases?: unknown } | null)?.cases;
    if (!Array.isArray(list)) {
        throw new Error(`${path}: expected a list of records, or an object with a "cases" list.`);
    }
    return list.map((record, index) => {
        try {
            return parse(record, index);
        } catch (error) {
            throw new Error(`${path}: record ${index + 1}: ${(error as Error).message}`);
        }
    });
}
