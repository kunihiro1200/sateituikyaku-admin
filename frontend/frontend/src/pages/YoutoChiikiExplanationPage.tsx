import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

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

interface YoutoZoneInfo {
  name: string;
  summary: string;
  features: string[];
}

const YOUTO_ZONE_DATA: YoutoZoneInfo[] = [
  {
    name: '第一種低層住居専用地域',
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

function normalizeName(name: string): string {
  return name
    .replace(/[\s　]/g, '')
    // 全角数字 → 漢数字（用途地域名で使われる範囲）
    .replace(/１/g, '一')
    .replace(/２/g, '二')
    .replace(/３/g, '三')
    .replace(/４/g, '四')
    .replace(/５/g, '五')
    // 半角数字 → 漢数字
    .replace(/1/g, '一')
    .replace(/2/g, '二')
    .replace(/3/g, '三')
    .replace(/4/g, '四')
    .replace(/5/g, '五');
}

export default function YoutoChiikiExplanationPage() {
  const { zoneName } = useParams<{ zoneName: string }>();
  const navigate = useNavigate();

  const decodedZoneName = zoneName ? decodeURIComponent(zoneName) : '';
  const zone = YOUTO_ZONE_DATA.find(
    z => normalizeName(z.name) === normalizeName(decodedZoneName)
  );

  usePageMeta(zone ? `${zone.name}とは` : '用途地域説明');

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#f0f4f8',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ヘッダー */}
      <Box
        sx={{
          backgroundColor: '#1565c0',
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        }}
      >
        <Button
          onClick={() => navigate(-1)}
          startIcon={<ArrowBackIcon />}
          sx={{ color: '#fff', minWidth: 0, p: 0.5 }}
          size="small"
        >
          戻る
        </Button>
        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>
          用途地域の説明
        </Typography>
      </Box>

      {/* コンテンツ */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          px: 3,
          py: 4,
        }}
      >
        {zone ? (
          <Box sx={{ width: '100%', maxWidth: 640 }}>
            {/* 地域名 */}
            <Typography
              sx={{
                fontSize: '1.8rem',
                fontWeight: 900,
                color: '#1565c0',
                mb: 2,
                lineHeight: 1.3,
              }}
            >
              {zone.name}
            </Typography>

            {/* サマリー */}
            <Box
              sx={{
                backgroundColor: '#1565c0',
                borderRadius: 2,
                px: 3,
                py: 2.5,
                mb: 4,
              }}
            >
              <Typography
                sx={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#fff',
                  lineHeight: 1.6,
                }}
              >
                「{zone.summary}」
              </Typography>
            </Box>

            {/* 主な特徴 */}
            <Typography
              sx={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#555',
                mb: 2,
                letterSpacing: '0.05em',
              }}
            >
              主な特徴
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {zone.features.map((feature, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    backgroundColor: '#fff',
                    borderRadius: 2,
                    px: 2.5,
                    py: 2,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  }}
                >
                  <Box
                    sx={{
                      minWidth: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: '#e3f2fd',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      color: '#1565c0',
                      mt: 0.1,
                    }}
                  >
                    {i + 1}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '1.05rem',
                      lineHeight: 1.7,
                      color: '#333',
                    }}
                  >
                    {feature}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Typography sx={{ fontSize: '1.1rem', color: '#888' }}>
              「{decodedZoneName}」の情報が見つかりませんでした。
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
