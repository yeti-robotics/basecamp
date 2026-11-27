import { downloadCsv, escapeCsvCell, toCsv } from './csv';

// Verify that individual CSV cells are correctly formatted.
describe('escapeCsvCell', () => {
  it('quotes ordinary text', () => {
    expect(escapeCsvCell('Alex Morgan')).toBe('"Alex Morgan"');
  });

  it('handles numeric and boolean values', () => {
    expect(escapeCsvCell(42)).toBe('"42"');
    expect(escapeCsvCell(0)).toBe('"0"');
    expect(escapeCsvCell(-5)).toBe('"-5"');
    expect(escapeCsvCell(true)).toBe('"true"');
    expect(escapeCsvCell(false)).toBe('"false"');
  });

  it('handles missing values', () => {
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
  });

  it('handles empty strings', () => {
    expect(escapeCsvCell('')).toBe('""');
  });

  it('preserves commas inside a value', () => {
    expect(escapeCsvCell('Morgan, Alex')).toBe('"Morgan, Alex"');
  });

  it('escapes quotation marks', () => {
    expect(escapeCsvCell('Alex "Ace" Morgan')).toBe('"Alex ""Ace"" Morgan"');
  });

  it('preserves multiline text', () => {
    expect(escapeCsvCell('First line\nSecond line')).toBe('"First line\nSecond line"');
  });

  it('preserves Unicode characters', () => {
    expect(escapeCsvCell('José García')).toBe('"José García"');
    expect(escapeCsvCell('李明')).toBe('"李明"');
  });

  it('preserves ordinary punctuation inside strings', () => {
    expect(escapeCsvCell('Alex-Morgan')).toBe('"Alex-Morgan"');
    expect(escapeCsvCell('Alex@example.com')).toBe('"Alex@example.com"');
  });

  // Test potentially unsafe spreadsheet formulas.
  it.each([
    '=SUM(A1:A2)',
    '+123',
    '-123',
    '@SUM(A1:A2)',
    '  =1+1',
    '\t=1+1',
    '\rtext',
    '\ntext',
    '\uFEFF=1+1',
    '＝1+1',
    '＋123',
    '－123',
    '＠SUM(A1:A2)',
  ])('neutralizes spreadsheet formulas: %j', (value) => {
    expect(escapeCsvCell(value)).toBe(`"'${value}"`);
  });

  it('escapes quotation marks inside potentially unsafe formulas', () => {
    expect(escapeCsvCell('="hello"')).toBe(`"'=""hello"""`);
  });
});

// Verify that multiple rows are combined into a complete CSV document.
describe('toCsv', () => {
  it('generates a complete CSV document', () => {
    expect(
      toCsv([
        ['Name', 'Role'],
        ['Alex', 'Student'],
        ['Taylor', 'Mentor'],
      ]),
    ).toBe('"Name","Role"\r\n"Alex","Student"\r\n"Taylor","Mentor"');
  });

  it('handles an empty document', () => {
    expect(toCsv([])).toBe('');
  });

  it('handles a document containing only headers', () => {
    expect(toCsv([['Name', 'Role']])).toBe('"Name","Role"');
  });

  it('handles mixed cell types', () => {
    expect(
      toCsv([
        ['Name', 'Hours', 'Active', 'Experience'],
        ['Alex', 12.5, true, null],
      ]),
    ).toBe('"Name","Hours","Active","Experience"\r\n"Alex","12.5","true",""');
  });

  it('supports readonly arrays', () => {
    const rows = [
      ['Name', 'Role'],
      ['Alex', 'Student'],
    ] as const;

    expect(toCsv(rows)).toBe('"Name","Role"\r\n"Alex","Student"');
  });

  it('does not modify the original data', () => {
    const rows = [
      ['Name', 'Role'],
      ['=1+1', 'Student'],
    ];

    toCsv(rows);

    expect(rows).toEqual([
      ['Name', 'Role'],
      ['=1+1', 'Student'],
    ]);
  });

  it('protects every cell against spreadsheet formulas', () => {
    expect(
      toCsv([
        ['=1+1', '@SUM(A1:A2)'],
        ['+123', '-123'],
      ]),
    ).toBe(`"'=1+1","'@SUM(A1:A2)"\r\n"'+123","'-123"`);
  });
});

// Verify browser downloads without downloading real files during tests.
describe('downloadCsv', () => {
  const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');

  const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

  beforeEach(() => {
    // Fake timers let us test delayed URL cleanup immediately.
    jest.useFakeTimers();

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:test-csv'),
    });

    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();

    // Restore browser methods to avoid affecting other tests.
    if (originalCreate) {
      Object.defineProperty(URL, 'createObjectURL', originalCreate);
    } else {
      Reflect.deleteProperty(URL, 'createObjectURL');
    }

    if (originalRevoke) {
      Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
    } else {
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }

    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('creates a downloadable file', () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsv('roster.csv', '"Name"\r\n"Alex"');

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('uses the correct filename and temporary URL', () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('attendance-records.csv');
      expect(this.href).toBe('blob:test-csv');
      expect(document.body.contains(this)).toBe(true);
    });

    downloadCsv('attendance-records.csv', '"Member","Hours"');

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('creates a UTF-8 CSV blob with a byte-order mark', () => {
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const content = '"Name"\r\n"Alex"';

    downloadCsv('roster.csv', content);

    const createObjectURL = URL.createObjectURL as jest.Mock;
    const blob = createObjectURL.mock.calls[0][0] as Blob;

    expect(blob.type).toBe('text/csv;charset=utf-8;');

    // The UTF-8 byte-order mark adds three bytes.
    // This fixture contains only ASCII characters.
    expect(blob.size).toBe(content.length + 3);
  });

  it('removes the temporary download link', () => {
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsv('roster.csv', '"Name"\r\n"Alex"');

    expect(document.querySelector('a[download="roster.csv"]')).toBeNull();
  });

  it('releases the temporary URL after the download begins', () => {
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsv('roster.csv', '"Name"\r\n"Alex"');

    // The URL should remain available while the download starts.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-csv');
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('cleans up resources even when the download fails', () => {
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('Download failed');
    });

    expect(() => {
      downloadCsv('roster.csv', '"Name"\r\n"Alex"');
    }).toThrow('Download failed');

    expect(document.querySelector('a[download="roster.csv"]')).toBeNull();

    jest.runAllTimers();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-csv');
  });
});
