import os

FONT = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif'

ts = r"""// 印刷用HTML生成ユーティリティ（MUI非依存・純粋インラインスタイル）
// このファイルはMUI/Reactに依存しない純粋なTypeScript関数群です

const FONT = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif';

function esc(s: unknown): string {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtNum(n: number): string { return n.toLocaleString('ja-JP'); }
function fmtPrice(price?: number | null): string {
  if (!price) return '';
  const man = Math.round(price / 10000);
  const oku = Math.floor(man / 10000);
  const rem = man % 10000;
  if (oku > 0 && rem === 0) return oku + '億円';
  if (oku > 0) return oku + '億' + rem.toLocaleString() + '万円';
  return man.toLocaleString() + '万円';
}
function fmtDate(s?: string | null): string {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0');
  } catch { return s; }
}
function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html.replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
}
function row(label: string, value: unknown): string {
  if (value == null) return '';
  const v = String(value).trim();
  if (!v) return '';
  return `<div style="display:flex;gap:4px;margin-bottom:2px;align-items:flex-start;"><span style="font-size:7pt;color:#444;min-width:68px;flex-shrink:0;line-height:1.3;">${esc(label)}</span><span style="font-size:7.5pt;color:#000;line-height:1.3;word-break:break-all;flex:1;white-space:pre-wrap;">${esc(v)}</span></div>`;
}
function sbox(title: string, content: string, bg = '#f5f5f5'): string {
  return `<div style="padding:4px 6px;background:${bg};border:1px solid #bbb;border-radius:3px;margin-bottom:6px;"><div style="font-size:7pt;font-weight:bold;color:#333;margin-bottom:2px;">${esc(title)}</div>${content}</div>`;
}
function hr(): string { return '<hr style="border:none;border-top:1px solid #ccc;margin:4px 0;"/>'; }

// ============================================================
// ページ1: 内覧準備資料
// ============================================================
export function generatePage1Html(buyer: Record<string,unknown>, property: Record<string,unknown>, today: string): string {
  const leftCol = `
    <div style="font-size:9pt;font-weight:bold;margin-bottom:4px;padding-bottom:2px;border-bottom:2px solid #000;">物件詳細カード</div>
    <div style="margin-bottom:6px;">
      ${row('物件番号',property.property_number)}${row('ステータス',property.atbb_status)}${row('配信日',fmtDate(property.distribution_date as string))}${row('種別',property.property_type)}${row('担当名',property.sales_assignee)}${row('確済',property.confirmation_status)}${row('構造',property.structure)}${row('間取り',property.floor_plan)}${property.land_area?row('土地面積',property.land_area+'m²'):''}${property.building_area?row('建物面積',property.building_area+'m²'):''}
    </div>
    ${hr()}
    <div style="margin-bottom:6px;">
      ${row('所在地',property.address)}${row('住居表示',property.display_address)}${row('Google Map',property.google_map_url)}${row('Suumo',property.suumo_url)}
    </div>
    ${hr()}
    <div style="margin-bottom:6px;">
      ${(property.price||property.listing_price)?row('価格',fmtPrice((property.price||property.listing_price) as number)):''}${property.monthly_loan_payment?row('月々ローン',fmtPrice(property.monthly_loan_payment as number)):''}${row('買付有無',property.offer_status)}${row('値下げ履歴',property.price_reduction_history)}${row('売却理由',property.sale_reason)}
    </div>
    ${property.pre_viewing_notes?sbox('内覧前伝達事項',`<div style="font-size:7pt;white-space:pre-wrap;line-height:1.3;">${esc(property.pre_viewing_notes as string)}</div>`):''}
    ${(property.viewing_key||property.viewing_parking||property.viewing_notes||property.viewing_available_date)?sbox('内覧情報',row('鍵等',property.viewing_key)+row('駐車場',property.viewing_parking)+row('伝達事項',property.viewing_notes)+row('内覧可能日',property.viewing_available_date),'#f0f0f0'):''}
    ${(property.seller_name||property.seller_contact||property.seller_email)?sbox('売主情報',row('売主名',property.seller_name)+row('連絡先',property.seller_contact)+row('メール',property.seller_email),'#f8f8f8'):''}
    ${property.broker_response?sbox('業者対応日',`<div style="font-size:7pt;">${esc(String(property.broker_response))}</div>`,'#f0f0f0'):''}
  `;
  const rightCol = `
    <div style="font-size:9pt;font-weight:bold;margin-bottom:4px;padding-bottom:2px;border-bottom:2px solid #000;">問合せ内容</div>
    <div style="margin-bottom:6px;">
      <div style="font-size:8pt;font-weight:bold;border-bottom:1px solid #ccc;margin-bottom:3px;padding-bottom:2px;">基本情報</div>
      ${row('氏名・会社名',buyer.name)}${row('電話番号',buyer.phone_number)}${row('メール',buyer.email)}${row('法人名',buyer.company_name)}${row('業者問合せ',buyer.broker_inquiry)}
    </div>
    ${hr()}
    <div style="margin-bottom:6px;">
      <div style="font-size:8pt;font-weight:bold;border-bottom:1px solid #ccc;margin-bottom:3px;padding-bottom:2px;">問合せ情報</div>
      ${row('受付日',fmtDate(buyer.reception_date as string))}${row('問合せ元',buyer.inquiry_source)}${row('初動担当',buyer.initial_assignee)}${row('最新状況',buyer.latest_status)}${row('案件担当',buyer.project_assignee)}${row('次電日',fmtDate(buyer.next_call_date as string))}
    </div>
    ${buyer.inquiry_hearing?sbox('問合時ヒアリング',`<div style="font-size:7pt;white-space:pre-wrap;line-height:1.3;">${esc(stripHtml(buyer.inquiry_hearing as string))}</div>`):''}
    ${hr()}
    <div style="margin-bottom:6px;">
      <div style="font-size:8pt;font-weight:bold;border-bottom:1px solid #ccc;margin-bottom:3px;padding-bottom:2px;">対応状況</div>
      ${row('電話対応',buyer.inquiry_email_phone)}${row('メール返信',buyer.inquiry_email_reply)}${row('3回架電確認',buyer.three_calls_confirmed)}${row('近隣物件メール',buyer.neighbor_property_email_sent)}${row('配信メール',buyer.distribution_type)}${row('Pinrich',buyer.pinrich)}
    </div>
    ${buyer.vendor_survey?row('業者向けアンケート',buyer.vendor_survey):''}
    ${buyer.viewing_survey_result?sbox('内覧アンケート内容',`<div style="font-size:7pt;white-space:pre-wrap;line-height:1.3;">${esc(buyer.viewing_survey_result as string)}</div>`):''}
    ${(buyer.owned_home_hearing_inquiry||buyer.owned_home_hearing_result)?row('持家ヒアリング',buyer.owned_home_hearing_inquiry)+row('ヒアリング結果',buyer.owned_home_hearing_result):''}
    ${buyer.valuation_required?row('要査定',buyer.valuation_required):''}
    ${buyer.message_to_assignee?sbox('担当への確認事項',`<div style="font-size:7pt;white-space:pre-wrap;line-height:1.3;">${esc(stripHtml(buyer.message_to_assignee as string))}</div>`,'#f0f0f0'):''}
  `;
  return `<div style="width:210mm;min-height:297mm;padding:8mm 10mm;background:#fff;font-family:${FONT};font-size:8pt;color:#000;box-sizing:border-box;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid #000;">
      <span style="font-size:11pt;font-weight:bold;">内覧準備資料</span>
      <div style="text-align:right;"><div style="font-size:7.5pt;color:#444;">作成日: ${esc(today)}</div>${buyer.buyer_number?`<div style="font-size:7.5pt;color:#444;">買主番号: ${esc(buyer.buyer_number as string)}</div>`:''}</div>
    </div>
    <div style="display:flex;gap:8px;">
      <div style="flex:1;padding-right:8px;border-right:1px solid #ccc;">${leftCol}</div>
      <div style="flex:1;padding-left:8px;">${rightCol}</div>
    </div>
    <div style="margin-top:6px;padding-top:4px;border-top:1px solid #ccc;display:flex;justify-content:space-between;">
      <span style="font-size:7pt;color:#666;">内覧準備資料 - 社内管理システム</span>
      <span style="font-size:7pt;color:#666;">${esc(today)}</span>
    </div>
  </div>`;
}
"""

with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'w', encoding='utf-8') as f:
    f.write(ts)
print('Part1 done, chars:', len(ts))
