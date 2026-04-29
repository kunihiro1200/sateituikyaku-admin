# encoding: utf-8
with open('backend/src/routes/sellers.ts', 'rb') as f:
    text = f.read().decode('utf-8')

idx_start = text.find("    const completion = await axios.post(")
idx_end = text.find("    });", text.find("    res.json({", idx_start)) + len("    });")

new_block = r"""    const completion = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: jsonPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const raw = completion.data.choices[0]?.message?.content || '{}';
    let data: any;
    try { data = JSON.parse(raw); } catch { data = {}; }

    // HTMLをサーバー側で組み立て（ラベルはコードで完全制御）
    const CL = cityLabel + '全体';  // 例: 「別府市全体」
    const AL = detailArea + 'エリア'; // 例: 「石垣東エリア」

    const thStyle = 'border:1px solid #90caf9;padding:6px 10px;text-align:center;';
    const tdStyle = 'border:1px solid #ccc;padding:5px 10px;text-align:center;';
    const tdAreaStyle = 'border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;';

    const arrow = (cur: number, prev: number | null) => {
      if (prev === null) return '';
      if (cur > prev) return ' <span style="color:#c62828;font-weight:bold;">↑</span>';
      if (cur < prev) return ' <span style="color:#e53935;">▼</span>';
      return '';
    };

    // ① 人口の推移
    const pop = data.population || [];
    const popRows = pop.map((r: any, i: number) => {
      const prevCity = i > 0 ? pop[i-1].city : null;
      const prevArea = i > 0 ? pop[i-1].area : null;
      const bold = i === pop.length - 1 ? 'font-weight:bold;' : '';
      return `<tr><td style="${tdStyle}${bold}">${r.year}</td><td style="${tdStyle}${bold}">${Number(r.city).toLocaleString()}人${arrow(r.city, prevCity)}</td><td style="${tdAreaStyle}${bold}">${Number(r.area).toLocaleString()}人${arrow(r.area, prevArea)}</td></tr>`;
    }).join('');

    // ② 世帯種類
    const hh = data.household || [];
    const hhRows = hh.map((r: any) =>
      `<tr><td style="${tdStyle}">${r.type}</td><td style="${tdStyle}">${r.city}</td><td style="${tdAreaStyle}">${r.area}</td></tr>`
    ).join('');

    // ③ 取引件数
    const tr = data.transactions || [];
    const trRows = tr.map((r: any, i: number) => {
      const prevCity = i > 0 ? tr[i-1].city : null;
      const prevArea = i > 0 ? tr[i-1].area : null;
      const bold = i === tr.length - 1 ? 'font-weight:bold;' : '';
      return `<tr><td style="${tdStyle}${bold}">${r.year}</td><td style="${tdStyle}${bold}">${Number(r.city).toLocaleString()}件${arrow(r.city, prevCity)}</td><td style="${tdAreaStyle}${bold}">${Number(r.area).toLocaleString()}件${arrow(r.area, prevArea)}</td></tr>`;
    }).join('');

    // ④ 不動産価格
    const pr = data.prices || [];
    const prRows = pr.map((r: any, i: number) => {
      const prevCity = i > 0 ? pr[i-1].city : null;
      const prevArea = i > 0 ? pr[i-1].area : null;
      const bold = i === pr.length - 1 ? 'font-weight:bold;' : '';
      return `<tr><td style="${tdStyle}${bold}">${r.year}</td><td style="${tdStyle}${bold}">${Number(r.city).toLocaleString()}万円${arrow(r.city, prevCity)}</td><td style="${tdAreaStyle}${bold}">${Number(r.area).toLocaleString()}万円${arrow(r.area, prevArea)}</td></tr>`;
    }).join('');

    // ⑤ まとめ
    const summary = (data.summary || []).map((s: string) =>
      `<li style="margin-bottom:8px;"><strong style="color:#c62828;">${s}</strong></li>`
    ).join('');

    const sectionTitle = (num: string, title: string) =>
      `<h2 style="font-size:15px;color:#1a237e;border-left:4px solid #1a237e;padding-left:8px;margin-bottom:10px;">${num} ${title}</h2>`;

    const compTable = (rows: string) =>
      `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <thead><tr style="background:#e3f2fd;">
          <th style="${thStyle}width:20%">年</th>
          <th style="${thStyle}width:40%">${CL}</th>
          <th style="${thStyle}width:40%;background:#fff9c4">${AL}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    const hhTable =
      `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <thead><tr style="background:#e3f2fd;">
          <th style="${thStyle}width:20%">世帯種類</th>
          <th style="${thStyle}width:40%">${CL}</th>
          <th style="${thStyle}width:40%;background:#fff9c4">${AL}</th>
        </tr></thead>
        <tbody>${hhRows}</tbody>
      </table>`;

    const comment = (text: string) =>
      `<p style="font-size:11px;color:#555;background:#f5f5f5;padding:6px 10px;border-radius:4px;">📊 <strong>分析：</strong>${text}</p>`;

    const today2 = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

    const htmlContent = `<style>
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @page { size: A4; margin: 15mm; }
}
</style>
<div style="font-family:'Hiragino Kaku Gothic ProN','Meiryo',sans-serif;font-size:12px;color:#333;max-width:800px;margin:0 auto;padding:20px;">
  <div style="text-align:center;border-bottom:3px solid #1a237e;padding-bottom:12px;margin-bottom:20px;">
    <div style="font-size:10px;color:#666;margin-bottom:4px;">不動産売却のご参考資料</div>
    <h1 style="font-size:20px;color:#1a237e;margin:0 0 4px;">エリア情勢レポート</h1>
    <div style="font-size:14px;font-weight:bold;">${AL}</div>
    <div style="font-size:10px;color:#888;margin-top:4px;">作成日：${today2}　物件種別：${propertyType || '不動産'}</div>
  </div>
  <div style="margin-bottom:24px;">${sectionTitle('①', '人口の推移')}${compTable(popRows)}${comment(data.populationComment || '')}</div>
  <div style="margin-bottom:24px;">${sectionTitle('②', '世帯種類の推移')}${hhTable}${comment(data.householdComment || '')}</div>
  <div style="margin-bottom:24px;">${sectionTitle('③', '物件種別の取引件数推移')}${compTable(trRows)}${comment(data.transactionsComment || '')}</div>
  <div style="margin-bottom:24px;">${sectionTitle('④', '不動産価格の推移（坪単価・万円）')}${compTable(prRows)}${comment(data.pricesComment || '')}</div>
  <div style="margin-bottom:24px;background:#fffde7;border:2px solid #f9a825;border-radius:8px;padding:16px;">
    <h2 style="font-size:15px;color:#e65100;border-left:4px solid #e65100;padding-left:8px;margin-bottom:12px;">⑤ まとめ ── ${AL}で今が売却のチャンスである理由</h2>
    <ul style="margin:0;padding-left:20px;line-height:2;">${summary}</ul>
    <div style="margin-top:12px;text-align:center;background:#e65100;color:white;padding:8px;border-radius:4px;font-size:13px;font-weight:bold;">✅ ${AL}のデータが示す通り、今が最も有利な売却タイミングです</div>
  </div>
  <div style="border-top:1px solid #ccc;padding-top:8px;font-size:10px;color:#999;text-align:center;">※本レポートの数値は市場動向に基づく概算値です。実際の取引価格は個別物件の状況により異なります。</div>
</div>`;

    res.json({
      html: htmlContent,
      areaName: detailArea,
      cityLabel: cityLabel,
      generatedAt: new Date().toISOString(),
    });"""

new_text = text[:idx_start] + new_block + text[idx_end:]
with open('backend/src/routes/sellers.ts', 'wb') as f:
    f.write(new_text.encode('utf-8'))
print(f'Done! Replaced {idx_end - idx_start} chars with {len(new_block)} chars.')
