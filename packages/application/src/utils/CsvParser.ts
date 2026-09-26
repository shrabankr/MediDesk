/**
 * Zero-dependency RFC 4180 CSV Parser & Generator with Formula Injection Defense.
 */

export interface ParsedCsvRow {
  rowNumber: number; // 1-indexed original CSV line number (accounting for header)
  data: Record<string, string>;
}

export class CsvParser {
  /**
   * Parse raw CSV string into an array of header-keyed objects with 1-based row numbers.
   */
  public static parse(csvContent: string): { headers: string[]; rows: ParsedCsvRow[] } {
    if (!csvContent || csvContent.trim().length === 0) {
      return { headers: [], rows: [] };
    }

    // Strip UTF-8 BOM if present
    const content = csvContent.charCodeAt(0) === 0xFEFF ? csvContent.slice(1) : csvContent;

    const rawRows = this.tokenize(content);
    if (rawRows.length === 0) {
      return { headers: [], rows: [] };
    }

    // Normalize headers: trim, lowercase, replace spaces/dashes with underscores
    const rawHeaders = rawRows[0];
    const headers = rawHeaders.map((h) => this.normalizeHeader(h));

    const rows: ParsedCsvRow[] = [];

    for (let i = 1; i < rawRows.length; i++) {
      const rawRow = rawRows[i];
      // Skip empty lines at end of file
      if (rawRow.length === 1 && rawRow[0].trim() === '') {
        continue;
      }

      const rowData: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        if (header) {
          const val = rawRow[j] !== undefined ? rawRow[j].trim() : '';
          rowData[header] = this.sanitizeValue(val);
        }
      }

      rows.push({
        rowNumber: i + 1, // Row number in file including 1-based header
        data: rowData
      });
    }

    return { headers, rows };
  }

  /**
   * Generate an RFC 4180 compliant CSV string from an array of objects or string rows.
   */
  public static stringify(headers: string[], dataRows: Array<Record<string, unknown> | string[]>): string {
    const lines: string[] = [];

    // Header line
    lines.push(headers.map((h) => this.escapeCell(h)).join(','));

    for (const row of dataRows) {
      let cells: string[];
      if (Array.isArray(row)) {
        cells = row.map((c) => this.escapeCell(String(c ?? '')));
      } else {
        cells = headers.map((h) => {
          const val = row[h];
          return this.escapeCell(val !== undefined && val !== null ? String(val) : '');
        });
      }
      lines.push(cells.join(','));
    }

    return lines.join('\r\n');
  }

  private static normalizeHeader(header: string): string {
    return header
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  private static sanitizeValue(val: string): string {
    // Defend against CSV injection (formula execution in Excel/Calc)
    if (val.length > 0 && ['=', '+', '-', '@', '\t', '\r'].includes(val[0])) {
      // If it looks like a formula rather than a negative number, prefix quote or strip
      if (val[0] === '-' && /^-\d+(\.\d+)?$/.test(val)) {
        return val;
      }
      return val.replace(/^[=+\-@\t\r]+/, '');
    }
    return val;
  }

  private static escapeCell(cellValue: string): string {
    const value = String(cellValue ?? '');
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private static tokenize(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote ("")
            currentCell += '"';
            i++; // skip next quote
          } else {
            // End of quoted block
            inQuotes = false;
          }
        } else {
          currentCell += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentCell);
          currentCell = '';
        } else if (char === '\r') {
          if (nextChar === '\n') {
            i++; // skip \n
          }
          currentRow.push(currentCell);
          rows.push(currentRow);
          currentRow = [];
          currentCell = '';
        } else if (char === '\n') {
          currentRow.push(currentCell);
          rows.push(currentRow);
          currentRow = [];
          currentCell = '';
        } else {
          currentCell += char;
        }
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell);
      rows.push(currentRow);
    }

    return rows;
  }
}
