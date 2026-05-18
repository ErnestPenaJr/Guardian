// Minimal type declaration shim for the json2csv runtime package.
// json2csv has no first-party @types package, so we declare the
// subset of the API we actually use (the Parser class). Adding this
// resolves TS7016 noise that has plagued every route that imports
// the library (e.g. server/routes/my-notices.ts, server/routes/audit.ts).
declare module 'json2csv' {
  export interface ParserOptions<T = Record<string, unknown>> {
    fields?: Array<string | { label?: string; value: string | ((row: T) => unknown) }>;
    delimiter?: string;
    quote?: string;
    eol?: string;
    header?: boolean;
    defaultValue?: string;
    transforms?: unknown[];
  }

  export class Parser<T = Record<string, unknown>> {
    constructor(opts?: ParserOptions<T>);
    parse(data: T | T[]): string;
  }
}
