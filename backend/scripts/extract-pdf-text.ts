/**
 * 福岡市 R8（2026年4月1日）通学区域PDF テキスト抽出テスト
 * pdf-parse を使用（有料API不使用）
 */
import * as fs from 'fs';
import * as path from 'path';

async function extractText(filePath: string, label: string) {
  const { PDFParse } = require('pdf-parse');
  const buffer = fs.readFileSync(filePath);
  
  console.log(`\n=== ${label} ===`);
  try {
    const parser = new PDFParse();
    const data = await parser.parse(buffer);
    const text = data.text || (data.pages ? data.pages.map((p: any) => p.text).join('\n') : '');
    console.log(`ページ数: ${data.numpages || data.pages?.length || '?'}`);
    console.log(`テキスト長: ${text.length} 文字`);
    console.log('\n--- 先頭2000文字 ---');
    console.log(text.slice(0, 2000));
    
    // ファイルに保存
    const outPath = filePath.replace('.pdf', '.txt');
    fs.writeFileSync(outPath, text, 'utf-8');
    console.log(`\nテキストを保存: ${outPath}`);
    return text;
  } catch (e: any) {
    console.error(`エラー: ${e.message}`);
    return '';
  }
}

async function main() {
  const dir = path.resolve(__dirname, '../tmp-pdf');
  await extractText(path.join(dir, 'R8gakkoubetu.pdf'), '学校別通学区域一覧 (R8)');
  await extractText(path.join(dir, 'R8choumeibetu.pdf'), '町名別通学区域一覧 (R8)');
}

main().catch(console.error);
