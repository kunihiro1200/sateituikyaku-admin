ts = r"""
// ============================================================
// ページ5: リフォーム概算表
// ============================================================
export function generatePage5Html(): string {
  const td = 'border:1px solid #000;padding:3px 6px;font-size:8.5pt;';
  const catTd = 'border:1px solid #000;padding:3px 6px;font-size:9pt;text-align:center;vertical-align:middle;';
  function reformRows(rows: Array<{cat?:string;catRows?:number;item:string;price:string;notes:string[]}>): string {
    return rows.map(r=>{
      const catCell = r.cat!=null
        ? `<td style="${catTd}" rowspan="${r.catRows||1}">${r.cat}</td>`
        : '';
      const noteHtml = r.notes.map(n=>`<div>${n}</div>`).join('');
      return `<tr>${catCell}<td style="${td}">${r.item}</td><td style="${td};text-align:center;font-weight:bold;">${r.price}</td><td style="${td};font-size:8pt;">${noteHtml}</td></tr>`;
    }).join('');
  }
  const manRows = reformRows([
    {cat:'水回り',catRows:4,item:'●キッチン交換',price:'170万円',notes:[]},
    {item:'●ユニットバス→ユニットバス交換',price:'170万円',notes:[]},
    {item:'●洗面台交換',price:'20万円',notes:['クッションフロア張替（+3万）','壁紙張替（+4万）']},
    {item:'●トイレ交換',price:'25万円',notes:['クッションフロア張替（+2万）','壁紙張替（+3万）']},
    {cat:'居室',catRows:3,item:'●和室→洋室',price:'70万円（6帖）',notes:['畳→フローリング','押入→クローゼット','壁紙張替']},
    {item:'●床上貼り',price:'90万円（30坪）',notes:['フローリング']},
    {item:'●壁紙張替',price:'70万円（30坪）',notes:['全室','普及品']},
    {cat:'他',catRows:1,item:'●内窓設置',price:'20万円',notes:['掃出し1箇所']},
  ]);
  const koRows = reformRows([
    {cat:'水回り',catRows:5,item:'●キッチン交換',price:'170万円',notes:[]},
    {item:'●ユニットバス→ユニットバス交換',price:'170万円',notes:[]},
    {item:'●ユニットバス以外→ユニットバス変更',price:'200万円',notes:['例）タイル張浴室→ユニットバス']},
    {item:'●洗面台交換',price:'20万円',notes:['クッションフロア張替（+3万）','壁紙張替（+4万）']},
    {item:'●トイレ交換',price:'25万円',notes:['クッションフロア張替（+2万）','壁紙張替（+3万）']},
    {cat:'居室',catRows:3,item:'●和室→洋室',price:'80万円',notes:['畳→フローリング','押入→クローゼット','壁紙張替']},
    {item:'●床上貼り',price:'90万円（30坪）',notes:['フローリング']},
    {item:'●壁紙張替',price:'120万円（30坪）',notes:['全室','普及品']},
    {cat:'他',catRows:8,item:'●外壁塗装',price:'140万円（30坪2階建）',notes:['シリコン塗装','耐用年数約15年','普及品']},
    {item:'●屋根塗装',price:'40万円',notes:['シリコン塗装','耐用年数約15年','普及品']},
    {item:'●屋根葺替え（ガルテクト 耐用年数20年）',price:'140万円',notes:['陶器瓦（+50万 耐用年数50年以上）']},
    {item:'●足場設置',price:'23万円',notes:['※外壁、屋根工事に必要']},
    {item:'●サッシ取替',price:'30万円',notes:['掃出し1箇所','※外壁補修費用込み']},
    {item:'●内窓設置',price:'20万円',notes:['掃出し1箇所']},
    {item:'●庭→駐車場',price:'70万円',notes:['1台分']},
    {item:'●オール電化工事',price:'100万円',notes:['エコキュート370L','IH取付']},
  ]);
  return `<div style="width:210mm;min-height:297mm;padding:12mm 15mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;">
    <div style="font-size:11pt;font-weight:bold;text-align:center;margin-bottom:8px;">マンションリフォーム概算表【税抜価格】</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${manRows}</table>
    <div style="font-size:11pt;font-weight:bold;text-align:center;margin-bottom:8px;">戸建リフォーム概算表【税抜価格】</div>
    <table style="width:100%;border-collapse:collapse;">${koRows}</table>
    <div style="text-align:right;margin-top:8px;font-size:8pt;color:#666;">last</div>
  </div>`;
}

// ============================================================
// 全ページ結合
// ============================================================
export function generateAllPagesHtml(buyer: Record<string,unknown>, propertyDetails: Record<string,unknown>[], today: string): string {
  const pages: string[] = [];
  for (const property of propertyDetails) {
    const addr = (property.display_address || property.address || '') as string;
    const price = (property.price || property.listing_price || null) as number | null;
    const ptype = property.property_type as string | undefined;
    pages.push(generatePage1Html(buyer, property, today));
    pages.push(generatePage2Html(addr, price));
    pages.push(generatePage3Html(addr));
    pages.push(generatePage4Html(addr, price, ptype, today));
    pages.push(generatePage5Html());
  }
  const pagesHtml = pages.map((p,i)=>`<div class="page" style="${i===pages.length-1?'page-break-after:auto;break-after:auto;':''}">${p}</div>`).join('');
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  @page{size:A4 portrait;margin:0;}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  body{margin:0;padding:0;font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif;}
  .page{width:210mm;min-height:297mm;background:white;page-break-after:always;break-after:page;}
</style>
</head>
<body>${pagesHtml}</body>
</html>`;
}
"""
with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'a', encoding='utf-8') as f:
    f.write(ts)
print('Part5+all done')
