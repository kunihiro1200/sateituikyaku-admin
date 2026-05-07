// 印刷用HTML生成ユーティリティ（MUI非依存・純粋インラインスタイル）
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
  return `<div style="width:100%;height:100%;padding:8mm 10mm;background:#fff;font-family:${FONT};font-size:8pt;color:#000;box-sizing:border-box;overflow:hidden;">
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

// ============================================================
// 内覧準備資料２: 挨拶状（いふうスタイル）
// ============================================================
export function generateViewingPrep2Html(buyer: Record<string,unknown>, today: string): string {
  // 買主名に「様」を付ける（既に「様」で終わっている場合はダブらないようにする）
  const rawName = (buyer.name as string) || '';
  const nameWithSama = rawName
    ? (rawName.endsWith('様') ? rawName : rawName + '様')
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=794px">
<style>
  @page{size:A4 portrait;margin:0;}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  html{font-size:16px;}
  body{margin:0;padding:0;font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif;}
  .page{width:794px;min-height:1123px;background:white;overflow:hidden;}
  @media print{
    .page{width:210mm;height:297mm;min-height:unset;}
  }
</style>
</head>
<body>
<div class="page" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20mm 18mm;background:#fff;font-family:'Noto Sans JP','Hiragino Kaku Gothic ProN','Meiryo',sans-serif;color:#000;">

  <!-- 外枠ボーダー -->
  <div style="border:3px solid #f5c518;width:100%;padding:20mm 16mm;display:flex;flex-direction:column;align-items:center;gap:0;">

    <!-- ロゴエリア（左上） -->
    <div style="width:100%;display:flex;justify-content:flex-start;margin-bottom:8mm;">
      <div style="background:#f5c518;padding:6px 10px;font-size:14pt;font-weight:bold;letter-spacing:0.1em;color:#000;border:2px solid #000;">
        IFOO
      </div>
    </div>

    <!-- 買主名 -->
    <div style="width:100%;text-align:center;margin-bottom:10mm;">
      <span style="font-size:22pt;font-weight:bold;letter-spacing:0.05em;">${esc(nameWithSama)}</span>
    </div>

    <!-- 区切り線 -->
    <div style="width:100%;border-bottom:1px solid #000;margin-bottom:10mm;"></div>

    <!-- メインメッセージ -->
    <div style="width:100%;text-align:center;margin-bottom:12mm;">
      <div style="font-size:14pt;font-weight:bold;line-height:1.8;">本日は貴重なお時間いただきまして</div>
      <div style="font-size:14pt;font-weight:bold;line-height:1.8;">誠にありがとうございます</div>
    </div>

    <!-- キャラクターと本文エリア -->
    <div style="width:100%;display:flex;align-items:flex-start;gap:12mm;margin-bottom:12mm;">

      <!-- 左：吹き出しエリア -->
      <div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:4mm;">
        <!-- 吹き出し -->
        <div style="background:#f5c518;border-radius:12px;padding:8px 14px;font-size:10pt;font-weight:bold;text-align:center;position:relative;white-space:nowrap;">
          いふうなら<br>安心です！
          <!-- 吹き出し三角 -->
          <div style="position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid #f5c518;"></div>
        </div>
        <!-- キャラクター（テキスト代替） -->
        <div style="margin-top:12px;font-size:28pt;text-align:center;">👩</div>
      </div>

      <!-- 右：本文 -->
      <div style="flex:1;font-size:11pt;line-height:2.0;text-align:center;">
        <div>大分市・別府市の不動産購入は</div>
        <div>いふうにおまかせください！</div>
        <div style="margin-top:4mm;font-size:10pt;line-height:1.8;">「資金計画」や「現地見学」「売買契約」など、</div>
        <div style="font-size:10pt;line-height:1.8;">お住まい購入時の流れやポイントを</div>
        <div style="font-size:10pt;line-height:1.8;">丁寧にご説明いたします</div>
        <div style="font-size:10pt;line-height:1.8;">お気軽にご相談ください！</div>
      </div>

      <!-- 右上：家のアイコン -->
      <div style="flex:0 0 auto;font-size:36pt;color:#f5c518;">🏠</div>
    </div>

    <!-- 担当者メッセージ -->
    <div style="width:100%;text-align:right;margin-bottom:8mm;">
      <div style="display:inline-block;font-size:10pt;font-weight:bold;text-align:center;">
        <div>とーんと！と</div>
        <div>おまかせください</div>
        <div style="font-size:24pt;margin-top:4px;">👩‍💼</div>
      </div>
    </div>

    <!-- 区切り線 -->
    <div style="width:100%;border-bottom:1px solid #ccc;margin-bottom:8mm;"></div>

    <!-- フッター：会社情報 -->
    <div style="width:100%;display:flex;align-items:center;justify-content:flex-end;gap:8mm;">
      <!-- 家アイコン群 -->
      <div style="font-size:20pt;color:#f5c518;">🏠🏠🏠</div>

      <!-- 会社情報 -->
      <div style="text-align:left;">
        <div style="font-size:9pt;margin-bottom:2mm;">不動産のことなら「いふう」へ</div>
        <div style="background:#f5c518;padding:3px 10px;font-size:10pt;font-weight:bold;margin-bottom:2mm;text-align:center;">株式会社いふう</div>
        <div style="font-size:9pt;line-height:1.7;">
          大分市舞鶴町1-3-30<br>
          <strong>TEL：097-533-2022</strong><br>
          <strong>FAX：097-529-7160</strong>
        </div>
      </div>
    </div>

  </div>
</div>
</body>
</html>`;
}

// ============================================================
// ページ2: 買付申込書
// ============================================================
export function generatePage2Html(propertyAddress: string, propertyPrice: number | null): string {
  const priceStr = propertyPrice ? propertyPrice.toLocaleString('ja-JP') : '';
  const tdStyle = 'border:1px solid #000;padding:4px 8px;font-size:9pt;';
  const thStyle = 'border:1px solid #000;padding:4px 8px;font-size:9pt;width:140px;';
  return `<div style="width:100%;height:100%;padding:15mm 20mm;background:#fff;font-family:${FONT};font-size:10pt;color:#000;box-sizing:border-box;overflow:hidden;">
    <div style="font-size:18pt;font-weight:bold;text-align:center;text-decoration:underline;margin-bottom:16px;">買付申込書</div>
    <div style="text-align:right;margin-bottom:24px;font-size:10pt;">　　　　年　　　月　　　日</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="${thStyle}">住所</td><td colspan="3" style="${tdStyle}"></td></tr>
      <tr><td colspan="4" style="${tdStyle}">□借家　□持ち家（売却ご予定　ある・なし）</td></tr>
      <tr><td style="${thStyle}">連絡先電話番号</td><td colspan="3" style="${tdStyle}"></td></tr>
      <tr><td style="${thStyle}">メールアドレス</td><td colspan="3" style="${tdStyle}"></td></tr>
      <tr><td style="${thStyle}">契約名義人氏名</td><td colspan="3" style="${tdStyle}"></td></tr>
      <tr><td style="${thStyle}">勤務先</td><td colspan="3" style="${tdStyle}"></td></tr>
      <tr>
        <td style="border:1px solid #000;padding:4px 8px;font-size:9pt;width:140px;">勤続年数</td>
        <td style="border:1px solid #000;padding:4px 8px;font-size:9pt;"></td>
        <td style="border:1px solid #000;padding:4px 8px;font-size:9pt;width:80px;">年収</td>
        <td style="border:1px solid #000;padding:4px 8px;font-size:9pt;width:120px;"></td>
      </tr>
    </table>
    <div style="font-size:9pt;margin-bottom:16px;">
      仲介業者：株式会社いふう<br>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;大分市舞鶴町1-3-30<br>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;TEL：097-533-2022　FAX：<span style="text-decoration:underline;">097-529-7160</span>
    </div>
    <div style="margin-bottom:16px;">私は、下記不動産を、下記の条件にて購入したく、買い付けることを証明致します。</div>
    <div style="text-align:center;margin-bottom:16px;">記</div>
    <div style="display:flex;align-items:baseline;margin-bottom:16px;padding-left:4px;">
      <span style="min-width:80px;">１，物件</span>
      <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;margin-left:8px;text-align:center;font-size:12pt;font-weight:bold;">${propertyAddress}</div>
    </div>
    <div style="padding-left:4px;margin-bottom:16px;">
      <div style="margin-bottom:8px;">２，条件</div>
      <div style="display:flex;align-items:baseline;padding-left:48px;margin-bottom:12px;">
        <span style="min-width:80px;">購入価格</span>
        <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;margin:0 8px;text-align:center;font-size:12pt;font-weight:bold;">${priceStr}</div>
        <span>円</span>
      </div>
      <div style="display:flex;align-items:baseline;padding-left:48px;margin-bottom:12px;">
        <span style="min-width:80px;">手付金</span>
        <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;margin:0 8px;">&nbsp;</div>
        <span>円</span>
      </div>
      <div style="display:flex;align-items:baseline;padding-left:48px;gap:8px;">
        <span>契約日（仮）</span><div style="border-bottom:1px solid #000;width:40px;">&nbsp;</div><span>月</span><div style="border-bottom:1px solid #000;width:40px;">&nbsp;</div><span>日</span>
        <span style="margin-left:16px;">決済日（仮）</span><div style="border-bottom:1px solid #000;width:40px;">&nbsp;</div><span>月</span><div style="border-bottom:1px solid #000;width:40px;">&nbsp;</div><span>日</span>
      </div>
    </div>
    <div style="display:flex;align-items:baseline;padding-left:4px;margin-bottom:16px;">
      <span style="min-width:100px;">３，支払い方法</span>
      <span style="margin-left:32px;">□ 銀行融資　　　　　　　□ 自己資金</span>
    </div>
    <div style="display:flex;align-items:baseline;padding-left:4px;margin-bottom:16px;">
      <span style="min-width:100px;">４，有効期限</span>
      <span style="margin-left:32px;">本書の有効期間は　提出日より　<strong>２週間</strong>　といたします。</span>
    </div>
    <div style="display:flex;align-items:baseline;padding-left:4px;margin-bottom:16px;">
      <span style="min-width:140px;">５，火災保険の見積もり</span>
      <span style="margin-left:8px;">希望する　・　希望しない</span>
    </div>
    <div style="padding-left:4px;margin-bottom:16px;"><div>６，その他条件</div></div>
    <div style="border:1px solid #000;padding:12px;font-size:8.5pt;line-height:1.6;">
      <div style="font-weight:bold;margin-bottom:4px;">☐ 契約日について</div>
      <div style="margin-bottom:8px;">買付証明書を提出した日から2週間以内に契約日を協議のうえ決定し、契約締結に向けて誠意をもって進めるものとします。また、融資を受ける場合は、買付証明書提出後すぐに金融機関へローンの仮審査の手続きを開始するものとします。</div>
      <div style="font-weight:bold;margin-bottom:4px;">☐ 買付後のキャンセルについて</div>
      <div style="margin-bottom:8px;">買付証明書に記載された条件に基づき、金額等の条件交渉が成立した場合、正当な理由なく一方的に買付証明書を撤回することはできないものとします。</div>
      <div style="font-weight:bold;margin-bottom:4px;">☐ 住宅ローン特約について</div>
      <div style="margin-bottom:8px;">本売買契約は、住宅ローン特約付きの契約として締結するものとします。（住宅ローン審査が否認となった場合には、契約を白紙解除できる特約を付します。）</div>
      <div style="font-size:8pt;font-weight:bold;">※本申込は購入意思を示すものであり、先に他のお客様より申込が入っている場合には、2番手以降での受付となる可能性があることをあらかじめご了承ください。</div>
    </div>
  </div>`;
}

// ============================================================
// ページ3: 内覧証明書
// ============================================================
export function generatePage3Html(propertyAddress: string): string {
  const lineStyle = 'border:none;border-bottom:1px solid #000;display:block;width:100%;height:28px;';
  return `<div style="width:100%;height:100%;padding:12mm 18mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;overflow:hidden;">
    <div style="font-size:8pt;text-align:center;margin-bottom:4px;">この媒介契約は、国土交通省が定めた標準媒介契約約款に基づく契約です。</div>
    <div style="font-size:16pt;font-weight:bold;text-align:center;letter-spacing:0.3em;margin-bottom:4px;">内　覧　証　明　書</div>
    <div style="font-size:9pt;text-align:center;margin-bottom:12px;">依頼の内容：購入</div>
    <div style="border:1px solid #000;padding:12px;margin-bottom:16px;font-size:8.5pt;line-height:1.7;">
      <div>この契約は、次の３つの契約型式のうち、専任媒介契約型式です。</div>
      <div style="font-weight:bold;margin-top:8px;">・専属専任媒介契約型式</div>
      <div>依頼者は、目的物件の売買又は交換の媒介又は代理を、当社以外の宅地建物取引業者に重ねて依頼することができません。</div>
      <div>依頼者は、自ら発見した相手方と売買又は交換の契約を締結することができません。</div>
      <div>当社は、目的物件を国土交通大臣が指定した指定流通機構に登録します。</div>
      <div style="font-weight:bold;margin-top:8px;">・専任媒介契約型式</div>
      <div>依頼者は、目的物件の売買又は交換の媒介又は代理を、当社以外の宅地建物取引業者に重ねて依頼することができません。</div>
      <div>依頼者は、自ら発見した相手方と売買又は交換の契約を締結することができます。</div>
      <div>当社は、目的物件を国土交通大臣が指定した指定流通機構に登録します。</div>
      <div style="font-weight:bold;margin-top:8px;">・一般媒介契約型式</div>
      <div>依頼者は、目的物件の売買又は交換の媒介又は代理を、当社以外の宅地建物取引業者に重ねて依頼することができます。</div>
      <div>依頼者は、自ら発見した相手方と売買又は交換の契約を締結することができます。</div>
    </div>
    <div style="display:flex;align-items:baseline;margin-bottom:4px;">
      <span style="font-size:10pt;min-width:80px;">目的物件：</span>
      <div style="flex:1;border-bottom:2px solid #000;padding-bottom:4px;text-align:center;font-size:13pt;font-weight:bold;">${propertyAddress}</div>
    </div>
    <div style="text-align:center;margin:16px 0;">
      <span style="font-size:12pt;font-weight:bold;border-bottom:1px solid #000;padding-bottom:4px;">を株式会社いふうで内覧しました。</span>
    </div>
    <div style="margin-bottom:24px;">
      <div style="font-size:10pt;font-weight:bold;margin-bottom:12px;">【甲・依頼者】</div>
      <div style="display:flex;align-items:flex-end;margin-bottom:16px;">
        <span style="font-size:10pt;min-width:60px;margin-right:16px;">住　所</span>
        <span style="${lineStyle}"></span>
      </div>
      <div style="display:flex;align-items:flex-end;margin-bottom:16px;">
        <span style="font-size:10pt;min-width:60px;margin-right:16px;">氏　名</span>
        <span style="${lineStyle}"></span>
      </div>
    </div>
    <div>
      <div style="font-size:10pt;font-weight:bold;margin-bottom:12px;">【乙・宅地建物取引業者】</div>
      <div style="display:flex;align-items:flex-end;margin-bottom:12px;">
        <span style="font-size:10pt;min-width:120px;margin-right:16px;">商号（名称）</span>
        <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;font-size:10pt;">株式会社　威風</div>
      </div>
      <div style="display:flex;align-items:flex-end;margin-bottom:12px;">
        <span style="font-size:10pt;min-width:120px;margin-right:16px;">代表者</span>
        <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;font-size:10pt;">國廣智子</div>
      </div>
      <div style="display:flex;align-items:flex-end;margin-bottom:12px;">
        <span style="font-size:10pt;min-width:120px;margin-right:16px;">主たる事務所の所在地</span>
        <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;font-size:10pt;">大分市舞鶴町1-3-30</div>
      </div>
      <div style="display:flex;align-items:flex-end;margin-bottom:12px;">
        <span style="font-size:10pt;min-width:120px;margin-right:16px;">免許証番号</span>
        <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;font-size:10pt;">大分県知事（３）第3183号</div>
      </div>
    </div>
  </div>`;
}

// ============================================================
// ページ4: 資金計画書
// ============================================================
export function generatePage4Html(propertyAddress: string, propertyPrice: number | null, propertyType: string | undefined, today: string): string {
  const price = propertyPrice || 0;
  const inshi = price<=1000000?500:price<=5000000?1000:price<=10000000?5000:price<=50000000?10000:30000;
  const shoyuken = price>=25000000?300000:200000;
  const chukai = price<=8000000?330000:Math.round((price*0.03+60000)*1.1);
  const kasai = (propertyType&&propertyType.includes('マンション'))?200000:300000;
  const GINKO_INSHI = 22000;
  const GINKO_JIMU = 220000;
  const shokeihi = inshi+shoyuken+chukai+kasai+GINKO_INSHI+GINKO_JIMU;
  const total = price+shokeihi;
  const borrowing = shokeihi;
  function monthly(principal:number,rate:number,years:number):number{
    if(principal<=0)return 0;
    const r=rate/12/100,n=years*12;
    if(r===0)return Math.round(principal/n);
    return Math.round(principal*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1));
  }
  const m_hendo = monthly(borrowing,0.95,35);
  const m_flat = monthly(borrowing,1.30,35);
  const f = (n:number)=>n.toLocaleString('ja-JP');
  const thG = 'background:#d9d9d9;font-weight:bold;';
  const thF = 'background:#f2f2f2;font-weight:bold;';
  const td = 'border:1px solid #000;padding:4px 8px;font-size:9pt;';
  const loanRow = (lender:string,rate:number,m:number)=>`<tr>
    <td style="${td}">${lender}</td><td style="${td};text-align:right;">35</td>
    <td style="${td};text-align:right;">${f(borrowing)}</td>
    <td style="${td};text-align:right;">${rate.toFixed(2)}%</td>
    <td style="${td};text-align:right;">${f(m)}</td>
    <td style="${td};text-align:right;">50,000</td>
  </tr>`;
  const detailRow = (label:string,amount:string,note:string)=>`<tr>
    <td style="${td}">${label}</td>
    <td style="${td};text-align:right;">${amount}</td>
    <td style="${td};font-size:7.5pt;white-space:pre-wrap;">${note}</td>
  </tr>`;
  return `<div style="width:100%;height:100%;padding:10mm 15mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;">
    <div style="border:2px solid #000;text-align:center;padding:8px;margin-bottom:4px;">
      <span style="font-size:14pt;font-weight:bold;">資金計画書《概算》</span>
    </div>
    <div style="text-align:right;font-size:9pt;margin-bottom:2px;">作成日：　${today}</div>
    <div style="font-size:10pt;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:12px;">${propertyAddress}</div>
    <table style="width:100%;border-collapse:collapse;border:2px solid #000;margin-bottom:16px;">
      <tr><td colspan="2" style="${td};${thG};text-align:center;font-size:11pt;">購入費用（概算）</td></tr>
      <tr><td style="${td};${thF};width:40%;">物件価格</td><td style="${td};text-align:right;font-size:11pt;font-weight:bold;">${f(price)} 円</td></tr>
      <tr><td style="${td};${thF};">諸経費</td><td style="${td};text-align:right;font-size:11pt;font-weight:bold;">${f(shokeihi)} 円</td></tr>
      <tr><td style="${td};${thF};">総額</td><td style="${td};text-align:right;font-size:11pt;font-weight:bold;">${f(total)} 円</td></tr>
    </table>
    <div style="font-size:9pt;font-weight:bold;margin-bottom:4px;">【住宅ローン】★変動金利</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr style="${thF}">
        ${['借入先','借入期間（年）','借入金額','金利','月額返済額','ボーナス返済（2回）'].map(h=>`<th style="${td};text-align:center;font-size:8pt;">${h}</th>`).join('')}
      </tr>
      ${loanRow('大分銀行',0.95,m_hendo)}
    </table>
    <div style="font-size:9pt;font-weight:bold;margin-bottom:4px;">【住宅ローン】★フラット35（固定金利）</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr style="${thF}">
        ${['借入先','借入期間（年）','借入金額','金利','月額返済額','ボーナス返済（2回）'].map(h=>`<th style="${td};text-align:center;font-size:8pt;">${h}</th>`).join('')}
      </tr>
      ${loanRow('ARUHI',1.30,m_flat)}
    </table>
    <table style="width:100%;border-collapse:collapse;flex:1;">
      <tr>
        <th style="${td};${thG};text-align:center;flex:2;">内訳</th>
        <th style="${td};${thG};text-align:center;width:120px;">金額（概算）</th>
        <th style="${td};${thG};text-align:center;width:160px;">備考</th>
      </tr>
      ${detailRow('印紙代（売買契約書貼付）',f(inshi),'')}
      ${detailRow('所有権移転、抵当権設定費用等',f(shoyuken),'評価額によって異なります')}
      ${detailRow('仲介手数料',f(chukai),'●801万円以上（3%+6万×消費税）\n●800万円以下（33万円）')}
      ${detailRow('固定資産税・都市計画税の清算金','実費','引渡日で按分します')}
      ${detailRow('火災保険料・地震保険料',f(kasai),'プランによって異なります')}
      ${detailRow('銀行金消契約印紙代',f(GINKO_INSHI),'住宅ローンの契約書に貼る印紙です')}
      ${detailRow('銀行融資事務手数料',f(GINKO_JIMU),'各銀行により異なります')}
      <tr><td style="${td}"></td><td style="${td}"></td><td style="${td}"></td></tr>
      <tr>
        <td style="${td};font-weight:bold;font-size:10pt;">諸経費合計（概算）</td>
        <td style="${td};text-align:right;font-weight:bold;font-size:10pt;">${f(shokeihi)}</td>
        <td style="${td};font-size:7.5pt;">*物件価格以外にかかる費用です</td>
      </tr>
    </table>
    <div style="margin-top:8px;padding-top:4px;border-top:1px solid #000;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:8pt;">㈱いふう　大分市舞鶴町1-3-30　TEL:097-533-2022　MAIL: tenant@ifoo-oita.com</span>
      <span style="font-size:7pt;color:#666;">info→3</span>
    </div>
  </div>`;
}

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
  return `<div style="width:100%;height:100%;padding:12mm 15mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;overflow:hidden;">
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
<meta name="viewport" content="width=794px">
<style>
  @page{size:A4 portrait;margin:0;}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  html{font-size:16px;}
  body{margin:0;padding:0;font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif;}
  .page{width:794px;min-height:1123px;background:white;page-break-after:always;break-after:page;overflow:hidden;}
  @media print{
    .page{width:210mm;height:297mm;min-height:unset;}
  }
</style>
</head>
<body>${pagesHtml}</body>
</html>`;
}
