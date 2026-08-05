/**
 * 売却スケジュールA4テンプレートのサブコンポーネント群
 * デザイン: ネイビー × ゴールド × ホワイト
 * AI生成画像・外部画像URL・人物イラスト禁止
 */
import React from 'react';
import {
  Hash, User, MapPin, CalendarDays, Megaphone,
  ChartNoAxesCombined, Users, TrendingUp, FileSignature,
  KeyRound, Package, ChartColumn, HeartHandshake,
  CheckSquare, Building,
} from 'lucide-react';
import { SaleScheduleData } from './SaleScheduleModal';

interface Colors { navy: string; gold: string; bgLight?: string; }

// ── ヘッダー ──────────────────────────────
export const Header: React.FC<Colors> = ({ navy, gold }) => (
  <div style={{
    background: navy, color: '#fff',
    padding: '7mm 10mm 6mm 10mm',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  }}>
    <div>
      <div style={{ fontSize: '7pt', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>
        不動産
      </div>
      <div style={{
        fontSize: '20pt', fontWeight: 900, letterSpacing: '0.05em',
        color: gold, lineHeight: 1.1,
      }}>
        売却スケジュール
      </div>
      <div style={{ fontSize: '7pt', color: 'rgba(255,255,255,0.75)', marginTop: 3, letterSpacing: '0.05em' }}>
        全力で販売活動を行い、最善の条件でのご売却をサポートします
      </div>
    </div>
    {/* ロゴエリア（テキストのみ・AI生成なし） */}
    <div style={{ textAlign: 'right' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: gold, fontWeight: 800, fontSize: '9pt', letterSpacing: '0.1em',
      }}>
        <Building size={18} color={gold} />
        <span>KUJIRA REAL ESTATE</span>
      </div>
      <div style={{ fontSize: '6pt', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
        くじら不動産
      </div>
    </div>
  </div>
);

// ── 物件情報ボックス ──────────────────────────
interface PropBoxProps extends Colors { data: SaleScheduleData; }
export const PropertyInfoBox: React.FC<PropBoxProps> = ({ data, navy, bgLight }) => {
  const row = (Icon: React.ComponentType<{ size?: number; color?: string }>, label: string, value: string) => (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      borderBottom: `1px solid ${navy}22`, padding: '3mm 3mm',
    }}>
      <div style={{ width: 22, flexShrink: 0, paddingTop: 1 }}>
        <Icon size={13} color={navy} />
      </div>
      <div style={{ width: '18mm', flexShrink: 0, fontSize: '8pt', fontWeight: 700, color: navy }}>
        {label}
      </div>
      <div style={{ flex: 1, fontSize: '8.5pt', wordBreak: 'break-all' }}>{value || '―'}</div>
    </div>
  );
  return (
    <div style={{
      border: `1.5px solid ${navy}`,
      borderRadius: 4,
      background: bgLight,
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {row(Hash, '物件番号', data.propertyNo)}
      {row(User, '売　主　様', data.ownerName ? `${data.ownerName}　様` : '―')}
      {row(MapPin, '物件所在地', data.propertyAddress)}
      {data.assessPrice != null && row(TrendingUp, '査定価格', `${data.assessPrice.toLocaleString()}万円`)}
    </div>
  );
};

// ── STEP共通：左番号BOX ──────────────────────
interface StepNumProps { num: string; label: string; sub: string; navy: string; gold: string; }
const StepNum: React.FC<StepNumProps> = ({ num, label, sub, navy, gold }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    width: '18mm', flexShrink: 0,
  }}>
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: gold, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: '13pt', marginBottom: 2,
      boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
    }}>
      {num}
    </div>
    <div style={{
      background: navy, color: '#fff', borderRadius: 3,
      padding: '2px 5px', fontSize: '6.5pt', fontWeight: 700,
      textAlign: 'center', lineHeight: 1.3, marginTop: 1,
    }}>
      {label}
    </div>
    <div style={{ fontSize: '7pt', color: navy, fontWeight: 700, marginTop: 3, textAlign: 'center', lineHeight: 1.4 }}>
      {sub}
    </div>
    <CalendarDays size={16} color={navy} style={{ marginTop: 4 }} />
  </div>
);

// チェック項目
const CheckItem: React.FC<{ text: string; gold: string }> = ({ text, gold }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
    <CheckSquare size={12} color={gold} />
    <span style={{ fontSize: '7.5pt' }}>{text}</span>
  </div>
);

// ── STEP 1 ────────────────────────────────
interface Step1Props extends Colors { data: SaleScheduleData; fmt: (v?: number) => string; }
export const Step1: React.FC<Step1Props> = ({ data, navy, gold, bgLight, fmt }) => {
  const yearMonth = data.startYear && data.startMonth
    ? `${data.startYear}年${data.startMonth}月` : '―';

  return (
    <div style={{
      display: 'flex', gap: '4mm', background: bgLight,
      border: `1.5px solid ${navy}22`, borderRadius: 4, padding: '4mm',
      flexShrink: 0,
    }}>
      <StepNum num="1" label="売り出し開始" sub={yearMonth} navy={navy} gold={gold} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '2mm' }}>
          <CalendarDays size={14} color={navy} />
          <span style={{ fontSize: '8pt', fontWeight: 700, color: navy }}>
            売出価格
          </span>
          <span style={{ fontSize: '12pt', fontWeight: 900, color: navy }}>
            {fmt(data.listPrice)}
          </span>
          <span style={{ fontSize: '8pt', color: navy }}>万円</span>
        </div>
        <div style={{ display: 'flex', gap: '4mm' }}>
          <div style={{ flex: 1 }}>
            <CheckItem text="室内写真・掲載内容の見直し" gold={gold} />
            <CheckItem text="不動産ポータルサイト掲載" gold={gold} />
            <CheckItem text="周辺相場・競合物件の確認" gold={gold} />
            <CheckItem text="販売活動開始" gold={gold} />
          </div>
          <div style={{
            width: '42mm', background: '#fff', border: `1px solid ${navy}`,
            borderRadius: 4, padding: '3mm',
          }}>
            <div style={{ fontSize: '6.5pt', fontWeight: 900, color: gold, marginBottom: 3, textAlign: 'center' }}>
              POINT
            </div>
            <div style={{ fontSize: '6.5pt', lineHeight: 1.6, color: '#333' }}>
              市場動向を確認し、最も反響を得やすい価格帯・タイミングで販売を開始します。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── STEP 2 ────────────────────────────────
interface Step2Props extends Colors { data: SaleScheduleData; }
export const Step2: React.FC<Step2Props> = ({ data, navy, gold }) => {
  const period = data.marketingPeriod || '―';
  const cards = [
    { Icon: Megaphone, title: '広告の見直し・拡大', desc: '掲載媒体や広告内容を見直し、より多くの購入希望者へ物件情報を届けます。' },
    { Icon: ChartNoAxesCombined, title: '反響状況の分析', desc: '問い合わせ・アクセス状況を分析し、販売方法を随時改善します。' },
    { Icon: Users, title: 'ご案内の強化', desc: 'お問い合わせから内覧まで迅速・丁寧に対応し、購入意欲を高めます。' },
    { Icon: TrendingUp, title: '価格戦略の検討', desc: '市場動向と反響状況を確認し、最適な販売価格をご提案します。' },
  ];
  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${navy}22`,
      borderRadius: 4, padding: '4mm', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', gap: '4mm' }}>
        <StepNum num="2" label="販売活動を強化" sub={period} navy={navy} gold={gold} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '8pt', fontWeight: 700, color: navy, marginBottom: '2mm' }}>
            売却チャンスを逃さないよう全力で販売活動を強化します！
          </div>
          <div style={{ display: 'flex', gap: '2mm' }}>
            {cards.map(({ Icon, title, desc }) => (
              <div key={title} style={{
                flex: 1, background: '#F6F7F9',
                borderTop: `2px solid ${navy}`, borderRadius: 3,
                padding: '3mm 2mm', textAlign: 'center',
              }}>
                <Icon size={16} color={navy} style={{ marginBottom: 3 }} />
                <div style={{ fontSize: '6.5pt', fontWeight: 700, color: navy, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: '6pt', color: '#555', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: '2mm', borderTop: `2px solid ${gold}`,
            paddingTop: '2mm', textAlign: 'center',
            fontSize: '7.5pt', fontWeight: 700, color: gold,
          }}>
            積極的な取り組みで「早期・高値売却」を目指します！
          </div>
        </div>
      </div>
    </div>
  );
};

// ── STEP 3 + 4 ────────────────────────────
interface Step34Props extends Colors { data: SaleScheduleData; fmt: (v?: number) => string; }
export const Step3and4: React.FC<Step34Props> = ({ data, navy, gold, bgLight, fmt }) => {
  const contractYM = data.contractYear && data.contractMonth
    ? `${data.contractYear}年${data.contractMonth}月` : '―';
  const settlementYM = data.settlementYear && data.settlementMonth
    ? `${data.settlementYear}年${data.settlementMonth}月中旬` : '―';

  return (
    <div style={{ display: 'flex', gap: '3mm', flexShrink: 0 }}>
      {/* STEP3 */}
      <div style={{
        flex: 1, background: bgLight,
        border: `1.5px solid ${navy}22`, borderRadius: 4, padding: '3mm',
      }}>
        <div style={{ display: 'flex', gap: '3mm' }}>
          <StepNum num="3" label="売買契約（最低価格）" sub={contractYM} navy={navy} gold={gold} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '2mm' }}>
              <FileSignature size={14} color={navy} />
              <span style={{ fontSize: '7.5pt', fontWeight: 700, color: navy }}>
                最低価格&nbsp;
                <span style={{ fontSize: '11pt', color: navy }}>{fmt(data.minimumPrice)}</span>
                &nbsp;万円での売買契約を目標とします
              </span>
            </div>
            <CheckItem text="最善条件でのご成約を目指します" gold={gold} />
            <CheckItem text="条件調整・契約手続き" gold={gold} />
            <CheckItem text="売買契約書作成・重要事項説明" gold={gold} />
            <div style={{
              marginTop: '2mm', background: '#fff',
              border: `1px solid ${navy}`, borderRadius: 3, padding: '2mm',
            }}>
              <div style={{ fontSize: '6pt', fontWeight: 900, color: gold, marginBottom: 2 }}>POINT</div>
              <div style={{ fontSize: '6pt', lineHeight: 1.6 }}>
                条件が整い次第、スムーズに契約手続きを進めます。
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* STEP4 */}
      <div style={{
        flex: 1, background: '#fff',
        border: `1.5px solid ${navy}22`, borderRadius: 4, padding: '3mm',
      }}>
        <div style={{ display: 'flex', gap: '3mm' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '18mm', flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: gold, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: '13pt', marginBottom: 2,
              boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
            }}>4</div>
            <div style={{
              background: navy, color: '#fff', borderRadius: 3,
              padding: '2px 4px', fontSize: '6pt', fontWeight: 700,
              textAlign: 'center', lineHeight: 1.3, marginTop: 1,
            }}>決済・お引渡し</div>
            <div style={{ fontSize: '7pt', color: navy, fontWeight: 700, marginTop: 3, textAlign: 'center', lineHeight: 1.4 }}>
              {settlementYM}
            </div>
            <KeyRound size={16} color={navy} style={{ marginTop: 4 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '2mm' }}>
              <Package size={14} color={navy} />
              <span style={{ fontSize: '7.5pt', fontWeight: 700, color: navy }}>決済・お引渡し</span>
            </div>
            <CheckItem text="各種手続き・日程調整" gold={gold} />
            <CheckItem text="引き渡し準備" gold={gold} />
            <CheckItem text="鍵のお引き渡し" gold={gold} />
            <CheckItem text="残代金受領" gold={gold} />
            <div style={{
              marginTop: '2mm', background: bgLight,
              border: `1px solid ${navy}`, borderRadius: 3, padding: '2mm',
            }}>
              <div style={{ fontSize: '6pt', fontWeight: 900, color: gold, marginBottom: 2 }}>POINT</div>
              <div style={{ fontSize: '6pt', lineHeight: 1.6 }}>
                決済・お引渡しまでしっかりとサポートいたします。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── サポート体制 ──────────────────────────
interface SupportProps extends Colors {}
export const SupportSection: React.FC<SupportProps> = ({ navy, gold, bgLight }) => {
  const items = [
    { Icon: ChartColumn, title: '市場分析・戦略立案', desc: '最新の市場データを基に、最適な販売戦略をご提案します。' },
    { Icon: Users, title: '販売力・集客力', desc: '多様な広告媒体とネットワークで、より多くの購入希望者にアプローチします。' },
    { Icon: HeartHandshake, title: '安心のサポート', desc: '売主様に寄り添い、安心・安全な売却を実現します。' },
    { Icon: FileSignature, title: '手続きサポート', desc: '売買契約から決済まで、各種手続きを丁寧にサポートします。' },
  ];
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{
        background: navy, color: '#fff',
        padding: '2mm 4mm', borderRadius: '4px 4px 0 0',
        fontSize: '8pt', fontWeight: 700, letterSpacing: '0.05em', textAlign: 'center',
      }}>
        くじら不動産のサポート体制
      </div>
      <div style={{
        display: 'flex', gap: '2mm',
        background: bgLight, border: `1.5px solid ${navy}`,
        borderTop: 'none', borderRadius: '0 0 4px 4px',
        padding: '3mm',
      }}>
        {items.map(({ Icon, title, desc }) => (
          <div key={title} style={{ flex: 1, textAlign: 'center', padding: '2mm' }}>
            <Icon size={18} color={gold} style={{ marginBottom: 4 }} />
            <div style={{ fontSize: '7pt', fontWeight: 700, color: navy, marginBottom: 2 }}>{title}</div>
            <div style={{ fontSize: '6pt', color: '#555', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── メッセージ ─────────────────────────────
interface MsgProps { navy: string; gold: string; }
export const MessageSection: React.FC<MsgProps> = ({ navy, gold }) => (
  <div style={{
    textAlign: 'center', padding: '2mm 4mm',
    borderTop: `2px solid ${gold}`, flexShrink: 0,
  }}>
    <p style={{ fontSize: '7.5pt', color: navy, fontWeight: 700, margin: '0 0 2px 0', lineHeight: 1.7 }}>
      市場動向を見極め、計画的に進めることで最善の売却を実現します。
    </p>
    <p style={{ fontSize: '7pt', color: '#555', margin: 0, lineHeight: 1.7 }}>
      定期的にご報告し、最善の売却を目指しますのでご安心ください。
    </p>
  </div>
);

// ── フッター ──────────────────────────────
interface FooterProps { navy: string; gold: string; }
export const Footer: React.FC<FooterProps> = ({ navy, gold }) => (
  <div style={{
    background: navy, color: '#fff',
    padding: '4mm 10mm',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  }}>
    <div>
      <div style={{ fontSize: '9pt', fontWeight: 800, color: gold }}>くじら不動産</div>
      <div style={{ fontSize: '6pt', color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
        誠実なサポートで、安心の売却を。
      </div>
    </div>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '11pt', fontWeight: 900, color: gold }}>092-401-5331</div>
      <div style={{ fontSize: '6pt', color: 'rgba(255,255,255,0.7)' }}>営業時間 10:00〜18:00</div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '7pt', color: 'rgba(255,255,255,0.85)' }}>福岡市中央区舞鶴3-1-10</div>
      <div style={{ fontSize: '6pt', color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>tenant@ifoo-oita.com</div>
    </div>
  </div>
);
