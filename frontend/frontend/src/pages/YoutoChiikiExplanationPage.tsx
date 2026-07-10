import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Divider, Chip } from '@mui/material';
import { ArrowBack as ArrowBackIcon, Home as HomeIcon, Store as StoreIcon, Factory as FactoryIcon } from '@mui/icons-material';

function usePageMeta(title: string) {
  useEffect(() => {
    document.title = title;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="6" fill="#1565c0"/>
      <text x="16" y="22" font-size="11" font-family="'Hiragino Sans','Meiryo',sans-serif"
        font-weight="bold" fill="white" text-anchor="middle">用途</text>
    </svg>`;
    const svgUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = svgUrl;
  }, [title]);
}

// 用途地域データ定義
interface YoutoZoneInfo {
  name: string;
  number: string;
  category: 'residential' | 'commercial' | 'industrial';
  summary: string;
  features: string[];
}

const YOUTO_ZONE_DATA: YoutoZoneInfo[] = [
  {
    name: '第一種低層住居専用地域',
    number: '①',
    category: 'residential',
    summary: '低層住宅を中心とした、静かで落ち着いた住環境を守る地域',
    features: [
      '戸建住宅や低層アパートなどが中心',
      '小・中・高校、診療所、保育所などは建築可能',
      '店舗は、小規模な店舗兼住宅などに限られる',
      '建物の高さは原則として10mまたは12mまで',
      '大きな店舗や高層マンションは建ちにくく、閑静な住宅街になりやすい',
    ],
  },
  {
    name: '第二種低層住居専用地域',
    number: '②',
    category: 'residential',
    summary: '低層住宅の良好な環境を守りながら、小規模な店舗も建てられる地域',
    features: [
      '戸建住宅、低層アパート、低層マンションが中心',
      'コンビニや小規模な飲食店なども一定条件で建築可能',
      '建物の高さは原則として10mまたは12mまで',
      '第一種低層住居専用地域より、生活利便施設が建ちやすい',
      '静かな住環境と日常生活の便利さを両立しやすい',
    ],
  },
  {
    name: '第一種中高層住居専用地域',
    number: '③',
    category: 'residential',
    summary: 'マンションなどの中高層住宅を中心に、良好な住環境を守る地域',
    features: [
      '戸建住宅、アパート、中高層マンションを建築可能',
      '病院、大学、学校なども建築可能',
      '小規模な店舗や飲食店も一定条件で建てられる',
      '大規模な店舗や娯楽施設は建ちにくい',
      'マンションと戸建住宅が混在する住宅街に多い',
    ],
  },
  {
    name: '第二種中高層住居専用地域',
    number: '④',
    category: 'residential',
    summary: '中高層住宅を中心としながら、店舗や事務所も比較的建てやすい地域',
    features: [
      '戸建住宅、アパート、中高層マンションを建築可能',
      '病院、大学、学校なども建築可能',
      '第一種中高層住居専用地域より大きめの店舗や事務所も建てられる',
      'スーパーや飲食店などが周辺にできやすい',
      '住環境と生活利便性のバランスが取りやすい',
    ],
  },
  {
    name: '第一種住居地域',
    number: '⑤',
    category: 'residential',
    summary: '住宅環境を守りながら、店舗や事務所なども建てられる地域',
    features: [
      '戸建住宅、マンション、アパートを建築可能',
      '店舗、飲食店、事務所、ホテルなども一定規模まで建築可能',
      '大規模な店舗や娯楽施設は制限される',
      '第二種住居地域よりも、住宅環境が重視される',
      '住宅と生活利便施設が混在する地域に多い',
    ],
  },
  {
    name: '第二種住居地域',
    number: '⑥',
    category: 'residential',
    summary: '住宅環境を守りつつ、店舗や事務所なども比較的幅広く建てられる地域',
    features: [
      '戸建住宅、マンション、アパートを建築可能',
      '店舗、飲食店、事務所、ホテルなども建築可能',
      'カラオケボックスなども一定条件で建築可能',
      '第一種住居地域よりも店舗や娯楽施設の制限が緩い',
      '幹線道路沿いや生活利便施設の多い地域に指定されることが多い',
    ],
  },
  {
    name: '準住居地域',
    number: '⑦',
    category: 'residential',
    summary: '道路沿いの利便性を生かしながら、住宅との調和を図る地域',
    features: [
      '戸建住宅、マンション、アパートを建築可能',
      '店舗、飲食店、事務所、ホテルなども建築可能',
      '自動車販売店、修理工場などの沿道型施設も建てやすい',
      '幹線道路沿いに指定されることが多い',
      '交通量や店舗が多く、静けさより利便性を重視する人に向いている',
    ],
  },
  {
    name: '田園住居地域',
    number: '⑧',
    category: 'residential',
    summary: '農地や農業と調和した、ゆとりある住宅環境を守る地域',
    features: [
      '戸建住宅や低層住宅を中心とした地域',
      '農産物の直売所や農家レストランなどを一定条件で建築可能',
      '農地と住宅地が共存する街並みを形成しやすい',
      '大規模な店舗や高層建築物は建ちにくい',
      '緑や田畑が残る落ち着いた住環境が期待できる',
    ],
  },
  {
    name: '近隣商業地域',
    number: '⑨',
    category: 'commercial',
    summary: '近隣住民が日常の買物をする店舗などの利便性を高める地域',
    features: [
      'スーパー、飲食店、銀行、事務所などを建築可能',
      '住宅やマンションも建築可能',
      '商店街や駅の周辺に指定されることが多い',
      '準住居地域などよりも商業施設が建ちやすい',
      '買物や交通の利便性が高い一方、騒音や交通量には注意が必要',
    ],
  },
  {
    name: '商業地域',
    number: '⑩',
    category: 'commercial',
    summary: '店舗やオフィスなどの商業活動を中心とした、利便性の高い地域',
    features: [
      '百貨店、商業施設、飲食店、事務所、ホテルなどを幅広く建築可能',
      '高層マンションも建築可能',
      '駅前や都市の中心部、繁華街などに多い',
      '土地を高度に利用しやすく、高い建物が建ちやすい',
      '利便性は非常に高いが、騒音、交通量、日当たりなどの確認が重要',
    ],
  },
  {
    name: '準工業地域',
    number: '⑪',
    category: 'industrial',
    summary: '住宅や店舗と、環境への影響が少ない工場が共存できる地域',
    features: [
      '住宅、マンション、店舗、事務所などを建築可能',
      '軽工業の工場や倉庫なども建築可能',
      '危険性や環境悪化が大きい工場は建築できない',
      '建築できる建物の種類が比較的多い',
      '利便性が高い反面、周辺の工場、倉庫、交通量などの確認が必要',
    ],
  },
  {
    name: '工業地域',
    number: '⑫',
    category: 'industrial',
    summary: '工場の利便性を高めることを目的とした地域',
    features: [
      '規模や種類を問わず、幅広い工場を建築可能',
      '住宅、マンション、店舗も建築可能',
      '学校、病院、ホテルなどは建築できない',
      '工場や物流施設が集まりやすい',
      '住宅購入時は、騒音、振動、臭い、大型車両の通行などを確認したい地域',
    ],
  },
  {
    name: '工業専用地域',
    number: '⑬',
    category: 'industrial',
    summary: '工場の操業環境を守るための、工場専用の地域',
    features: [
      '幅広い種類の工場を建築可能',
      '倉庫や物流施設なども建築可能',
      '住宅、マンション、店舗、学校、病院、ホテルなどは建築できない',
      '原則として人が居住するための地域ではない',
      '工業団地や臨海部などに指定されることが多い',
    ],
  },
];

const CATEGORY_LABELS: Record<YoutoZoneInfo['category'], string> = {
  residential: '住居系',
  commercial: '商業系',
  industrial: '工業系',
};

const CATEGORY_COLORS: Record<YoutoZoneInfo['category'], { bg: string; text: string; light: string; border: string }> = {
  residential: {
    bg: '#1565c0',
    text: '#ffffff',
    light: '#e3f2fd',
    border: '#90caf9',
  },
  commercial: {
    bg: '#e65100',
    text: '#ffffff',
    light: '#fff3e0',
    border: '#ffcc80',
  },
  industrial: {
    bg: '#4e342e',
    text: '#ffffff',
    light: '#efebe9',
    border: '#bcaaa4',
  },
};

// 用途地域名から正規化（スペースや全角スペースを除去して一致させる）
function normalizeName(name: string): string {
  return name.replace(/[\s　]/g, '');
}

export default function YoutoChiikiExplanationPage() {
  const { zoneName } = useParams<{ zoneName: string }>();
  const navigate = useNavigate();

  // URLパラメータからデコードして一致する用途地域を探す
  const decodedZoneName = zoneName ? decodeURIComponent(zoneName) : '';
  const targetZone = YOUTO_ZONE_DATA.find(
    z => normalizeName(z.name) === normalizeName(decodedZoneName)
  );

  usePageMeta(targetZone ? `${targetZone.name} - 用途地域説明` : '用途地域説明');

  const currentCategory = targetZone?.category ?? 'residential';
  const colors = CATEGORY_COLORS[currentCategory];

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* ヘッダー */}
      <Box
        sx={{
          backgroundColor: colors.bg,
          color: colors.text,
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <Button
          onClick={() => navigate(-1)}
          startIcon={<ArrowBackIcon />}
          sx={{ color: colors.text, minWidth: 0, p: 0.5, mr: 0.5 }}
          size="small"
        >
          戻る
        </Button>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
          用途地域の説明
        </Typography>
      </Box>

      <Box sx={{ maxWidth: 700, mx: 'auto', px: 2, py: 3 }}>

        {/* 対象の用途地域（ハイライト表示） */}
        {targetZone ? (
          <Box
            sx={{
              backgroundColor: '#fff',
              borderRadius: 3,
              border: `2px solid ${colors.bg}`,
              p: 3,
              mb: 3,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              <Chip
                label={CATEGORY_LABELS[targetZone.category]}
                size="small"
                sx={{ backgroundColor: colors.bg, color: colors.text, fontWeight: 700, fontSize: '0.75rem' }}
                icon={
                  targetZone.category === 'residential' ? <HomeIcon sx={{ color: `${colors.text} !important`, fontSize: '1rem' }} /> :
                  targetZone.category === 'commercial' ? <StoreIcon sx={{ color: `${colors.text} !important`, fontSize: '1rem' }} /> :
                  <FactoryIcon sx={{ color: `${colors.text} !important`, fontSize: '1rem' }} />
                }
              />
              <Chip
                label="現在の物件の用途地域"
                size="small"
                sx={{ backgroundColor: '#fff9c4', color: '#f57f17', fontWeight: 700, fontSize: '0.75rem', border: '1px solid #f9a825' }}
              />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: colors.bg, mb: 1, fontSize: '1.1rem' }}>
              {targetZone.number} {targetZone.name}
            </Typography>
            <Box
              sx={{
                backgroundColor: colors.light,
                border: `1px solid ${colors.border}`,
                borderRadius: 2,
                px: 2,
                py: 1.5,
                mb: 2,
              }}
            >
              <Typography variant="body1" sx={{ fontWeight: 700, color: colors.bg, fontSize: '0.95rem', lineHeight: 1.6 }}>
                「{targetZone.summary}」
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1 }}>
              主な特徴
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {targetZone.features.map((feature, i) => (
                <Box
                  key={i}
                  component="li"
                  sx={{ mb: 0.5 }}
                >
                  <Typography variant="body2" sx={{ lineHeight: 1.7, color: '#333' }}>
                    {feature}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Box sx={{ backgroundColor: '#fff', borderRadius: 2, p: 3, mb: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">用途地域「{decodedZoneName}」の情報が見つかりませんでした。</Typography>
          </Box>
        )}

        {/* 全用途地域一覧 */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#555', mb: 1.5, px: 0.5 }}>
          他の用途地域
        </Typography>

        {/* 住居系 */}
        <CategorySection
          label="住居系の用途地域"
          category="residential"
          zones={YOUTO_ZONE_DATA.filter(z => z.category === 'residential')}
          currentZoneName={targetZone?.name}
        />

        {/* 商業系 */}
        <CategorySection
          label="商業系の用途地域"
          category="commercial"
          zones={YOUTO_ZONE_DATA.filter(z => z.category === 'commercial')}
          currentZoneName={targetZone?.name}
        />

        {/* 工業系 */}
        <CategorySection
          label="工業系の用途地域"
          category="industrial"
          zones={YOUTO_ZONE_DATA.filter(z => z.category === 'industrial')}
          currentZoneName={targetZone?.name}
        />

      </Box>
    </Box>
  );
}

// カテゴリごとのセクションコンポーネント
function CategorySection({
  label,
  category,
  zones,
  currentZoneName,
}: {
  label: string;
  category: YoutoZoneInfo['category'];
  zones: YoutoZoneInfo[];
  currentZoneName?: string;
}) {
  const colors = CATEGORY_COLORS[category];

  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 1,
          px: 1,
          py: 0.75,
          backgroundColor: colors.light,
          borderRadius: 1.5,
          borderLeft: `4px solid ${colors.bg}`,
        }}
      >
        {category === 'residential' && <HomeIcon sx={{ color: colors.bg, fontSize: '1.1rem' }} />}
        {category === 'commercial' && <StoreIcon sx={{ color: colors.bg, fontSize: '1.1rem' }} />}
        {category === 'industrial' && <FactoryIcon sx={{ color: colors.bg, fontSize: '1.1rem' }} />}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.bg }}>
          {label}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {zones.map((zone, i) => {
          const isCurrent = zone.name === currentZoneName;
          return (
            <Box
              key={zone.name}
              sx={{
                backgroundColor: '#fff',
                borderRadius: 2,
                border: isCurrent ? `2px solid ${colors.bg}` : '1px solid #e0e0e0',
                p: 2,
                opacity: isCurrent ? 1 : 0.85,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, color: isCurrent ? colors.bg : '#444', fontSize: '0.9rem' }}
                >
                  {zone.number} {zone.name}
                </Typography>
                {isCurrent && (
                  <Chip
                    label="この物件"
                    size="small"
                    sx={{ backgroundColor: '#fff9c4', color: '#f57f17', fontWeight: 700, fontSize: '0.7rem', border: '1px solid #f9a825', height: 20 }}
                  />
                )}
              </Box>
              <Typography variant="body2" sx={{ color: '#555', fontSize: '0.82rem', lineHeight: 1.6, mb: 1 }}>
                「{zone.summary}」
              </Typography>
              {i < zones.length - 1 || isCurrent ? null : null}
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {zone.features.map((feature, fi) => (
                  <Box key={fi} component="li">
                    <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#666', lineHeight: 1.6 }}>
                      {feature}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
      <Divider sx={{ mt: 2 }} />
    </Box>
  );
}
