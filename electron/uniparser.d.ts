declare module 'uniparser' {
  export function autoParse(filePath: string): Promise<string>;
  export function parsePDF(filePath: string): Promise<string>;
  export function parseDOCX(filePath: string): Promise<string>;
  export function parseTXT(filePath: string): string;
  export function parseHTML(filePath: string): string;
  export function parseMarkdown(filePath: string): string;
}
