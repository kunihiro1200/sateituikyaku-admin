import React from 'react';
import { Dialog, DialogContent, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ApartmentIcon from '@mui/icons-material/Apartment';

interface MansionSection { title: string; points: string[]; }
interface MansionContent { brandName: string; developer: string; tagline: string; sections: MansionSection[]; summary: string; }
interface MansionModalProps { open: boolean; onClose: () => void; address: string; }

const SECTION_ICONS: Record<string, string> = {
  'ブランド・デベロッパー': '🏢',
  '構造・耐震性': '🏗️',
  'このブランドならではの強み': '✨',
  '管理・アフターサービス': '🛡️',
  '資産価値・売却時のポイント': '💰',
};

const DATA: Record<string, MansionContent> = {
  'アルファステイツ': {
    brandName: 'アルファステイツ',
    developer: 'コープランド株式会社',
    tagline: '地域トップクラスの分譲マンションブランド',
    sections: [
      { title: 'ブランド・デベロッパー', points: [
        'コープランド株式会社（旧・大和ハウス不動産）が開発・分譲する地域ブランドマンション',
        '主に九州・山口・広島・山陰・山陽・岡山・高知・愛媛など西日本・四国・九州地域で展開',
        '地域内でのブランド認知度が高く、中古市場でも評価されやすい',
      ]},
      { title: '構造・耐震性', points: [
        '耐震等級3（最高等級）を標準取得',
        '鉄筋コンクリート造（RC造）で高い耐震性・防火性・防音性を実現',
        '地盤調査・地盤改良を必要に応じて実施し安全性を確保',
      ]},
      { title: 'このブランドならではの強み', points: [
        '地域のランドマークになる立地を選び、地域内で最も認知度の高いマンションブランド',
        '大和ハウスグループの設計ノウハウを活かした高品質な内装・共用設備',
        '地域内で複数の分譲履歴を持ち、地域の地価・市場動向を熟知したプライス設定',
      ]},
      { title: '管理・アフターサービス', points: [
        'コープランドグループの管理会社が管理を担当し建物の品質を維持',
        '定期点検・修繕計画を策定し長期的な建物価値を保全',
        '管理組合の運営サポート体制が整備されている',
      ]},
      { title: '資産価値・売却時のポイント', points: [
        '地域内でのブランド認知度が高く、中古市場で買主から安心感を得やすい',
        'RC造の高い耐震性・耐久性が築年数が経っても資産価値を維持する要因になる',
        '共用設備の充実度が買主へのアピールポイントになる',
      ]},
    ],
    summary: '地域ブランドの認知度とRC造の耐震性が、中古市場での高評価につながります',
  },
  'サーパス': {
    brandName: 'サーパス',
    developer: '穴吹工務店株式会社',
    tagline: '穴吹工務店が手がける上質な暮らし',
    sections: [
      { title: 'ブランド・デベロッパー', points: [
        '穴吹工務店株式会社が開発・分譲するマンションブランド',
        '四国・西日本・九州を中心に全国展開し、地域内でのブランド認知度が高い',
        '「サーパスクオリティー」として一貫した品質管理を実施',
      ]},
      { title: '構造・耐震性', points: [
        '耐震等級3（最高等級）を標準取得',
        '鉄筋コンクリート造（RC造）で高い耐震性・防火性・防音性を実現',
        '地盤調査・地盤改良を必要に応じて実施し安全性を確保',
      ]},
      { title: 'このブランドならではの強み', points: [
        '穴吹工務店の「サーパスクオリティー」に基づく一貫した品質管理',
        '四国・西日本・九州を中心に全国展開し、地域内でのブランド認知度が高い',
        'インテリアコーディネーターが全棟対応し、住まう方の理想を叶える生活空間を実現',
      ]},
      { title: '管理・アフターサービス', points: [
        '穴吹コミュニティが管理を担当し建物の品質を維持',
        '定期点検・修繕計画を策定し長期的な建物価値を保全',
        '管理組合の運営サポート体制が整備されている',
      ]},
      { title: '資産価値・売却時のポイント', points: [
        '地域内でのブランド認知度が高く、中古市場で買主から安心感を得やすい',
        'RC造の高い耐震性・耐久性が築年数が経っても資産価値を維持する要因になる',
        '共用設備の充実度が買主へのアピールポイントになる',
      ]},
    ],
    summary: '穴吹工務店の一貫した品質管理と地域内のブランド力が、中古市場での高評価につながります',
  },
  'MJR': {
    brandName: 'MJR',
    developer: 'JR九州不動産株式会社',
    tagline: 'JR九州が手がけるプレミアムマンション',
    sections: [
      { title: 'ブランド・デベロッパー', points: [
        'JR九州不動産株式会社が開発・分譲する九州のプレミアムマンションブランド',
        '九州内の主要都市（福岡・熊本・鹿児島・大分・長崎など）で展開',
        'JR九州グループのブランド力を背景に、九州内で最も認知度の高いマンションブランドの一つ',
      ]},
      { title: '構造・耐震性', points: [
        '耐震等級3（最高等級）を標準取得',
        '鉄筋コンクリート造（RC造）で高い耐震性・防火性・防音性を実現',
        '地盤調査・地盤改良を必要に応じて実施し安全性を確保',
      ]},
      { title: 'このブランドならではの強み', points: [
        'JR九州の駅辺・交通便利な立地を重視し、利便性の高い物件を展開',
        '九州内の主要都市で展開し、地域で最も認知度の高いプレミアムマンションブランド',
        'ライブラリラウンジ・コンシェルジュなどプレミアム共用施設を充実',
      ]},
      { title: '管理・アフターサービス', points: [
        'JR九州グループの管理会社が管理を担当し建物の品質を維持',
        '定期点検・修繕計画を策定し長期的な建物価値を保全',
        '管理組合の運営サポート体制が整備されている',
      ]},
      { title: '資産価値・売却時のポイント', points: [
        'JR九州ブランドの信頼性が中古市場での高評価につながる',
        '駅辺立地の利便性が買主へのアピールポイントになる',
        'RC造の高い耐震性・耐久性が築年数が経っても資産価値を維持する要因になる',
      ]},
    ],
    summary: 'JR九州ブランドの信頼性と駅辺立地の便利性が、中古市場での高評価につながります',
  },
  'オーヴィジョン': {
    brandName: 'オーヴィジョン',
    developer: '西日本鉄道グループ',
    tagline: '西日本鉄道グループが手がけるプレミアムマンション',
    sections: [
      { title: 'ブランド・デベロッパー', points: [
        '西日本鉄道グループが開発・分譲する福岡・北九州地域のプレミアムマンションブランド',
        '福岡・北九州地域を中心に展開し、西日本鉄道沿線の交通便利な立地を重視',
        '西日本鉄道グループの信頼性をバックに、地域内で高いブランド認知度',
      ]},
      { title: '構造・耐震性', points: [
        '耐震等級3（最高等級）を標準取得',
        '鉄筋コンクリート造（RC造）で高い耐震性・防火性・防音性を実現',
        '地盤調査・地盤改良を必要に応じて実施し安全性を確保',
      ]},
      { title: 'このブランドならではの強み', points: [
        '西日本鉄道グループのネットワークを活かした地域密着型マンション',
        '福岡・北九州地域を中心に展開し、西日本鉄道沿線の交通便利な立地を重視',
        '西日本鉄道グループの信頼性をバックに、地域内で高いブランド認知度',
      ]},
      { title: '管理・アフターサービス', points: [
        '西日本鉄道グループの管理会社が管理を担当し建物の品質を維持',
        '定期点検・修繕計画を策定し長期的な建物価値を保全',
        '管理組合の運営サポート体制が整備されている',
      ]},
      { title: '資産価値・売却時のポイント', points: [
        '西日本鉄道グループの信頼性と地域密着型の展開が、中古市場での高評価につながる',
        '交通便利な立地が買主へのアピールポイントになる',
        'RC造の高い耐震性・耐久性が築年数が経っても資産価値を維持する要因になる',
      ]},
    ],
    summary: '西日本鉄道グループの信頼性と地域密着型の展開が、中古市場での高評価につながります',
  },
  'リビオ': {
    brandName: 'リビオ',
    developer: '日鉄不動産株式会社',
    tagline: '日鉄不動産が手がけるプレミアムマンション',
    sections: [
      { title: 'ブランド・デベロッパー', points: [
        '日鉄不動産株式会社（日本製鉄グループ）が開発・分譲するプレミアムマンションブランド',
        '全国展開の実績を持ち、地域内でのブランド認知度が高い',
        '日本製鉄グループの信頼性をバックに、高品質な内装・設備を標準提供',
      ]},
      { title: '構造・耐震性', points: [
        '耐震等級3（最高等級）を標準取得',
        '鉄筋コンクリート造（RC造）で高い耐震性・防火性・防音性を実現',
        '地盤調査・地盤改良を必要に応じて実施し安全性を確保',
      ]},
      { title: 'このブランドならではの強み', points: [
        '日本製鉄グループの信頼性をバックに、高品質な内装・設備を標準提供',
        '全国展開の実績を持ち、地域内でのブランド認知度が高い',
        'スマートホーム対応・エコ住宅設備など次世代向けの設備を充実',
      ]},
      { title: '管理・アフターサービス', points: [
        '日鉄不動産グループの管理会社が管理を担当し建物の品質を維持',
        '定期点検・修繕計画を策定し長期的な建物価値を保全',
        '管理組合の運営サポート体制が整備されている',
      ]},
      { title: '資産価値・売却時のポイント', points: [
        '日本製鉄グループの信頼性と高品質な設備が、中古市場での高評価につながる',
        'スマートホーム設備が次世代の買主層に響くアピールポイントになる',
        'RC造の高い耐震性・耐久性が築年数が経っても資産価値を維持する要因になる',
      ]},
    ],
    summary: '日本製鉄グループの信頼性と高品質な設備が、中古市場での高評価につながります',
  },
};

// 地域ブランド共通データを生成するヘルパー
function makeLocalBrand(brandName: string, developer: string, tagline: string, uniqueStrengths: string[], summary: string): MansionContent {
  return {
    brandName, developer, tagline,
    sections: [
      { title: 'ブランド・デベロッパー', points: [
        `${developer}が開発・分譲する地域密着型マンションブランド`,
        '地域内での分譲実績を持ち、地域の地価・市場動向を熟知したプライス設定',
        '地域内でのブランド認知度が高く、中古市場でも評価されやすい',
      ]},
      { title: '構造・耐震性', points: [
        '耐震等級3（最高等級）を標準取得',
        '鉄筋コンクリート造（RC造）で高い耐震性・防火性・防音性を実現',
        '地盤調査・地盤改良を必要に応じて実施し安全性を確保',
      ]},
      { title: 'このブランドならではの強み', points: uniqueStrengths },
      { title: '管理・アフターサービス', points: [
        'グループ管理会社が管理を担当し建物の品質を維持',
        '定期点検・修繕計画を策定し長期的な建物価値を保全',
        '管理組合の運営サポート体制が整備されている',
      ]},
      { title: '資産価値・売却時のポイント', points: [
        '地域内でのブランド認知度が高く、中古市場で買主から安心感を得やすい',
        'RC造の高い耐震性・耐久性が築年数が経っても資産価値を維持する要因になる',
        '共用設備の充実度が買主へのアピールポイントになる',
      ]},
    ],
    summary,
  };
}

// 地域ブランドのデータを追加
const LOCAL_BRANDS: Record<string, MansionContent> = {
  'サンレスコ': makeLocalBrand('サンレスコ', '地域デベロッパー', '地域密着型マンションブランド',
    ['地域に根ざした開発で、地元住民のニーズを反映した間取り・設備を提供', '地域内での複数の分譲実績を持ち、地域の市場動向を熟知', 'オートロック・モニター・宅配ボックスなどセキュリティ設備を充実'],
    'ブランド認知度とRC造の耐震性が、中古市場での高評価につながります'),
  'グリーンヒル': makeLocalBrand('グリーンヒル', '地域デベロッパー', '地域密着型マンションブランド',
    ['緑豊かな環境と高品質を幅広い層に提供', '地域内での複数の分譲実績を持ち、地域の市場動向を熟知', 'オートロック・モニター・宅配ボックスなどセキュリティ設備を充実'],
    'ブランド認知度とRC造の耐震性が、中古市場での高評価につながります'),
  'エイリック': makeLocalBrand('エイリック', '地域デベロッパー', '地域密着型マンションブランド',
    ['地域に根ざした開発で、地元住民のニーズを反映した間取り・設備を提供', '地域内での複数の分譲実績を持ち、地域の市場動向を熟知', 'オートロック・モニター・宅配ボックスなどセキュリティ設備を充実'],
    'ブランド認知度とRC造の耐震性が、中古市場での高評価につながります'),
  'スタイルパークサイド': makeLocalBrand('スタイルパークサイド', '地域デベロッパー', '地域密着型マンションブランド',
    ['スタイリッシュなデザインと便利な立地を幅広い層に提供', '地域内での複数の分譲実績を持ち、地域の市場動向を熟知', 'オートロック・モニター・宅配ボックスなどセキュリティ設備を充実'],
    'ブランド認知度とRC造の耐震性が、中古市場での高評価につながります'),
  'デュオヒルズ': makeLocalBrand('デュオヒルズ', '地域デベロッパー', '地域密着型マンションブランド',
    ['デュアルコンセプトのデザインマンション', '地域内での複数の分譲実績を持ち、地域の市場動向を熟知', 'オートロック・モニター・宅配ボックスなどセキュリティ設備を充実'],
    'ブランド認知度とRC造の耐震性が、中古市場での高評価につながります'),
  'サンパーク': makeLocalBrand('サンパーク', '地域デベロッパー', '地域密着型マンションブランド',
    ['地域に根ざした開発で、地元住民のニーズを反映した間取り・設備を提供', '地域内での複数の分譲実績を持ち、地域の市場動向を熟知', 'オートロック・モニター・宅配ボックスなどセキュリティ設備を充実'],
    'ブランド認知度とRC造の耐震性が、中古市場での高評価につながります'),
  'クレア': makeLocalBrand('クレア', '地域デベロッパー', '地域密着型マンションブランド',
    ['地域に根ざした開発で、地元住民のニーズを反映した間取り・設備を提供', '地域内での複数の分譲実績を持ち、地域の市場動向を熟知', 'オートロック・モニター・宅配ボックスなどセキュリティ設備を充実'],
    'ブランド認知度とRC造の耐震性が、中古市場での高評価につながります'),
  'ネクスト': makeLocalBrand('ネクスト', '地域デベロッパー', '地域密着型マンションブランド',
    ['地域に根ざした開発で、地元住民のニーズを反映した間取り・設備を提供', '地域内での複数の分譲実績を持ち、地域の市場動向を熟知', 'オートロック・モニター・宅配ボックスなどセキュリティ設備を充実'],
    'ブランド認知度とRC造の耐震性が、中古市場での高評価につながります'),
  'ロフティ': makeLocalBrand('ロフティ', '地域デベロッパー', '地域密着型マンションブランド',
    ['地域に根ざした開発で、地元住民のニーズを反映した間取り・設備を提供', '地域内での複数の分譲実績を持ち、地域の市場動向を熟知', 'オートロック・モニター・宅配ボックスなどセキュリティ設備を充実'],
    'ブランド認知度とRC造の耐震性が、中古市場での高評価につながります'),
  'パレスト': makeLocalBrand('パレスト', '地域デベロッパー', '地域密着型マンションブランド',
    ['地域に根ざした開発で、地元住民のニーズを反映した間取り・設備を提供', '地域内での複数の分譲実績を持ち、地域の市場動向を熟知', 'オートロック・モニター・宅配ボックスなどセキュリティ設備を充実'],
    'ブランド認知度とRC造の耐震性が、中古市場での高評価につながります'),
};

const ALL_DATA: Record<string, MansionContent> = { ...DATA, ...LOCAL_BRANDS };

function detectBrand(address: string): MansionContent | null {
  for (const [key, data] of Object.entries(ALL_DATA)) {
    if (address.includes(key)) return data;
  }
  return null;
}

const MansionModal: React.FC<MansionModalProps> = ({ open, onClose, address }) => {
  const content = open ? detectBrand(address) : null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth transitionDuration={0} PaperProps={{ sx: { borderRadius: 2, maxHeight: '90vh' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)', color: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ApartmentIcon />
          <Typography variant="h6" fontWeight={700}>{content ? `${content.brandName} 特徴・メリット` : 'マンション情報'}</Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'white' }}><CloseIcon /></IconButton>
      </Box>
      <DialogContent sx={{ p: 3 }}>
        {!content && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">マンションブランド情報が見つかりませんでした。</Typography>
          </Box>
        )}
        {content && (
          <Box>
            <Box sx={{ background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)', color: 'white', p: 2.5, borderRadius: 2, mb: 2 }}>
              <Box sx={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px', px: 1, py: 0.2, fontSize: '0.7rem', mb: 0.5 }}>
                マンションブランド資料
              </Box>
              <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '0.02em' }}>{content.brandName}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>{content.developer} / {content.tagline}</Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
              {content.sections.map((section, idx) => (
                <Box key={idx} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
                  <Box sx={{ background: '#f1f8e9', px: 1.5, py: 0.8, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.82rem', color: '#1b5e20' }}>
                      {SECTION_ICONS[section.title] || '📌'} {section.title}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5 }}>
                    {section.points.map((point, pIdx) => (
                      <Box key={pIdx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: pIdx < section.points.length - 1 ? 0.8 : 0 }}>
                        <Box sx={{ width: 5, height: 5, borderRadius: '50%', background: '#2e7d32', mt: '6px', flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', lineHeight: 1.6 }}>{point}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)', border: '1px solid', borderColor: '#a5d6a7', borderRadius: 1.5, p: 1.5, textAlign: 'center' }}>
              <Typography variant="body1" fontWeight={600} sx={{ color: '#1b5e20' }}>{content.summary}</Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MansionModal;
