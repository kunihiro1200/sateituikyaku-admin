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
    ${(property.property_tax||property.management_fee||property.reserve_fund||property.parking||property.delivery)?sbox('よく聞かれる項目',`${property.property_tax?row('固定資産税','¥'+(property.property_tax as number).toLocaleString()):''}${property.management_fee?row('管理費','¥'+(property.management_fee as number).toLocaleString()):''}${property.reserve_fund?row('積立金','¥'+(property.reserve_fund as number).toLocaleString()):''}${property.parking?row('駐車場',property.parking):''}${property.delivery?row('引渡し',property.delivery):''}`,'#f5f5f5'):''}
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
// 内覧準備資料２: 挨拶状（いふうスタイル・publicフォルダ画像版）
// ============================================================
export function generateViewingPrep2Html(buyer: Record<string,unknown>, _today: string): string {
  const rawName = (buyer.name as string) || '';
  const nameWithSama = rawName
    ? (rawName.endsWith('様') ? rawName : rawName + '様')
    : '';
  const base = window.location.origin;
  const imgLogo       = `${base}/ifoo-assets/logo.png`;
  const imgCharaLeft  = `${base}/ifoo-assets/chara-left.png`;
  const imgHouseHeart = `${base}/ifoo-assets/house-heart.png`;
  const imgCharaRight = `${base}/ifoo-assets/chara-right.png`;
  const imgWaHouses   = `${base}/ifoo-assets/wa-houses.png`;
  // 追加5ページのHTML
  const extraPages = [
    generateExtraPage1Html(base),
    generateExtraPage2Html(),
    generateExtraPage3Html(),
    generateExtraPage4Html(),
    generateExtraPage5Html(),
  ];
  const extraPagesHtml = extraPages.map(p => `<div class="page">${p}</div>`).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html,body { margin: 0; padding: 0; background: #fff; font-family: "Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif; color: #000; }
  .page { width: 210mm; height: 297mm; background: #fff; overflow: hidden; display: block; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
</style>
</head>
<body>
<div class="page" style="padding:16px;">
<div style="border:2px solid #f5c518;width:100%;height:100%;padding:24px 36px 20px 36px;display:flex;flex-direction:column;">
  <div>
    <div style="margin-bottom:18px;"><img src="${imgLogo}" height="52" style="display:block;"/></div>
    <div style="text-align:center;margin-bottom:12px;"><span style="font-size:24pt;font-weight:bold;letter-spacing:0.05em;">${esc(nameWithSama)}</span></div>
    <div style="border-bottom:1.5px solid #000;"></div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:60px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:12pt;font-weight:bold;line-height:1.9;">本日は貴重なお時間いただきまして</div>
      <div style="font-size:12pt;font-weight:bold;line-height:1.9;">誠にありがとうございます</div>
    </div>
    <div style="display:flex;align-items:center;margin-bottom:16px;">
      <div style="width:160px;flex-shrink:0;"><img src="${imgCharaLeft}" width="160" style="display:block;"/></div>
      <div style="flex:1;padding:0 8px;text-align:center;font-size:10.5pt;line-height:2.0;">
        <div style="margin-bottom:6px;">大分市・別府市の不動産購入は<br>いふうにおまかせください！</div>
        <div>「資金計画」や「現地見学」「売買契約」など、<br>お住まい購入時の流れやポイントを<br>丁寧にご説明いたします<br>お気軽にご相談ください！</div>
      </div>
      <div style="width:140px;flex-shrink:0;"><img src="${imgHouseHeart}" width="140" style="display:block;"/></div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:4px;">
      <img src="${imgCharaRight}" width="200" style="display:block;"/>
    </div>
  </div>
  <div>
    <div style="border-bottom:1px solid #ccc;margin-bottom:10px;"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <img src="${imgWaHouses}" width="200" style="display:block;"/>
      <div style="text-align:left;">
        <div style="font-size:8.5pt;margin-bottom:4px;">不動産のことなら「いふう」へ</div>
        <div style="background:#f5c518;padding:4px 18px;font-size:10.5pt;font-weight:bold;text-align:center;margin-bottom:6px;">株式会社いふう</div>
        <div style="font-size:9pt;line-height:1.9;">大分市舞鶴町1-3-30<br>TEL：097-533-2022</div>
      </div>
    </div>
  </div>
</div>
</div>
${extraPagesHtml}
</body>
</html>`;
}

// ============================================================
// ページ2: 買付申込書
export function generatePage2Html(propertyAddress: string, propertyPrice: number | null): string {
  const priceStr = propertyPrice ? propertyPrice.toLocaleString('ja-JP') : '';
  const tdStyle = 'border:1px solid #000;padding:4px 8px;font-size:9pt;';
  const thStyle = 'border:1px solid #000;padding:4px 8px;font-size:9pt;width:140px;';
  return `<div style="width:100%;height:100%;padding:8mm 14mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;overflow:hidden;">
    <div style="font-size:16pt;font-weight:bold;text-align:center;text-decoration:underline;margin-bottom:10px;">買付申込書</div>
    <div style="text-align:right;margin-bottom:12px;font-size:9pt;">　　　　年　　　月　　　日</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
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
    <div style="font-size:8.5pt;margin-bottom:8px;">
      仲介業者：株式会社いふう<br>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;大分市舞鶴町1-3-30<br>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;TEL：097-533-2022
    </div>
    <div style="margin-bottom:8px;font-size:9pt;">私は、下記不動産を、下記の条件にて購入したく、買い付けることを証明致します。</div>
    <div style="text-align:center;margin-bottom:8px;">記</div>
    <div style="display:flex;align-items:baseline;margin-bottom:8px;padding-left:4px;">
      <span style="min-width:80px;">１，物件</span>
      <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;margin-left:8px;text-align:center;font-size:12pt;font-weight:bold;">${propertyAddress}</div>
    </div>
    <div style="padding-left:4px;margin-bottom:8px;">
      <div style="margin-bottom:8px;">２，条件</div>
      <div style="display:flex;align-items:baseline;padding-left:48px;margin-bottom:6px;">
        <span style="min-width:80px;">購入価格</span>
        <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;margin:0 8px;text-align:center;font-size:12pt;font-weight:bold;">${priceStr}</div>
        <span>円</span>
      </div>
      <div style="display:flex;align-items:baseline;padding-left:48px;margin-bottom:6px;">
        <span style="min-width:80px;">手付金</span>
        <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;margin:0 8px;">&nbsp;</div>
        <span>円</span>
      </div>
      <div style="display:flex;align-items:baseline;padding-left:48px;gap:8px;">
        <span>契約日（仮）</span><div style="border-bottom:1px solid #000;width:40px;">&nbsp;</div><span>月</span><div style="border-bottom:1px solid #000;width:40px;">&nbsp;</div><span>日</span>
        <span style="margin-left:16px;">決済日（仮）</span><div style="border-bottom:1px solid #000;width:40px;">&nbsp;</div><span>月</span><div style="border-bottom:1px solid #000;width:40px;">&nbsp;</div><span>日</span>
      </div>
    </div>
    <div style="display:flex;align-items:baseline;padding-left:4px;margin-bottom:8px;">
      <span style="min-width:100px;">３，支払い方法</span>
      <span style="margin-left:32px;">□ 銀行融資　　　　　　　□ 自己資金</span>
    </div>
    <div style="display:flex;align-items:baseline;padding-left:4px;margin-bottom:8px;">
      <span style="min-width:100px;">４，有効期限</span>
      <span style="margin-left:32px;">本書の有効期間は　提出日より　<strong>２週間</strong>　といたします。</span>
    </div>
    <div style="display:flex;align-items:baseline;padding-left:4px;margin-bottom:8px;">
      <span style="min-width:140px;">５，火災保険の見積もり</span>
      <span style="margin-left:8px;">希望する　・　希望しない</span>
    </div>
    <div style="padding-left:4px;margin-bottom:8px;"><div>６，その他条件</div></div>
    <div style="border:1px solid #000;padding:12px;font-size:8.5pt;line-height:1.6;">
      <div style="font-weight:bold;margin-bottom:4px;">☐ 契約日について</div>
      <div style="margin-bottom:8px;">買付証明書を提出した日から2週間以内に契約日を協議のうえ決定し、契約締結に向けて誠意をもって進めるものとします。また、融資を受ける場合は、買付証明書提出後すぐに金融機関へローンの仮審査の手続きを開始するものとします。</div>
      <div style="font-weight:bold;margin-bottom:4px;">☐ 買付後のキャンセルについて</div>
      <div style="margin-bottom:8px;">買付証明書に記載された条件に基づき、金額等の条件交渉が成立した場合、正当な理由なく一方的に買付証明書を撤回することはできないものとします。</div>
      <div style="font-weight:bold;margin-bottom:4px;">☐ 住宅ローン特約について</div>
      <div style="margin-bottom:8px;">本売買契約は、住宅ローン特約付きの契約として締結するものとします。（住宅ローン審査が否認となった場合には、契約を白紙解除できる特約を付します。）</div>
      <div style="font-size:8pt;font-weight:bold;">※本申込は購入意思を示すものであり、先に他のお客様より申込が入っている場合には、2番手以降での受付となる可能性があることをあらかじめご了承ください。</div>
    </div>
    ${propertyPrice && propertyPrice > 15000000 ? `
    <div style="padding-left:4px;margin-top:12px;"><div style="font-weight:bold;font-size:10pt;">７，10万円キャンペーン　□お渡し済み</div></div>
    ` : ''}
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
  const shoyuken = price>=10000000?300000:200000;
  const chukai = price<=8000000?330000:Math.round((price*0.03+60000)*1.1);
  const kasai = (propertyType&&propertyType.includes('マンション'))?200000:300000;
  const GINKO_INSHI = 22000;
  const GINKO_JIMU = 220000;
  const shokeihi = inshi+shoyuken+chukai+kasai+GINKO_INSHI+GINKO_JIMU;
  const total = price+shokeihi;
  const borrowing = total; // 総額（物件価格＋諸経費）をローン借入金額とする
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
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">${manRows}</table>
    <div style="font-size:11pt;font-weight:bold;text-align:center;margin-bottom:8px;">戸建リフォーム概算表【税抜価格】</div>
    <table style="width:100%;border-collapse:collapse;">${koRows}</table>
    <div style="text-align:right;margin-top:8px;font-size:8pt;color:#666;">last</div>
  </div>`;
}

// ============================================================
// ページ6: いふうキャンペーンシート（物件価格1500万円以上のみ）
// ============================================================
export function generatePage6CampaignHtml(buyerNumber: string, viewingDate: string): string {
  // 有効期間：内覧日より1年間
  const vDate = new Date(viewingDate.replace(/\//g, '-'));
  const expiryDate = new Date(vDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  const expiryStr = `${expiryDate.getFullYear()}/${String(expiryDate.getMonth() + 1).padStart(2, '0')}/${String(expiryDate.getDate()).padStart(2, '0')}`;

  // 評価欄（1〜5）の生成
  function ratingRow(): string {
    return `<td style="border:1px solid #000;padding:4px 2px;width:200px;">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:7.5pt;">
        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:6.5pt;color:#666;">
        <span>悪い</span><span style="margin-left:auto;">良い</span>
      </div>
    </td>`;
  }

  // 物件記入欄（5行）- 上段に物件名、下段に価格
  let propertyRows = '';
  for (let i = 0; i < 5; i++) {
    propertyRows += `<tr style="height:42px;">
      <td style="border:1px solid #000;border-bottom:1px dotted #999;padding:4px 6px;font-size:8.5pt;text-align:center;">/</td>
      <td style="border:1px solid #000;border-bottom:1px dotted #999;padding:2px 6px;font-size:8.5pt;">
        <div style="border-bottom:1px dotted #ccc;min-height:18px;margin-bottom:2px;"></div>
        <div style="text-align:right;">万円</div>
      </td>
      ${ratingRow()}
      <td style="border:1px solid #000;border-bottom:1px dotted #999;padding:4px 6px;font-size:8.5pt;"></td>
    </tr>`;
  }

  return `<div style="width:100%;height:100%;padding:10mm 12mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;overflow:hidden;">
    <!-- タイトル -->
    <div style="text-align:center;margin-bottom:10px;">
      <div style="font-size:16pt;font-weight:bold;">いふうの5万円値引き＆1年間の修繕費用5万円負担キャンペーン！！</div>
    </div>
    <!-- 条件説明 -->
    <div style="margin-bottom:4px;font-size:9pt;">
      他社の物件のご購入でも可能です！（当社内覧に限ります）
      <span style="float:right;border:2px solid #000;border-radius:8px;padding:2px 8px;font-size:8pt;font-weight:bold;">他社物件でもOK！</span>
    </div>
    <div style="margin-bottom:10px;font-size:9pt;font-weight:bold;">物件価格1500万以上の物件のご購入に限ります！！</div>
    <!-- 有効期間 -->
    <div style="margin-bottom:10px;font-size:9.5pt;">
      <span style="font-weight:bold;color:#000;">有効期間：</span>
      <span style="font-weight:bold;color:#000;">${esc(expiryStr)} まで</span>
    </div>
    <!-- 物件評価テーブル -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
      <tr>
        <th style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;font-weight:bold;background:#f9f9f9;width:100px;">日付</th>
        <th style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;font-weight:bold;background:#f9f9f9;">物件名・価格</th>
        <th style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;font-weight:bold;background:#f9f9f9;width:200px;">評価</th>
        <th style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;font-weight:bold;background:#f9f9f9;">コメント</th>
      </tr>
      ${propertyRows}
    </table>
    <!-- 当社管理番号 -->
    <div style="text-align:right;margin-bottom:12px;font-size:9pt;">
      当社管理番号： <span style="font-weight:bold;">${esc(buyerNumber)}</span>
    </div>
    <!-- ローン仮審査の状況 -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
      <tr>
        <td style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;font-weight:bold;vertical-align:middle;" rowspan="3">ローン仮審査の状況</td>
        <th style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;font-weight:bold;background:#f9f9f9;">銀行名</th>
        <th style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;font-weight:bold;background:#f9f9f9;">融資額</th>
        <th style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;font-weight:bold;background:#f9f9f9;">日付</th>
        <th style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;font-weight:bold;background:#f9f9f9;">結果</th>
      </tr>
      <tr>
        <td style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;">銀行</td>
        <td style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;text-align:right;">万円</td>
        <td style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;text-align:center;">/</td>
        <td style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;"></td>
      </tr>
      <tr>
        <td style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;">銀行</td>
        <td style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;text-align:right;">万円</td>
        <td style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;text-align:center;">/</td>
        <td style="border:1px solid #000;padding:4px 6px;font-size:8.5pt;"></td>
      </tr>
    </table>
    <!-- おすすめ銀行の連絡先 -->
    <div style="border:2px solid #000;padding:8px 10px;margin-bottom:10px;">
      <div style="font-weight:bold;margin-bottom:6px;font-size:9pt;">おすすめ銀行の連絡先（ご参考）</div>
      <table style="width:100%;border-collapse:collapse;font-size:8pt;">
        <tr><td style="font-weight:bold;padding:2px 0;">【大分銀行】</td><td></td><td></td><td style="padding:1px 4px;font-size:7.5pt;">＊休日</td></tr>
        <tr><td style="padding:1px 4px;">ローンプラザ宗麟館</td><td style="padding:1px 4px;">大分市東大道1丁目9番1号3階</td><td style="padding:1px 4px;">0120-67-0189</td><td style="padding:1px 4px;">水、祝</td></tr>
        <tr><td style="padding:1px 4px;">わさだローンプラザ</td><td style="padding:1px 4px;">大分市大字市1157番地</td><td style="padding:1px 4px;">0120-56-0189</td><td style="padding:1px 4px;">水、祝</td></tr>
        <tr><td style="padding:1px 4px;">鶴崎ローンプラザ</td><td style="padding:1px 4px;">大分市南鶴崎3丁目1番12号</td><td style="padding:1px 4px;">0120-53-0189</td><td style="padding:1px 4px;">水、祝</td></tr>
        <tr><td colspan="4" style="font-weight:bold;padding:4px 0 2px;">【ろうきん】</td></tr>
        <tr><td style="padding:1px 4px;">ローンセンターおおいた</td><td style="padding:1px 4px;">大分市寿町1-3（大分支店3F）</td><td style="padding:1px 4px;">097-536-6366</td><td style="padding:1px 4px;">水、土、祝</td></tr>
        <tr><td style="padding:1px 4px;">鶴崎支店</td><td style="padding:1px 4px;">大分市中鶴崎2-3-18</td><td style="padding:1px 4px;">097-521-8101</td><td style="padding:1px 4px;">土、日、祝</td></tr>
        <tr><td colspan="4" style="font-weight:bold;padding:4px 0 2px;">【伊予銀行】</td></tr>
        <tr><td style="padding:1px 4px;">大分支店</td><td style="padding:1px 4px;">大分市府内町3-1-9</td><td style="padding:1px 4px;">097-532-6171</td><td style="padding:1px 4px;">土、日、祝</td></tr>
      </table>
    </div>
    <!-- 銀行相談前の案内 -->
    <div style="border:2px solid #000;padding:8px 10px;">
      <div style="font-weight:bold;margin-bottom:4px;font-size:9pt;">銀行へご相談に行く前に・・・</div>
      <div style="margin-bottom:4px;font-size:8.5pt;">事前に連絡して、予約をされることをお勧めいたします。</div>
      <div style="margin-bottom:4px;font-size:8.5pt;">基本的な準備書類（金融機関によって異なりますので、事前にご確認をお願いいたします）</div>
      <div style="font-size:8.5pt;">①身分証明書（運転免許証等）<br>②健康保険証（勤務先名の記載があるもの）<br>③源泉徴収票（直近のもの）</div>
    </div>
  </div>`;
}

// ============================================================
// 全ページ結合
// ============================================================
export function generateAllPagesHtml(buyer: Record<string,unknown>, propertyDetails: Record<string,unknown>[], today: string): string {
  const pages: string[] = [];
  const buyerNumber = (buyer.buyer_number || '') as string;
  const viewingDateStr = (buyer.viewing_date || today) as string;
  for (const property of propertyDetails) {
    const addr = (property.display_address || property.address || '') as string;
    const price = (property.price || property.listing_price || null) as number | null;
    const ptype = property.property_type as string | undefined;
    pages.push(generatePage1Html(buyer, property, today));
    pages.push(generatePage2Html(addr, price));
    pages.push(generatePage3Html(addr));
    pages.push(generatePage4Html(addr, price, ptype, today));
    pages.push(generatePage5Html());
    // 物件価格1500万円以上の場合のみキャンペーンシートを追加
    if (price != null && price >= 15000000) {
      pages.push(generatePage6CampaignHtml(buyerNumber, viewingDateStr));
    }
  }
  const pagesHtml = pages.map((p)=>`<div class="page">${p}</div>`).join('');
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  @page{size:A4 portrait;margin:0;}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  html,body{margin:0;padding:0;font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif;}
  .page{width:210mm;height:297mm;background:white;overflow:hidden;display:block;page-break-after:always;break-after:page;}
  .page:last-child{page-break-after:auto;break-after:auto;}
</style>
</head>
<body>${pagesHtml}</body>
</html>`;
}

// ============================================================
// 追加ページ群：内覧準備資料の後に印刷する5ページ
// ============================================================

// ページA: 住まい購入の流れ
export function generateExtraPage1Html(base: string): string {
  const imgFamily = `${base}/ifoo-assets/flow-main.png`;
  const imgIcon   = `${base}/ifoo-assets/ifoo-logo-yellow.png`;
  const imgOitaQr = `${base}/ifoo-assets/oita-qr-box.png`;
  const F = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif';
  const yellow = '#f5c518';
  const pink = '#f4b8b8';
  const blue = '#b8d4f4';
  const cellH = 'border:1px solid #ccc;padding:6px 4px;text-align:center;font-size:8pt;vertical-align:middle;';
  const cellV = 'border:1px solid #ccc;padding:4px 2px;text-align:center;font-size:7pt;vertical-align:middle;writing-mode:vertical-rl;width:22px;';
  return `
<div style="width:100%;height:100%;padding:28px 28px 16px 28px;font-family:${F};font-size:9pt;color:#000;background:#fff;box-sizing:border-box;">
  <!-- ヘッダー -->
  <div style="display:flex;align-items:center;margin-bottom:12px;">
    <img src="${imgIcon}" height="48" style="margin-right:12px;"/>
    <div style="font-size:18pt;font-weight:bold;">住まい購入の流れ</div>
    <img src="${imgFamily}" height="90" style="margin-left:auto;"/>
  </div>
  <!-- 購入までの行程 -->
  <div style="display:flex;align-items:center;margin-bottom:10px;">
    <span style="font-size:9pt;margin-right:8px;">🐾</span>
    <span style="font-size:11pt;font-weight:bold;">購入までの行程</span>
    <div style="margin-left:12px;background:#f0f0f0;border-radius:4px;padding:2px 10px;font-size:8pt;">物件探しはこちらから！</div>
  </div>
  <!-- フロー図（画像） -->
  <img src="${base}/ifoo-assets/flow-chart.png" style="width:100%;margin-bottom:14px;display:block;"/>
  <!-- 押さえておきたい税 -->
  <div style="display:flex;align-items:center;margin-bottom:10px;">
    <span style="font-size:9pt;margin-right:8px;">🐾</span>
    <span style="font-size:11pt;font-weight:bold;">押さえておきたい税とお得な制度！</span>
  </div>
  <div style="display:flex;gap:12px;">
    <!-- 左列 -->
    <div style="flex:1;">
      <div style="display:flex;align-items:center;margin-bottom:6px;">
        <span style="background:${yellow};border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:8pt;margin-right:6px;">01</span>
        <span style="font-weight:bold;font-size:9.5pt;">不動産取得税の税率</span>
      </div>
      <div style="font-size:8pt;line-height:1.8;margin-bottom:8px;">
        【原則】<br>宅地……評価額×4%<br>住宅……評価額×4%<br><br>
        【軽減措置】<br>・宅地……評価額×1/2×3%－控除額<br>・住宅……（評価額－控除額）×3%<br>
        　住宅の基礎控除最大1,200万円<br>　（新築年月日により変動、条件あり）<br>
        ＊2024年3月31日まで<br>＊不動産を取得した日から60日以内に申告すること！
      </div>
      <div style="display:flex;align-items:center;margin-bottom:6px;">
        <span style="background:${yellow};border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:8pt;margin-right:6px;">02</span>
        <span style="font-weight:bold;font-size:9.5pt;">住宅ローン控除</span>
      </div>
      <div style="font-size:8pt;line-height:1.8;">
        ＊毎年末の住宅ローン残高<br>＊住宅の取得対価<br>上記いずれか少ない方の金額の0.7%が13年間（中古住宅10年）に渡り所得税の額から控除！<br><br>
        【条件】<br>＊年収が2000万円以下であること<br>＊住宅ローンの借入期間が10年以上<br>（昭和57年以降に建築された住宅）<br>⇒耐震基準適合証明書が必要
      </div>
    </div>
    <!-- 右列 -->
    <div style="flex:1;">
      <div style="display:flex;align-items:center;margin-bottom:6px;">
        <span style="background:${yellow};border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:8pt;margin-right:6px;">03</span>
        <span style="font-weight:bold;font-size:9.5pt;">リフォームの優遇措置</span>
      </div>
      <div style="font-size:8pt;line-height:1.8;">
        〈子育てエコホーム支援事業〉<br>
        対象のリフォーム工事を行った世帯（子育て世帯以外も）を対象に、<span style="color:#e53935;font-weight:bold;">最大60万円</span>の補助が受けられるものです。<br>
        交付申請期間：2024年4月2日〜予算上限に達するまで（遅くとも2024年12月31日）<br>
        対象工事：住宅の省エネ改修（必須）、子育て／防災性向上／バリアフリー改修他<br><br>
        詳細は下記サイトをご確認ください。<br>「子育てエコホーム支援事業」<br>https://kosodate-ecohome.mlit.go.jp/<br><br>
        〈建築物グリーン化促進事業〉<br>
        ●既存住宅における断熱リフォーム支援事業<br>
        ●先進的窓リノベ2024事業<br>
        ●給湯省エネ2024事業<br>
        ●長期優良住宅化リフォーム推進事業　ほか<br><br>
        <img src="${imgOitaQr}" style="width:100%;display:block;margin-top:6px;"/>
      </div>
    </div>
  </div>
  <div style="text-align:right;font-size:7.5pt;color:#666;margin-top:6px;">4</div>
</div>`;
}

// ページB: よくあるご質問 1/2
export function generateExtraPage2Html(): string {
  const F = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif';
  const yellow = '#f5c518';
  const th = `border:1px solid #ccc;padding:6px 10px;background:#f5c518;font-weight:bold;font-size:9pt;`;
  const td = `border:1px solid #ccc;padding:6px 10px;font-size:9pt;`;
  return `
<div style="width:100%;height:100%;padding:0;font-family:${F};font-size:9pt;color:#000;background:#fff;box-sizing:border-box;">
  <!-- タイトル帯 -->
  <div style="background:${yellow};text-align:center;padding:18px 0 14px;margin-top:40px;margin-bottom:24px;">
    <span style="font-size:20pt;font-weight:bold;">よくあるご質問♪1/2</span>
  </div>
  <div style="padding:0 28px;">
    <!-- Q1 -->
    <div style="border:2px solid ${yellow};border-radius:4px;padding:8px 14px;margin-bottom:8px;">
      <div style="font-weight:bold;font-size:10pt;color:#333;">Q1. とても気に入っていて自分の条件にあうのですが<br><span style="margin-left:2em;">1軒目で決めるのはちょっと不安…</span></div>
    </div>
    <div style="margin-bottom:6px;">→ <span style="font-weight:bold;text-decoration:underline;color:#e53935;">約80%</span>の方が1件目で購入されています。</div>
    <div style="margin-bottom:14px;font-size:8.5pt;">最初に内覧する物件は、希望条件に合致しているケースが多く、数ある物件から選んでいただいたご自身の直感は大事です！！</div>
    <!-- グラフ＋購入理由 -->
    <div style="display:flex;gap:16px;margin-bottom:18px;align-items:flex-start;">
      <!-- 棒グラフ（簡易） -->
      <div style="flex:1;">
        <div style="font-size:8pt;text-align:center;margin-bottom:4px;font-weight:bold;">内覧件数別購入割合</div>
        <div style="display:flex;align-items:flex-end;gap:8px;height:100px;border-left:1px solid #333;border-bottom:1px solid #333;padding:0 8px 0 4px;">
          <div style="display:flex;flex-direction:column;align-items:center;flex:1;">
            <div style="font-size:7pt;">79</div>
            <div style="background:#4472c4;width:100%;height:79px;"></div>
            <div style="font-size:7pt;margin-top:2px;">1軒目</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;flex:1;">
            <div style="font-size:7pt;">16</div>
            <div style="background:#ed7d31;width:100%;height:16px;"></div>
            <div style="font-size:7pt;margin-top:2px;">2軒目</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;flex:1;">
            <div style="font-size:7pt;">5</div>
            <div style="background:#ed7d31;width:100%;height:5px;"></div>
            <div style="font-size:7pt;margin-top:2px;">3軒目以降</div>
          </div>
        </div>
        <div style="font-size:7pt;text-align:center;margin-top:2px;">内覧件数</div>
      </div>
      <!-- 購入理由 -->
      <div style="border:1.5px dashed #aaa;border-radius:4px;padding:10px 14px;font-size:8.5pt;line-height:2.0;min-width:160px;">
        <div style="font-weight:bold;margin-bottom:4px;">購入を決めた理由：</div>
        <div>★他の人に決められたら<br>　後悔すると思った</div>
        <div>★ここで生活する<br>　　イメージが湧いた</div>
        <div>★条件にあっていた</div>
      </div>
    </div>
    <!-- Q2 -->
    <div style="border:2px solid ${yellow};border-radius:4px;padding:8px 14px;margin-bottom:8px;">
      <div style="font-weight:bold;font-size:10pt;color:#333;">Q2. 何軒も内覧していて、ちょっと疲れました…<br><span style="margin-left:2em;">なかなかよい物件に出会えない</span></div>
    </div>
    <div style="margin-bottom:8px;">→ 譲れない条件を整理しましょう。<br>以下のチェック項目を参考に、ご自身の優先順位を明確にしてみてください。</div>
    <!-- 表 -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
      <tr><th style="${th}">希望条件</th><th style="${th}">優先度（高・中・低）</th></tr>
      <tr><td style="${td}">立地（エリア・駅距離）</td><td style="${td}"></td></tr>
      <tr><td style="${td}">価格帯（月々支払い）</td><td style="${td}"></td></tr>
      <tr><td style="${td}">間取り・広さ</td><td style="${td}"></td></tr>
      <tr><td style="${td}">築年数・設備</td><td style="${td}"></td></tr>
      <tr><td style="${td}">駐車場・庭の有無</td><td style="${td}"></td></tr>
      <tr><td style="${td}">学校区・周辺環境</td><td style="${td}"></td></tr>
    </table>
    <div style="font-size:8pt;color:#333;">※ 上記をメモしながらお話しすると、ご自身でも気づかなかった<br>　　"優先条件"が明確になることがあります。</div>
  </div>
  <div style="text-align:right;font-size:7.5pt;color:#666;padding-right:28px;margin-top:8px;">5</div>
</div>`;
}

// ページC: よくあるご質問 2/2
export function generateExtraPage3Html(): string {
  const F = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif';
  const yellow = '#f5c518';
  const thS = `border:1px solid #ccc;padding:5px 8px;background:#f5c518;font-weight:bold;font-size:8.5pt;`;
  const tdS = `border:1px solid #ccc;padding:5px 8px;font-size:8pt;`;
  return `
<div style="width:100%;height:100%;padding:0;font-family:${F};font-size:9pt;color:#000;background:#fff;box-sizing:border-box;">
  <div style="background:${yellow};text-align:center;padding:18px 0 14px;margin-top:40px;margin-bottom:20px;">
    <span style="font-size:20pt;font-weight:bold;">よくあるご質問♪2/2</span>
  </div>
  <div style="padding:0 28px;">
    <!-- Q3 -->
    <div style="border:2px solid ${yellow};border-radius:4px;padding:8px 14px;margin-bottom:8px;">
      <div style="font-weight:bold;font-size:10pt;color:#333;">Q3. 予算が合わないのですが…</div>
    </div>
    <div style="margin-bottom:6px;">→ 仮審査は<span style="font-weight:bold;">無料</span>です。審査をしたからといって購入する必要はございません！<br>月々の支払額が具体化され、実現可能な選択肢を確認できます。</div>
    <div style="font-weight:bold;margin-bottom:8px;font-size:8.5pt;">＊ 事前にご予約が必要です！</div>
    <!-- 金融機関表 -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr>
        <th style="${thS}">金融機関</th>
        <th style="${thS}">窓口名</th>
        <th style="${thS}">住所</th>
        <th style="${thS}">電話番号</th>
        <th style="${thS}">定休日</th>
      </tr>
      <tr><td style="${tdS}" rowspan="3">大分銀行</td><td style="${tdS}">ローンプラザ宗麟館</td><td style="${tdS}">大分市東大道1丁目9番1号3階</td><td style="${tdS}">0120-67-0189</td><td style="${tdS}">水、祝</td></tr>
      <tr><td style="${tdS}">わさだローンプラザ</td><td style="${tdS}">大分市大字市1157番地</td><td style="${tdS}">0120-56-0189</td><td style="${tdS}">水、祝</td></tr>
      <tr><td style="${tdS}">鶴崎ローンプラザ</td><td style="${tdS}">大分市南鶴崎3丁目1番12号</td><td style="${tdS}">0120-53-0189</td><td style="${tdS}">水、祝</td></tr>
      <tr><td style="${tdS}" rowspan="2">ろうきん</td><td style="${tdS}">ローンセンターおあいた</td><td style="${tdS}">大分市寿町1-3（大分支店3F）</td><td style="${tdS}">097-536-6366</td><td style="${tdS}">水、土、祝</td></tr>
      <tr><td style="${tdS}">鶴崎支店</td><td style="${tdS}">大分市中鶴崎2-3-18</td><td style="${tdS}">097-521-8101</td><td style="${tdS}">土、日、祝</td></tr>
      <tr><td style="${tdS}">伊予銀行</td><td style="${tdS}">大分支店</td><td style="${tdS}">大分市府内町3-1-9</td><td style="${tdS}">097-532-6171</td><td style="${tdS}">土、日、祝</td></tr>
    </table>
    <!-- 銀行相談前 -->
    <div style="border:1.5px dashed #aaa;border-radius:4px;padding:8px 12px;margin-bottom:10px;font-size:8.5pt;">
      <div style="font-weight:bold;margin-bottom:4px;">【銀行へご相談に行く前に・・・】</div>
      <div style="margin-bottom:4px;">事前に連絡して、予約をされることをお勧めいたします。</div>
      <div style="font-weight:bold;margin-bottom:4px;">▼ 基本的な準備書類（※ 金融機関によって異なります。必ず事前にご確認ください）</div>
      <div>① 身分証明書（運転免許証等）<br>② 健康保険証（勤務先名の記載があるもの）<br>③ 源泉徴収票（直近のもの）</div>
    </div>
    <div style="margin-bottom:10px;font-size:8.5pt;font-weight:bold;">大分銀行の無料シミュレーションはこちら（30秒）→<br><span style="font-weight:normal;">※現在、9割のお客様が変動金利を選択されております（ご参考まで）</span></div>
    <!-- Q4 -->
    <div style="border:2px solid ${yellow};border-radius:4px;padding:8px 14px;margin-bottom:8px;">
      <div style="font-weight:bold;font-size:10pt;color:#e53935;">Q4. リフォーム費用が心配です</div>
    </div>
    <div style="margin-bottom:10px;">→ ご希望があれば、信頼できる業者様をご紹介可能です。<br>もちろん、お客様ご自身で手配されても問題ございません。</div>
    <div style="font-weight:bold;margin-bottom:8px;">何でもお申し付けくださいませ！！</div>
    <div style="font-size:7.5pt;color:#666;text-align:center;">※ 本資料はご検討の一助です。詳細は担当者までご相談ください。</div>
  </div>
  <div style="text-align:right;font-size:7.5pt;color:#666;padding-right:28px;margin-top:4px;">6</div>
</div>`;
}

// ページD: アフターメンテナンスのご案内
export function generateExtraPage4Html(): string {
  const F = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif';
  const orange = '#f0a050';
  const boxStyle = `background:${orange};color:#fff;border-radius:8px;padding:14px 10px;text-align:center;font-weight:bold;font-size:11pt;flex:1;margin:4px;`;
  return `
<div style="width:100%;height:100%;padding:40px 36px 28px 36px;font-family:${F};font-size:9.5pt;color:#000;background:#fff;box-sizing:border-box;">
  <!-- タイトル -->
  <div style="background:#f5c5a0;border-radius:4px;text-align:center;padding:14px 0;margin-bottom:20px;">
    <span style="font-size:18pt;font-weight:bold;">アフターメンテナンスのご案内</span>
  </div>
  <div style="margin-bottom:16px;line-height:1.9;">
    平素は格別のご高配を賜り、厚く御礼申し上げます。<br>
    さて、このたび物件購入されましたお客様向けに生活の安心を高める目的として、アフターメンテナンス（定期点検）のご案内をさせていただきます。お客様の大切な建物の維持に少しでもお役に立ちたいという想いと、未来永劫のお付き合いをさせていただきたいという想いを少しでも形にできるよう努めてまいります。
  </div>
  <!-- 点検内容 -->
  <div style="border:1.5px solid #333;display:inline-block;padding:2px 10px;font-weight:bold;margin-bottom:12px;">点検内容</div>
  <div style="display:flex;gap:8px;margin-bottom:8px;">
    <div style="${boxStyle}">屋外部分<br><span style="font-size:9.5pt;">外壁・屋根・雨樋　etc</span></div>
    <div style="${boxStyle}">屋内部分<br><span style="font-size:9.5pt;">床・壁・天井　etc</span></div>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:16px;">
    <div style="${boxStyle}">建具<br><span style="font-size:9.5pt;">ドア・窓・サッシ　etc</span></div>
    <div style="${boxStyle}">住宅設備機器<br><span style="font-size:9.5pt;">給水・排水・水栓　etc</span></div>
  </div>
  <!-- 注意書き -->
  <div style="background:${orange};color:#fff;border-radius:8px;padding:14px 18px;margin-bottom:20px;line-height:2.0;font-size:10pt;font-weight:bold;">
    ※点検作業費は、無料で実施となります。<br>
    ※点検は、目視点検・動作確認となります。<br>
    ※点検後、気になる箇所はご希望応じて御見積書のご提出をさせていただきます。
  </div>
  <!-- 署名 -->
  <div style="text-align:right;line-height:2.0;font-size:9pt;">
    株式会社いふう<br>
    点検会社：株式会社ネクストイノベーション<br>
    お問い合わせ先：097-576-9398
  </div>
  <div style="text-align:right;font-size:7.5pt;color:#666;margin-top:8px;">7</div>
</div>`;
}

// ページE: e暮らしサポートサービスのご案内
export function generateExtraPage5Html(): string {
  const F = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif';
  const orange = '#f0a050';
  const boxStyle = `background:${orange};color:#fff;border-radius:8px;padding:12px 8px;text-align:center;font-weight:bold;font-size:10.5pt;flex:1;margin:4px;`;
  return `
<div style="width:100%;height:100%;padding:40px 36px 28px 36px;font-family:${F};font-size:9.5pt;color:#000;background:#fff;box-sizing:border-box;">
  <!-- タイトル -->
  <div style="background:#f5c5a0;border-radius:4px;text-align:center;padding:14px 0;margin-bottom:20px;">
    <span style="font-size:16pt;font-weight:bold;">e暮らしサポートサービスのご案内</span>
  </div>
  <div style="margin-bottom:16px;line-height:1.9;">
    平素は格別のご高配を賜り、厚く御礼申し上げます。<br>
    さて、このたび物件購入されましたお客様向けに生活の安心を高める目的として、24時間365日駆け付けサービスのご案内をさせていただきます。<br>
    従来、生活上のトラブルにつきましては、お客様自身にて対応をお願いしておりますので、ご加入はあくまで任意となります。
  </div>
  <!-- サービスのご案内 -->
  <div style="border:1.5px solid #333;display:inline-block;padding:2px 10px;font-weight:bold;margin-bottom:12px;">サービスのご案内</div>
  <!-- メインボックス -->
  <div style="background:${orange};color:#fff;border-radius:8px;padding:14px;text-align:center;font-weight:bold;font-size:12pt;margin-bottom:12px;line-height:1.8;">
    駆け付け費・一次対応費　無料<br>月額／1,100円（税込）
  </div>
  <!-- トラブル一覧 -->
  <div style="display:flex;gap:8px;margin-bottom:8px;">
    <div style="${boxStyle}">水廻りの<br>トラブル</div>
    <div style="${boxStyle}">カギの<br>トラブル</div>
    <div style="${boxStyle}">ガラスの<br>トラブル</div>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:16px;">
    <div style="${boxStyle}">電気の<br>トラブル</div>
    <div style="${boxStyle}">ガス器具の<br>トラブル</div>
    <div style="${boxStyle}">建具の<br>トラブル</div>
  </div>
  <div style="margin-bottom:16px;line-height:1.8;">
    加入につきましては、別紙申込書に記載していただきますよう、宜しくお願い致します。
  </div>
  <!-- 署名 -->
  <div style="text-align:right;line-height:2.0;font-size:9pt;">
    株式会社いふう<br>
    運営会社：株式会社ネクストイノベーション<br>
    お問い合わせ先：097-576-9398
  </div>
  <div style="text-align:right;font-size:7.5pt;color:#666;margin-top:8px;">8</div>
</div>`;
}
