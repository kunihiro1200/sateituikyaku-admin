/**
 * 📚 営業学習ライブラリ
 * 専任取得・他決のQ&A回答を「問題・場面テーマ別」にグループ化して表示
 * 担当者ではなく「どんな場面か」で分類し、複数担当者の知見を横断的に学べる
 */
import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Chip, Alert, Button,
  Divider, Card, Collapse, IconButton, Tab, Tabs, Avatar,
  Skeleton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import BlockIcon from '@mui/icons-material/Block';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import api from '../services/api';

// ── 型定義 ────────────────────────────────────────────
interface QAEntry {
  id: string;
  assignee: string;
  targetMonth: string;
  questions: { id: string; question: string }[];
  answers: { questionId: string; answer: string }[];
  caseCount: number;
}

interface QAPair {
  assignee: string;
  targetMonth: string;
  question: string;
  answer: string;
}

interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
  keywords: string[];
  pairs: QAPair[];
}

// ── カテゴリ定義 ──────────────────────────────────────

const EXCLUSIVE_CATEGORIES: Omit<Category, 'pairs'>[] = [
  {
    id: 'approach',
    label: '最初のアプローチ・第一印象',
    icon: '🚀',
    color: '#1976d2',
    keywords: ['最初', 'アプローチ', '第一', '初回', '連絡', 'きっかけ', '最初の'],
  },
  {
    id: 'valuation',
    label: '査定・価格の説明',
    icon: '💰',
    color: '#388e3c',
    keywords: ['査定', '価格', '金額', '提示', '根拠', '説明', '高く', '安く', '相場'],
  },
  {
    id: 'competitor',
    label: '競合との差別化',
    icon: '🏆',
    color: '#f57c00',
    keywords: ['競合', '他社', '差別化', '勝て', '負け', '比較', '選ばれ', '選んで'],
  },
  {
    id: 'trust',
    label: '信頼関係・売主の不安解消',
    icon: '🤝',
    color: '#7b1fa2',
    keywords: ['信頼', '不安', '安心', '関係', '心配', '解消', '寄り添', '気持ち'],
  },
  {
    id: 'visit',
    label: '訪問・提案の工夫',
    icon: '🏠',
    color: '#0288d1',
    keywords: ['訪問', '提案', '工夫', '資料', 'プレゼン', '説明方法', '伝え方', '見せ'],
  },
  {
    id: 'closing',
    label: 'クロージング・専任取得の決め手',
    icon: '🎯',
    color: '#c2185b',
    keywords: ['クロージング', '決め手', '専任', '取得', '契約', '決断', 'サイン', '押し'],
  },
  {
    id: 'other',
    label: 'その他',
    icon: '💬',
    color: '#546e7a',
    keywords: [],
  },
];

const OTHER_CATEGORIES: Omit<Category, 'pairs'>[] = [
  {
    id: 'price_gap',
    label: '価格・査定の折り合いがつかなかった',
    icon: '💸',
    color: '#d32f2f',
    keywords: ['価格', '査定', '金額', '高い', '安い', '相場', '折り合い'],
  },
  {
    id: 'speed',
    label: 'タイミング・スピードの問題',
    icon: '⏰',
    color: '#f57c00',
    keywords: ['タイミング', 'スピード', '早く', '遅く', '先に', '間に合', 'すでに', '既に'],
  },
  {
    id: 'competitor_lose',
    label: '競合他社に負けた要因',
    icon: '😞',
    color: '#7b1fa2',
    keywords: ['競合', '他社', '負け', '選ばれなかった', '決め', '比べ'],
  },
  {
    id: 'relationship',
    label: '売主との関係構築の課題',
    icon: '🔗',
    color: '#1976d2',
    keywords: ['関係', '信頼', '距離', '警戒', '不信', 'コミュニケーション'],
  },
  {
    id: 'prevention',
    label: '次回への対策・防ぎ方',
    icon: '🛡️',
    color: '#388e3c',
    keywords: ['次回', '対策', '防ぐ', '改善', '反省', '教訓', '次は', 'すべき'],
  },
  {
    id: 'other',
    label: 'その他',
    icon: '💬',
    color: '#546e7a',
    keywords: [],
  },
];

// ── ユーティリティ ─────────────────────────────────────

function formatMonth(ym: string) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${y}年${parseInt(m)}月`;
}

function getInitialColor(name: string): string {
  const colors = ['#1976d2', '#388e3c', '#d32f2f', '#7b1fa2', '#f57c00', '#0288d1', '#c2185b', '#455a64'];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function classifyPair(pair: QAPair, catDefs: Omit<Category, 'pairs'>[]): string {
  const text = pair.question + ' ' + pair.answer;
  for (const cat of catDefs) {
    if (cat.id === 'other') continue;
    if (cat.keywords.some(kw => text.includes(kw))) return cat.id;
  }
  return 'other';
}

function buildCategories(entries: QAEntry[], catDefs: Omit<Category, 'pairs'>[]): Category[] {
  const allPairs: QAPair[] = [];

  for (const entry of entries) {
    for (const q of entry.questions || []) {
      const ans = (entry.answers || []).find(a => a.questionId === q.id);
      if (ans?.answer?.trim()) {
        allPairs.push({
          assignee: entry.assignee,
          targetMonth: entry.targetMonth,
          question: q.question,
          answer: ans.answer.trim(),
        });
      }
    }
  }

  const catMap = new Map<string, QAPair[]>();
  for (const def of catDefs) catMap.set(def.id, []);

  for (const pair of allPairs) {
    const catId = classifyPair(pair, catDefs);
    catMap.get(catId)!.push(pair);
  }

  return catDefs
    .map(def => ({ ...def, pairs: catMap.get(def.id)! }))
    .filter(cat => cat.pairs.length > 0);
}

// ── サブコンポーネント ─────────────────────────────────

function AnswerCard({ pair, color }: { pair: QAPair; color: string }) {
  const [open, setOpen] = useState(false);
  const avatarColor = getInitialColor(pair.assignee);

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderColor: open ? color : '#e0e0e0',
        transition: 'border-color 0.2s',
      }}
    >
      {/* 質問行 */}
      <Box
        onClick={() => setOpen(v => !v)}
        sx={{
          px: 2, py: 1.5, cursor: 'pointer',
          bgcolor: open ? `${color}10` : '#fafafa',
          display: 'flex', alignItems: 'flex-start', gap: 1.5,
          '&:hover': { bgcolor: `${color}10` },
        }}
      >
        {/* 担当者アバター */}
        <Avatar
          sx={{
            bgcolor: avatarColor,
            width: 28, height: 28,
            fontSize: '0.72rem', fontWeight: 'bold', flexShrink: 0, mt: 0.2,
          }}
        >
          {pair.assignee.slice(0, 1)}
        </Avatar>

        <Box sx={{ flex: 1 }}>
          {/* 担当者名・月 */}
          <Box sx={{ display: 'flex', gap: 0.8, mb: 0.5, flexWrap: 'wrap' }}>
            <Chip
              label={pair.assignee}
              size="small"
              sx={{ bgcolor: avatarColor, color: '#fff', fontWeight: 'bold', height: 18, fontSize: '0.65rem' }}
            />
            <Chip
              label={formatMonth(pair.targetMonth)}
              size="small"
              variant="outlined"
              sx={{ height: 18, fontSize: '0.65rem', borderColor: '#ccc', color: '#666' }}
            />
          </Box>
          {/* 質問文 */}
          <Typography variant="body2" sx={{ color: '#555', fontSize: '0.82rem', lineHeight: 1.5 }}>
            ❓ {pair.question}
          </Typography>
        </Box>

        <IconButton size="small" sx={{ flexShrink: 0, mt: -0.3, color }}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* 回答（展開時） */}
      <Collapse in={open}>
        <Divider />
        <Box sx={{ px: 2.5, py: 2, bgcolor: '#fff' }}>
          <Typography variant="caption" sx={{ color, fontWeight: 'bold', display: 'block', mb: 1 }}>
            💬 {pair.assignee}の回答
          </Typography>
          <Typography
            variant="body2"
            sx={{ lineHeight: 1.9, color: '#333', whiteSpace: 'pre-wrap' }}
          >
            {pair.answer}
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
}

function CategorySection({ cat, defaultOpen }: { cat: Category; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card sx={{ border: `2px solid ${open ? cat.color : '#e0e0e0'}`, boxShadow: open ? 3 : 1, transition: 'all 0.2s' }}>
      {/* カテゴリヘッダー */}
      <Box
        onClick={() => setOpen(v => !v)}
        sx={{
          px: 2, py: 1.8, cursor: 'pointer',
          bgcolor: open ? `${cat.color}10` : '#fff',
          display: 'flex', alignItems: 'center', gap: 1.5,
          '&:hover': { bgcolor: `${cat.color}10` },
        }}
      >
        <Typography sx={{ fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }}>{cat.icon}</Typography>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333', lineHeight: 1.2 }}>
            {cat.label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {cat.pairs.length}件の回答
          </Typography>
        </Box>
        <Chip
          label={`${cat.pairs.length}件`}
          size="small"
          sx={{ bgcolor: cat.color, color: '#fff', fontWeight: 'bold', fontSize: '0.72rem' }}
        />
        <IconButton size="small" sx={{ color: cat.color }}>
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      {/* 回答一覧 */}
      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {cat.pairs.map((pair, i) => (
            <AnswerCard key={i} pair={pair} color={cat.color} />
          ))}
        </Box>
      </Collapse>
    </Card>
  );
}

function LibraryTab({ type }: { type: 'exclusive' | 'other' }) {
  const catDefs = type === 'exclusive' ? EXCLUSIVE_CATEGORIES : OTHER_CATEGORIES;
  const accentColor = type === 'exclusive' ? '#f57c00' : '#d32f2f';

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalAnswers, setTotalAnswers] = useState(0);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const url =
        type === 'exclusive'
          ? '/api/sellers/learning-library/exclusive'
          : '/api/sellers/learning-library/other-decision';
      const res = await api.get(url);
      const entries: QAEntry[] = res.data.entries || [];
      const cats = buildCategories(entries, catDefs);
      setCategories(cats);
      setTotalAnswers(cats.reduce((s, c) => s + c.pairs.length, 0));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [type]);

  if (loading) {
    return (
      <Box>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} variant="rounded" height={72} sx={{ mb: 1.5, borderRadius: 2 }} />
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={<Button size="small" onClick={load}>再試行</Button>}>
        {error}
      </Alert>
    );
  }

  if (categories.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <QuestionAnswerIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
        <Typography color="text.secondary">まだ回答データがありません。</Typography>
        <Typography variant="caption" color="text.secondary">
          分析ページで担当者が質問に回答すると、ここに表示されます。
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* サマリー */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip
          label={`${categories.length}テーマ`}
          sx={{ bgcolor: `${accentColor}20`, color: accentColor, fontWeight: 'bold' }}
        />
        <Chip
          label={`計${totalAnswers}件の知見`}
          sx={{ bgcolor: `${accentColor}20`, color: accentColor, fontWeight: 'bold' }}
        />
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={load}
          sx={{ color: accentColor, borderColor: accentColor, ml: 'auto' }}
          variant="outlined"
        >
          更新
        </Button>
      </Box>

      {/* テーマ別カード */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {categories.map((cat, i) => (
          <CategorySection key={cat.id} cat={cat} defaultOpen={i === 0} />
        ))}
      </Box>
    </Box>
  );
}

// ── メインページ ──────────────────────────────────────────

export default function SalesLearningLibraryPage() {
  const [tab, setTab] = useState<0 | 1>(0);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* ヘッダー */}
      <Paper sx={{ p: 2.5, mb: 3, bgcolor: '#f3e5f5', borderLeft: '4px solid #9c27b0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#6a1b9a' }}>
            📚 営業学習ライブラリ
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          専任取得・他決の場面ごとに、先輩担当者たちが実際にどう乗り切ったかをまとめています。
          テーマを選んで、複数の担当者の言葉をまとめて学べます。
        </Typography>
      </Paper>

      {/* タブ */}
      <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': { fontWeight: 'bold', fontSize: '0.95rem', py: 1.5 },
            '& .Mui-selected': { color: tab === 0 ? '#f57c00' : '#d32f2f' },
            '& .MuiTabs-indicator': { bgcolor: tab === 0 ? '#f57c00' : '#d32f2f', height: 3 },
          }}
        >
          <Tab icon={<EmojiEventsIcon />} iconPosition="start" label="専任取得" />
          <Tab icon={<BlockIcon />} iconPosition="start" label="他決（競合負け）" />
        </Tabs>
      </Paper>

      {/* タブコンテンツ */}
      {tab === 0 && <LibraryTab key="exclusive" type="exclusive" />}
      {tab === 1 && <LibraryTab key="other" type="other" />}
    </Box>
  );
}
