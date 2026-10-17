// ESM script for PDF text extraction using pdfjs-dist
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.resolve(__dirname, '../tmp-pdf');

async function extractText(pdfPath) {
  // Load pdfjs-dist from the correct legacy path
  const pdfjsPath = new URL('../node_modules/pdfjs-dist/legacy/pdf.mjs', import.meta.url);
  const pdfjs = await import(pdfjsPath.href);
  const data = new Uint8Array(readFileSync(pdfPath));
  
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  console.log(`Pages: ${doc.numPages}`);
  
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map(item => item.str)
      .join(' ');
    text += pageText + '\n';
  }
  return text;
}

const files = ['R8gakkoubetu.pdf', 'R8choumeibetu.pdf'];

for (const file of files) {
  console.log(`\n=== Processing ${file} ===`);
  const filePath = path.join(tmpDir, file);
  try {
    const text = await extractText(filePath);
    const outPath = filePath.replace('.pdf', '.txt');
    writeFileSync(outPath, text, 'utf-8');
    console.log(`Saved ${text.length} chars to ${outPath}`);
    console.log('First 500 chars:', text.slice(0, 500));
  } catch (e) {
    console.error('Error:', e.message);
  }
}
