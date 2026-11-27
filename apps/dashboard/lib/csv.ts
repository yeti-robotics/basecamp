// Supported values inside a CSV cell.
export type CsvValue = string | number | boolean | null | undefined;

// Detect strings that spreadsheets could interpret as formulas.
const formulaPattern = /^[\s\uFEFF]*[=+\-@＝＋－＠]|^[\t\r\n]/;

// Convert a value into a safely escaped CSV cell.
export function escapeCsvCell(value: CsvValue): string {
  // Represent missing values as empty cells.
  if (value === null || value === undefined) {
    return '""';
  }

  let text = String(value);

  // Prevent user-provided strings from becoming spreadsheet formulas.
  // Actual numeric values, including negative numbers, remain unchanged.
  if (typeof value === 'string' && formulaPattern.test(text)) {
    text = `'${text}`;
  }

  // CSV represents literal quotation marks using two quotation marks.
  const escaped = text.replace(/"/g, '""');

  // Quoting every cell also handles commas and multiline text.
  return `"${escaped}"`;
}

// Convert rows and columns into a complete CSV document.
export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

// Download generated CSV content using the browser.
export function downloadCsv(filename: string, content: string): void {
  // A UTF-8 byte-order mark improves compatibility with Excel.
  const blob = new Blob(['\uFEFF', content], {
    type: 'text/csv;charset=utf-8;',
  });

  // Create a temporary URL pointing to the generated file.
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  try {
    anchor.href = url;
    anchor.download = filename;

    document.body.appendChild(anchor);

    // Trigger a normal browser download.
    anchor.click();
  } finally {
    // Clean up the temporary HTML element.
    anchor.remove();

    // Release the URL after the browser initiates the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
