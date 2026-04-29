# encoding: utf-8
with open('backend/src/routes/sellers.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 古いサンプルHTMLの開始と終了を特定して置換
old_html_start = '''  return `
<div style="font-family:\'Hiragino Kaku Gothic ProN\',\'Meiryo\',sans-serif;font-size:12px;color:#333;max-width:800px;margin:0 auto;padding:20px;">

  <!-- ヘッダー -->
  <div style="text-align:center;border-bottom:3px solid #1a237e;padding-bottom:12px;margin-bottom:20px;">
    <div style="font-size:10px;color:#666;margin-bottom:4px;">不動産売却のご参考資料</div>
    <h1 style="font-size:20px;color:#1a237e;margin:0 0 4px;">エリア情勢レポート</h1>
    <div style="font-size:14px;font-weight:bold;color:#333;">${area} エリア</div>
    <div style="font-size:10px;color:#888;margin-top:4px;">作成日：${today}　　物件種別：${propertyType || \'不動産\'}</div>
    <div style="display:inline-block;background:#fff3e0;border:1px solid #ff9800;border-radius:4px;padding:3px 10px;font-size:10px;color:#e65100;margin-top:6px;">※ これはデモ表示です。APIキー設定後に実際のAI生成レポートが表示されます</div>
  </div>'''

# 終了マーカー
old_html_end = '''  <!-- フッター -->
  <div style="border-top:1px solid #ccc;padding-top:8px;font-size:10px;color:#999;text-align:center;">
    ※本レポートのデータは公開統計・市場動向に基づく概算値です。実際の取引価格は個別物件の状況により異なります。
  </div>
</div>`;
}'''

new_html = '''  return `
<div style="font-family:\'Hiragino Kaku Gothic ProN\',\'Meiryo\',sans-serif;font-size:12px;color:#333;max-width:800px;margin:0 auto;padding:20px;">

  <!-- ヘッダー -->
  <div style="text-align:center;border-bottom:3px solid #1a237e;padding-bottom:12px;margin-bottom:20px;">
    <div style="font-size:10px;color:#666;margin-bottom:4px;">不動産売却のご参考資料</div>
    <h1 style="font-size:20px;color:#1a237e;margin:0 0 4px;">エリア情勢レポート</h1>
    <div style="font-size:14px;font-weight:bold;color:#333;">${area} エリア</div>
    <div style="font-size:10px;color:#888;margin-top:4px;">作成日：${today}　　物件種別：${propertyType || \'不動産\'}</div>
    <div style="display:inline-block;background:#fff3e0;border:1px solid #ff9800;border-radius:4px;padding:3px 10px;font-size:10px;color:#e65100;margin-top:6px;">※ これはデモ表示です。APIキー設定後に実際のAI生成レポートが表示されます</div>
  </div>

  <!-- セクション1: 人口の推移 -->
  <div style="margin-bottom:24px;">
    <h2 style="font-size:15px;color:#1a237e;border-left:4px solid #1a237e;padding-left:8px;margin-bottom:10px;">① 人口の推移</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <thead>
        <tr style="background:#e3f2fd;">
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;">年</th>
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;">${cityName}全体</th>
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;background:#fff9c4;">${area}エリア</th>
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;">市全体比</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">2015年</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">482,000</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;">8,420</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">—</td></tr>
        <tr style="background:#f9f9f9;"><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">2018年</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">478,500</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;">8,380</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;color:#e53935;">▼ 0.5%</td></tr>
        <tr><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">2021年</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">471,200</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;">8,310</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;color:#e53935;">▼ 0.8%</td></tr>
        <tr style="background:#f9f9f9;"><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;font-weight:bold;">2024年（推計）</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;font-weight:bold;">463,000</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;font-weight:bold;background:#fff9c4;">8,250</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;color:#1565c0;font-weight:bold;">市平均より緩やか</td></tr>
      </tbody>
    </table>
    <p style="font-size:11px;color:#555;background:#f5f5f5;padding:6px 10px;border-radius:4px;">📊 <strong>分析：</strong>${cityName}全体では人口減少が続く中、<strong>${area}エリアは利便性から減少幅が市平均より小さく</strong>、安定した居住需要が続いています。</p>
  </div>

  <!-- セクション2: 世帯種類の推移 -->
  <div style="margin-bottom:24px;">
    <h2 style="font-size:15px;color:#1a237e;border-left:4px solid #1a237e;padding-left:8px;margin-bottom:10px;">② 世帯種類の推移</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <thead>
        <tr style="background:#e3f2fd;">
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;">世帯種類</th>
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;">${cityName}全体（2024）</th>
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;background:#fff9c4;">${area}エリア（2024）</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="border:1px solid #ccc;padding:5px 10px;">単身世帯</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">37%</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;font-weight:bold;color:#1565c0;">42% ↑</td></tr>
        <tr style="background:#f9f9f9;"><td style="border:1px solid #ccc;padding:5px 10px;">夫婦のみ</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">25%</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;">26%</td></tr>
        <tr><td style="border:1px solid #ccc;padding:5px 10px;">核家族</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">29%</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;">24%</td></tr>
        <tr style="background:#f9f9f9;"><td style="border:1px solid #ccc;padding:5px 10px;">三世代同居</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">9%</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;">8%</td></tr>
      </tbody>
    </table>
    <p style="font-size:11px;color:#555;background:#f5f5f5;padding:6px 10px;border-radius:4px;">📊 <strong>分析：</strong>${area}エリアは市全体より単身・夫婦世帯の割合が高く、<strong>利便性を重視する買い手層が厚い</strong>エリアです。</p>
  </div>

  <!-- セクション3: 物件種別の取引件数推移 -->
  <div style="margin-bottom:24px;">
    <h2 style="font-size:15px;color:#1a237e;border-left:4px solid #1a237e;padding-left:8px;margin-bottom:10px;">③ 物件種別の取引件数推移</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <thead>
        <tr style="background:#e3f2fd;">
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;">年</th>
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;">${cityName}全体（件）</th>
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;background:#fff9c4;">${area}エリア（件）</th>
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;">エリア占有率</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">2020年</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">555</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;">38</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">6.8%</td></tr>
        <tr style="background:#f9f9f9;"><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">2021年</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">585</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;">42</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">7.2%</td></tr>
        <tr><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">2022年</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">621</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;">47</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">7.6%</td></tr>
        <tr style="background:#f9f9f9;"><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">2023年</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">648</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;">51</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">7.9%</td></tr>
        <tr><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;font-weight:bold;">2024年（推計）</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;font-weight:bold;">676</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;font-weight:bold;background:#fff9c4;color:#c62828;">55 ↑</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;font-weight:bold;color:#c62828;">8.1%（上昇中）</td></tr>
      </tbody>
    </table>
    <p style="font-size:11px;color:#555;background:#f5f5f5;padding:6px 10px;border-radius:4px;">📊 <strong>分析：</strong>${area}エリアの市場占有率は年々上昇しており、<strong>市全体の成長を上回るペースで取引が活発化</strong>しています。</p>
  </div>

  <!-- セクション4: 不動産価格の推移 -->
  <div style="margin-bottom:24px;">
    <h2 style="font-size:15px;color:#1a237e;border-left:4px solid #1a237e;padding-left:8px;margin-bottom:10px;">④ 不動産価格の推移（坪単価・万円）</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <thead>
        <tr style="background:#e3f2fd;">
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;">年</th>
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;">${cityName}全体（万円/坪）</th>
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;background:#fff9c4;">${area}エリア（万円/坪）</th>
          <th style="border:1px solid #90caf9;padding:6px 10px;text-align:center;">エリアプレミアム</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">2020年</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">22.1</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;">28.5</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;color:#1565c0;">+29%</td></tr>
        <tr style="background:#f9f9f9;"><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">2021年</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">23.4</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;">30.2</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;color:#1565c0;">+29%</td></tr>
        <tr><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">2022年</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">25.0</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;">32.8</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;color:#1565c0;">+31%</td></tr>
        <tr style="background:#f9f9f9;"><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">2023年</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;">26.8</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;">35.1</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;color:#1565c0;">+31%</td></tr>
        <tr><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;font-weight:bold;">2024年（推計）</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;font-weight:bold;">28.2</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;font-weight:bold;background:#fff9c4;color:#c62828;">37.4 ↑</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:center;font-weight:bold;color:#c62828;">+33%（拡大中）</td></tr>
      </tbody>
    </table>
    <p style="font-size:11px;color:#555;background:#f5f5f5;padding:6px 10px;border-radius:4px;">📊 <strong>分析：</strong>${area}エリアは${cityName}全体より約30%高い価格水準を維持しており、<strong>そのプレミアムは年々拡大しています</strong>。</p>
  </div>

  <!-- セクション5: まとめ -->
  <div style="margin-bottom:24px;background:#fffde7;border:2px solid #f9a825;border-radius:8px;padding:16px;">
    <h2 style="font-size:15px;color:#e65100;border-left:4px solid #e65100;padding-left:8px;margin-bottom:12px;">⑤ まとめ ── ${area}エリアで今が売却のチャンスである理由</h2>
    <ul style="margin:0;padding-left:20px;line-height:2;">
      <li style="margin-bottom:6px;"><strong style="color:#c62828;">市全体より30%高い価格水準</strong>：${area}エリアは${cityName}全体と比べて坪単価が約30%高く、そのプレミアムは拡大傾向にあります。</li>
      <li style="margin-bottom:6px;"><strong style="color:#c62828;">取引件数が市平均を上回る伸び</strong>：エリアの市場占有率が年々上昇しており、買い手の需要が特に旺盛です。</li>
      <li style="margin-bottom:6px;"><strong style="color:#c62828;">人口減少が市平均より緩やか</strong>：利便性の高さから居住需要が安定しており、今後も買い手が見つかりやすい環境です。</li>
      <li style="margin-bottom:6px;"><strong style="color:#c62828;">単身・夫婦世帯の厚い需要層</strong>：市全体より単身・夫婦世帯の割合が高く、幅広い購入希望者へのアプローチが可能です。</li>
      <li><strong style="color:#c62828;">価格上昇のピーク水準</strong>：2020年比で約30%の価格上昇。今後の市場変動リスクを考えると、現在が最も有利な売却タイミングです。</li>
    </ul>
    <div style="margin-top:12px;text-align:center;background:#e65100;color:white;padding:8px;border-radius:4px;font-size:13px;font-weight:bold;">
      ✅ ${area}エリアのデータが示す通り、今が最も有利な売却タイミングです
    </div>
  </div>

  <!-- フッター -->
  <div style="border-top:1px solid #ccc;padding-top:8px;font-size:10px;color:#999;text-align:center;">
    ※本レポートの数値は市場動向に基づく概算値です。実際の取引価格は個別物件の状況により異なります。
  </div>
</div>`;
}'''

# 古いHTMLブロックを探して置換
start_idx = text.find(old_html_start)
end_idx = text.find(old_html_end)

if start_idx == -1:
    print('ERROR: start marker not found')
elif end_idx == -1:
    print('ERROR: end marker not found')
else:
    end_idx += len(old_html_end)
    new_text = text[:start_idx] + new_html + text[end_idx:]
    with open('backend/src/routes/sellers.ts', 'wb') as f:
        f.write(new_text.encode('utf-8'))
    print('Done! Replaced successfully.')
