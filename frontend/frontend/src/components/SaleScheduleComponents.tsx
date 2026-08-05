/**
 * 売却スケジュール A4 固定テンプレート
 *
 * 【重要ルール】
 * - イラストは /sale-schedule/illustrations/ 以下のPNG固定素材を使用
 * - AI生成・lucide-reactアイコン・CSSで似た絵を作ることは禁止
 * - 物件ごとに変更するのはデータのみ。レイアウト・イラスト・サイズは完全固定
 * - 各セクションの高さ固定（物件データが変わってもレイアウトがずれない）
 */
import React from 'react';
import { SaleScheduleData } from './SaleScheduleModal';

// ─────────────────────────────────────────
// イラストパス定数（固定）
// ─────────────────────────────────────────
const IL = '/sale-schedule/illustrations/';
const IMG = {
  calendar:        `${IL}01_calendar.png`,
  megaphone:       `${IL}02_megaphone.png`,
  analysis:        `${IL}03_analysis.png`,
  customerSupport: `${IL}04_customer_support.png`,
  priceStrategy:   `${IL}05_price_strategy.png`,
  marketAnalysis:  `${IL}06_market_analysis.png`,
  salesPower:      `${IL}07_sales_power.png`,
  support:         `${IL}08_support.png`,
  procedure:       `${IL}09_procedure.png`,
  buildings:       `${IL}10_buildings.png`,
  logo:            '/kujira-fudosan-logo.png',  // publicルートに既存
} as const;

// ─────────────────────────────────────────
// 共通型
// ─────────────────────────────────────────
interface Colors { navy: string; gold: string; bgLight?: string; }

// ─────────────────────────────────────────
// イラスト表示領域（固定サイズ）
// ─────────────────────────────────────────
const IllustArea: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <div style={{
    width: '100%', height: '13mm',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }}>
    <img
      src={src} alt={alt}
      style={{ width: 'auto', height: '11mm', maxWidth: '22mm', objectFit: 'contain', display: 'block' }}
      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  </div>
);

// ─────────────────────────────────────────
// チェック項目
// ─────────────────────────────────────────
const CheckItem: React.FC<{ text: string; gold: string }> = ({ text, gold }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
    <div style={{
      width: 9, height: 9, border: `1.5px solid ${gold}`, borderRadius: 2, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: 5, height: 5, background: gold, borderRadius: 1 }} />
    </div>
    <span style={{ fontSize: '7pt', lineHeight: 1.3 }}>{text}</span>
  </div>
);

// ─────────────────────────────────────────
// HEADER（高さ固定）
// ─────────────────────────────────────────
export const Header: React.FC<Colors> = ({ navy, gold }) => (
  <div style={{
    background: navy, color: '#fff',
    padding: '0 10mm',
    height: '22mm', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    boxSizing: 'border-box',
  }}>
    {/* 左：タイトル */}
    <div>
      <div style={{ fontSize: '7.5pt', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.65)', marginBottom: 1 }}>
        不動産
      </div>
      <div style={{ fontSize: '22pt', fontWeight: 900, color: gold, letterSpacing: '0.04em', lineHeight: 1 }}>
        売却スケジュール
      </div>
      <div style={{ fontSize: '6.5pt', color: 'rgba(255,255,255,0.7)', marginTop: 3, letterSpacing: '0.04em' }}>
        全力で販売活動を行い、最善の条件でのご売却をサポートします
      </div>
    </div>
    {/* 右：ロゴ */}
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
      <img
        src={IMG.logo} alt="くじら不動産"
        style={{ height: '9mm', maxWidth: '30mm', objectFit: 'contain' }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
      <div style={{ fontSize: '7pt', fontWeight: 700, color: gold, letterSpacing: '0.12em' }}>
        KUJIRA REAL ESTATE
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────
// 物件情報ボックス（高さ固定）
// ─────────────────────────────────────────
interface PropBoxProps extends Colors { data: SaleScheduleData; }
export const PropertyInfoBox: React.FC<PropBoxProps> = ({ data, navy, bgLight }) => {
  const row = (icon: string, label: string, value: string, isAddress = false) => (
    <div style={{
      display: 'flex', alignItems: isAddress ? 'flex-start' : 'center',
      borderBottom: `1px solid ${navy}20`, padding: '2.5mm 3mm',
      minHeight: isAddress ? '9mm' : '7mm', maxHeight: isAddress ? '10mm' : '7mm',
      overflow: 'hidden',
    }}>
      <div style={{ width: '4mm', fontSize: '9pt', flexShrink: 0, marginRight: '2mm', paddingTop: isAddress ? 1 : 0 }}>
        {icon}
      </div>
      <div style={{ width: '18mm', flexShrink: 0, fontSize: '7.5pt', fontWeight: 700, color: navy }}>
        {label}
      </div>
      <div style={{
        flex: 1, fontSize: isAddress ? '7.5pt' : '8pt',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: isAddress ? 2 : 1,
        WebkitBoxOrient: 'vertical' as const,
        wordBreak: 'break-all',
      }}>
        {value || '―'}
      </div>
    </div>
  );

  return (
    <div style={{
      border: `1.5px solid ${navy}`,
      borderRadius: 4,
      background: bgLight,
      overflow: 'hidden',
      flexShrink: 0,
      height: '29mm',
      boxSizing: 'border-box',
    }}>
      {row('＃', '物件番号', data.propertyNo)}
      {row('👤', '売　主　様', data.ownerName ? `${data.ownerName}　様` : '―')}
      {row('📍', '物件所在地', data.propertyAddress, true)}
      {data.assessPrice != null && row('💴', '査定価格', `${data.assessPrice.toLocaleString()}万円`)}
    </div>
  );
};

// ─────────────────────────────────────────
// STEP 左カラム（番号 + ラベル + 年月 + カレンダー画像）
// ─────────────────────────────────────────
interface StepLeftProps { num: string; label: string; yearMonth: string; navy: string; gold: string; showCalendar?: boolean; }
const StepLeft: React.FC<StepLeftProps> = ({ num, label, yearMonth, navy, gold, showCalendar }) => (
  <div style={{
    width: '18mm', flexShrink: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  }}>
    {/* 番号サークル */}
    <div style={{
      width: 26, height: 26, borderRadius: '50%',
      background: gold, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: '13pt',
      boxShadow: '0 2px 4px rgba(0,0,0,0.25)', flexShrink: 0,
    }}>
      {num}
    </div>
    {/* ラベル */}
    <div style={{
      background: navy, color: '#fff', borderRadius: 3,
      padding: '1.5px 4px', fontSize: '6pt', fontWeight: 700,
      textAlign: 'center', lineHeight: 1.3, marginTop: 2,
      whiteSpace: 'pre-wrap', maxWidth: '18mm',
    }}>
      {label}
    </div>
    {/* 年月 */}
    <div style={{
      fontSize: '7.5pt', color: navy, fontWeight: 700,
      marginTop: 3, textAlign: 'center', lineHeight: 1.4,
    }}>
      {yearMonth}
    </div>
    {/* カレンダー画像（STEP1のみ） */}
    {showCalendar && (
      <div style={{ width: '16mm', height: '12mm', marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <img
          src={IMG.calendar} alt="カレンダー"
          style={{ width: 'auto', height: '10mm', maxWidth: '16mm', objectFit: 'contain' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────
// STEP 1（高さ固定）
// ─────────────────────────────────────────
interface Step1Props extends Colors { data: SaleScheduleData; fmt: (v?: number) => string; }
export const Step1: React.FC<Step1Props> = ({ data, navy, gold, bgLight, fmt }) => {
  const yearMonth = data.startYear && data.startMonth
    ? `${data.startYear}年\n${data.startMonth}月` : '―';

  return (
    <div style={{
      display: 'flex', gap: '3mm',
      background: bgLight, border: `1.5px solid ${navy}22`,
      borderRadius: 4, padding: '3.5mm',
      height: '38mm', flexShrink: 0, boxSizing: 'border-box', overflow: 'hidden',
    }}>
      <StepLeft num="1" label="売り出し開始" yearMonth={yearMonth} navy={navy} gold={gold} showCalendar />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {/* 売出価格 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: '2.5mm' }}>
          <span style={{ fontSize: '7.5pt', fontWeight: 700, color: navy }}>売出価格</span>
          <span style={{ fontSize: '15pt', fontWeight: 900, color: gold, lineHeight: 1 }}>
            {fmt(data.listPrice)}
          </span>
          <span style={{ fontSize: '7.5pt', color: navy }}>万円</span>
        </div>
        <div style={{ display: 'flex', gap: '3mm' }}>
          <div style={{ flex: 1 }}>
            <CheckItem text="室内写真・掲載内容の見直し" gold={gold} />
            <CheckItem text="不動産ポータルサイト掲載" gold={gold} />
            <CheckItem text="周辺相場・競合物件の確認" gold={gold} />
            <CheckItem text="販売活動開始" gold={gold} />
          </div>
          <div style={{
            width: '40mm', flexShrink: 0,
            background: '#fff', border: `1px solid ${navy}`,
            borderRadius: 4, padding: '2.5mm',
          }}>
            <div style={{ fontSize: '6pt', fontWeight: 900, color: gold, marginBottom: 3, textAlign: 'center', letterSpacing: '0.08em' }}>
              POINT
            </div>
            <div style={{ fontSize: '6pt', lineHeight: 1.6, color: '#333' }}>
              市場動向を確認し、最も反響を得やすい価格帯・タイミングで販売を開始します。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// STEP 2（高さ固定 / 4カラム・PNG固定配置）
// ─────────────────────────────────────────
interface Step2Props extends Colors { data: SaleScheduleData; }
export const Step2: React.FC<Step2Props> = ({ data, navy, gold }) => {
  const period = data.marketingPeriod || '―';

  const activities = [
    { src: IMG.megaphone,       title: '広告の見直し・拡大', desc: '掲載媒体や広告内容を見直し、より多くの購入希望者へ物件情報を届けます。' },
    { src: IMG.analysis,        title: '反響状況の分析',     desc: '問い合わせ・アクセス状況を分析し、販売方法を随時改善します。' },
    { src: IMG.customerSupport, title: 'ご案内の強化',       desc: 'お問い合わせから内覧まで迅速・丁寧に対応し、購入意欲を高めます。' },
    { src: IMG.priceStrategy,   title: '価格戦略の検討',     desc: '市場動向と反響状況を確認し、最適な販売価格をご提案します。' },
  ];

  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${navy}22`,
      borderRadius: 4, padding: '3.5mm',
      height: '48mm', flexShrink: 0, boxSizing: 'border-box', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', gap: '3mm', height: '100%' }}>
        <StepLeft num="2" label="販売活動を強化" yearMonth={period.replace('〜', '\n〜')} navy={navy} gold={gold} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ fontSize: '7.5pt', fontWeight: 700, color: navy, marginBottom: '2mm', flexShrink: 0 }}>
            売却チャンスを逃さないよう全力で販売活動を強化します！
          </div>
          {/* 4カラム */}
          <div style={{ display: 'flex', gap: '2mm', flex: 1, overflow: 'hidden' }}>
            {activities.map(({ src, title, desc }) => (
              <div key={title} style={{
                flex: 1, background: '#F6F7F9',
                borderTop: `2px solid ${navy}`, borderRadius: 3,
                padding: '2mm 1.5mm',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                overflow: 'hidden',
              }}>
                {/* イラスト表示領域（固定） */}
                <IllustArea src={src} alt={title} />
                <div style={{ fontSize: '6pt', fontWeight: 700, color: navy, marginBottom: 1.5, textAlign: 'center' }}>{title}</div>
                <div style={{ fontSize: '5.5pt', color: '#555', lineHeight: 1.5, textAlign: 'center' }}>{desc}</div>
              </div>
            ))}
          </div>
          {/* ゴールドライン */}
          <div style={{
            marginTop: '2mm', borderTop: `2px solid ${gold}`,
            paddingTop: '1.5mm', textAlign: 'center',
            fontSize: '7pt', fontWeight: 700, color: gold, flexShrink: 0,
          }}>
            積極的な取り組みで「早期・高値売却」を目指します！
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// STEP 3 + 4（高さ固定）
// ─────────────────────────────────────────
interface Step34Props extends Colors { data: SaleScheduleData; fmt: (v?: number) => string; }
export const Step3and4: React.FC<Step34Props> = ({ data, navy, gold, bgLight, fmt }) => {
  const contractYM = data.contractYear && data.contractMonth
    ? `${data.contractYear}年\n${data.contractMonth}月` : '―';
  const settlementYM = data.settlementYear && data.settlementMonth
    ? `${data.settlementYear}年\n${data.settlementMonth}月中旬` : '―';

  const PointBox: React.FC<{ navy: string; gold: string; bg?: string; text: string }> = ({ navy, gold, bg, text }) => (
    <div style={{ background: bg || '#fff', border: `1px solid ${navy}`, borderRadius: 3, padding: '2mm', marginTop: '2mm' }}>
      <div style={{ fontSize: '5.5pt', fontWeight: 900, color: gold, marginBottom: 2 }}>POINT</div>
      <div style={{ fontSize: '5.5pt', lineHeight: 1.6 }}>{text}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: '3mm', flexShrink: 0, height: '38mm', boxSizing: 'border-box' }}>
      {/* STEP 3 */}
      <div style={{
        flex: 1, background: bgLight,
        border: `1.5px solid ${navy}22`, borderRadius: 4,
        padding: '3.5mm', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', gap: '3mm', height: '100%' }}>
          <StepLeft num="3" label={'売買契約\n（最低価格）'} yearMonth={contractYM} navy={navy} gold={gold} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: '2mm', flexWrap: 'nowrap' }}>
              <span style={{ fontSize: '6.5pt', fontWeight: 700, color: navy, flexShrink: 0 }}>最低価格</span>
              <span style={{ fontSize: '11pt', fontWeight: 900, color: gold, lineHeight: 1 }}>{fmt(data.minimumPrice)}</span>
              <span style={{ fontSize: '6.5pt', color: navy }}>万円で売買契約を目標</span>
            </div>
            <CheckItem text="最善条件でのご成約を目指します" gold={gold} />
            <CheckItem text="条件調整・契約手続き" gold={gold} />
            <CheckItem text="売買契約書作成・重要事項説明" gold={gold} />
            <PointBox navy={navy} gold={gold} text="条件が整い次第、スムーズに契約手続きを進めます。" />
          </div>
        </div>
      </div>
      {/* STEP 4 */}
      <div style={{
        flex: 1, background: '#fff',
        border: `1.5px solid ${navy}22`, borderRadius: 4,
        padding: '3.5mm', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', gap: '3mm', height: '100%' }}>
          <StepLeft num="4" label={'決済・\nお引渡し'} yearMonth={settlementYM} navy={navy} gold={gold} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '7.5pt', fontWeight: 700, color: navy, marginBottom: '2mm' }}>決済・お引渡し</div>
            <CheckItem text="各種手続き・日程調整" gold={gold} />
            <CheckItem text="引き渡し準備" gold={gold} />
            <CheckItem text="鍵のお引き渡し" gold={gold} />
            <CheckItem text="残代金受領" gold={gold} />
            <PointBox navy={navy} gold={gold} bg={bgLight} text="決済・お引渡しまでしっかりとサポートいたします。" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// サポート体制（高さ固定 / PNG固定配置）
// ─────────────────────────────────────────
interface SupportProps extends Colors {}
export const SupportSection: React.FC<SupportProps> = ({ navy, gold, bgLight }) => {
  const items = [
    { src: IMG.marketAnalysis, title: '市場分析・戦略立案', desc: '最新の市場データを基に、最適な販売戦略をご提案します。' },
    { src: IMG.salesPower,     title: '販売力・集客力',     desc: '多様な広告媒体とネットワークで、より多くの購入希望者にアプローチします。' },
    { src: IMG.support,        title: '安心のサポート',     desc: '売主様に寄り添い、安心・安全な売却を実現します。' },
    { src: IMG.procedure,      title: '手続きサポート',     desc: '売買契約から決済まで、各種手続きを丁寧にサポートします。' },
  ];
  return (
    <div style={{ flexShrink: 0, height: '26mm', boxSizing: 'border-box' }}>
      <div style={{
        background: navy, color: '#fff',
        padding: '1.5mm 4mm', borderRadius: '4px 4px 0 0',
        fontSize: '7.5pt', fontWeight: 700, letterSpacing: '0.05em', textAlign: 'center',
      }}>
        くじら不動産のサポート体制
      </div>
      <div style={{
        display: 'flex', gap: '2mm',
        background: bgLight, border: `1.5px solid ${navy}`,
        borderTop: 'none', borderRadius: '0 0 4px 4px',
        padding: '2mm',
        height: 'calc(100% - 6mm)',
      }}>
        {items.map(({ src, title, desc }) => (
          <div key={title} style={{
            flex: 1, textAlign: 'center', padding: '1mm',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <IllustArea src={src} alt={title} />
            <div style={{ fontSize: '6.5pt', fontWeight: 700, color: navy, marginBottom: 1 }}>{title}</div>
            <div style={{ fontSize: '5.5pt', color: '#555', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// メッセージ（高さ固定 / 街並み画像配置）
// ─────────────────────────────────────────
interface MsgProps { navy: string; gold: string; }
export const MessageSection: React.FC<MsgProps> = ({ navy, gold }) => (
  <div style={{
    display: 'flex', alignItems: 'center',
    borderTop: `2px solid ${gold}`,
    padding: '2mm 0',
    height: '16mm', flexShrink: 0, boxSizing: 'border-box', overflow: 'hidden',
  }}>
    {/* 街並み画像（左側・固定） */}
    <div style={{ width: '18mm', height: '13mm', flexShrink: 0, display: 'flex', alignItems: 'flex-end' }}>
      <img
        src={IMG.buildings} alt="街並み"
        style={{ width: '18mm', height: 'auto', maxHeight: '13mm', objectFit: 'contain', display: 'block' }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    </div>
    {/* テキスト */}
    <div style={{ flex: 1, paddingLeft: '3mm' }}>
      <p style={{ fontSize: '7.5pt', color: navy, fontWeight: 700, margin: '0 0 1.5px 0', lineHeight: 1.6 }}>
        市場動向を見極め、計画的に進めることで最善の売却を実現します。
      </p>
      <p style={{ fontSize: '6.5pt', color: '#555', margin: 0, lineHeight: 1.6 }}>
        定期的にご報告し、最善の売却を目指しますのでご安心ください。
      </p>
    </div>
  </div>
);

// ─────────────────────────────────────────
// FOOTER（高さ固定）
// ─────────────────────────────────────────
interface FooterProps { navy: string; gold: string; }
export const Footer: React.FC<FooterProps> = ({ navy, gold }) => (
  <div style={{
    background: navy, color: '#fff',
    padding: '0 10mm',
    height: '14mm', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    boxSizing: 'border-box',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
      <img
        src={IMG.logo} alt="くじら不動産"
        style={{ height: '7mm', maxWidth: '12mm', objectFit: 'contain' }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
      <div>
        <div style={{ fontSize: '8pt', fontWeight: 800, color: gold }}>くじら不動産</div>
        <div style={{ fontSize: '5.5pt', color: 'rgba(255,255,255,0.65)' }}>誠実なサポートで、安心の売却を。</div>
      </div>
    </div>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '10pt', fontWeight: 900, color: gold }}>092-401-5331</div>
      <div style={{ fontSize: '5.5pt', color: 'rgba(255,255,255,0.65)' }}>営業時間 10:00〜18:00</div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '6.5pt', color: 'rgba(255,255,255,0.85)' }}>福岡市中央区舞鶴3-1-10</div>
      <div style={{ fontSize: '5.5pt', color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>tenant@ifoo-oita.com</div>
    </div>
  </div>
);
