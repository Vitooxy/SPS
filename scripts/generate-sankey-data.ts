import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { parseExcelData } from '../src/lib/parse-data';

const [, , inputPath, outputPath = 'public/sankey-data.json'] = process.argv;
if (!inputPath) {
  console.error('Usage: pnpm generate:data -- <input.xlsx> [output.json]');
  process.exit(2);
}

const resolvedInput = path.resolve(inputPath);
const resolvedOutput = path.resolve(outputPath);
const workbook = XLSX.readFile(resolvedInput);
const data = parseExcelData(workbook);
fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
fs.writeFileSync(resolvedOutput, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  input: resolvedInput,
  output: resolvedOutput,
  items: data.items.length,
  nodes: data.nodes.length,
  itemLinks: data.itemLinks.length,
  primaryCodes: Object.values(data.categoryCodes).reduce((total, codes) => total + codes.length, 0),
}, null, 2));
