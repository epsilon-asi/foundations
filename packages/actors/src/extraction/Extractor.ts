import { ExtractionError } from '../errors/ExtractionError.js';
import type { PageAdapter } from '../interaction/PageAdapter.js';

export interface TableData {
  headers: string[];
  rows: Array<Record<string, string>>;
}

export class Extractor {
  constructor(private readonly page: PageAdapter) {}

  text(selector: string): Promise<string> {
    return this.page.text(selector);
  }

  textList(selector: string): Promise<string[]> {
    return this.page.textAll(selector);
  }

  attr(selector: string, name: string): Promise<string | null> {
    return this.page.attr(selector, name);
  }

  async hrefs(selector: string): Promise<string[]> {
    const page = this.page.raw();
    return page.$$eval(selector, elements =>
      elements
        .map(element => element.getAttribute('href'))
        .filter((href): href is string => href !== null && href.length > 0)
    );
  }

  async jsonLd<T = unknown>(): Promise<T[]> {
    const page = this.page.raw();
    return page.$$eval('script[type="application/ld+json"]', elements =>
      elements.flatMap(element => {
        try {
          const text = element.textContent ?? '';
          return text.length > 0 ? [JSON.parse(text)] : [];
        } catch {
          return [];
        }
      })
    ) as Promise<T[]>;
  }

  async table(tableSelector: string): Promise<TableData> {
    try {
      return await this.page.raw().$eval(tableSelector, table => {
        const headerCells = Array.from(table.querySelectorAll('thead th'));
        const headers = headerCells.map(cell => (cell.textContent ?? '').replace(/\s+/g, ' ').trim());
        const rows = Array.from(table.querySelectorAll('tbody tr')).map(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          return Object.fromEntries(cells.map((cell, index) => [
            headers[index] ?? `column_${index + 1}`,
            (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
          ]));
        });
        return { headers, rows };
      });
    } catch (error) {
      throw new ExtractionError(`Could not extract table from selector: ${tableSelector}`, { cause: error });
    }
  }
}
