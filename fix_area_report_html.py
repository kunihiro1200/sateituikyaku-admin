# encoding: utf-8
with open('backend/src/routes/sellers.ts', 'rb') as f:
    text = f.read().decode('utf-8')

old = """    const completion = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    let htmlContent = completion.data.choices[0]?.message?.content || '';

    // AIがMarkdownコードブロックで囲んで返した場合は除去
    htmlContent = htmlContent.replace(/^```(?:html)?\\s*/i, '').replace(/\\s*```\\s*$/i, '').trim();

    // 矢印を統一（🔻→▼、🔺→↑）
    htmlContent = htmlContent
      .replace(/🔻/g, '▼')
      .replace(/🔺/g, '↑')
      .replace(/⬆/g, '↑')
      .replace(/⬇/g, '▼');

    // AIがHTMLエンティティで矢印を出力した場合、Unicode文字に変換
    htmlContent = htmlContent.replace(/&uarr;|&#8593;|&#x2191;/gi, '↑');
    htmlContent = htmlContent.replace(/&darr;|&#8595;|&#x2193;/gi, '↓');
    htmlContent = htmlContent.replace(/&#9660;|&#x25BC;/gi, '▼');
    htmlContent = htmlContent.replace(/&#9650;|&#x25B2;/gi, '▲');

    // 印刷時に背景色・文字色が消えないようにCSSを先頭に注入
    const printCss = `<style>
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  body { margin: 0; font-family: 'Hiragino Kaku Gothic ProN','Meiryo',sans-serif; }
  @page { size: A4; margin: 15mm; }
}
</style>`;
    htmlContent = printCss + htmlContent;

    res.json({
      html: htmlContent,
      areaName: detailArea,
      cityLabel: cityLabel,
      generatedAt: new Date().toISOString(),
    });"""

if old not in text:
    # 部分一致で探す
    idx = text.find("const completion = await axios.post(")
    print(f"Found at: {idx}")
    print(repr(text[idx:idx+100]))
else:
    print("Found exact match")

# 別のアプローチ：OpenAI呼び出し部分を探して置換
idx_start = text.find("    const completion = await axios.post(")
idx_end = text.find("    res.json({", idx_start)
idx_end2 = text.find("    });", idx_end) + len("    });")

print(f"start: {idx_start}, end: {idx_end2}")
print("Current block:")
print(repr(text[idx_start:idx_end2]))
