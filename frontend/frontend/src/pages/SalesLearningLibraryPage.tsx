/**
 * 📚 営業学習ライブラリ
 * 専任取得・他決それぞれの担当者インタビューをグループ別に表示
 * AIによるリアルタイム生成は行わず、登録済み回答をそのまま表示
 */
import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Chip, CircularProgress, Alert, Button,
  Divider, Card, Collapse, IconButton, Tab, Tabs, Avatar,
  Skeleton, Badge,
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
  aiAnalysis: string;
  questions: { id: string; question: string }[];
  answers: { questionId: string; answer: string }[];
  caseCount: number;
}

// 回答済みQ&Aペアに変換した型
interface QAPair {
  question: string;
  answer: string;
}

// 担当者ごとにまとめた型
interface AssigneeGroup {
  assignee: string;
  entries: (QAEntry & { qaPairs: QAPair[] })[];
  totalAnswers: number;
}

// ── ユーティリティ ─────────────────────────────────────
function formatMonth(ym: string) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${y}年${parseInt(m)}月`;
}

function getInitialColor(name: string): string {
  const colors = [
    '#1976d2', '#388e3c', '#d32f2f', '#7b1fa2',
    '#f57c00', '#0288d1', '#c2185b', '#455a64',
  ];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function buildAssigneeGroups(entries: QAEntry[]): AssigneeGroup[] {
  const map = new Map<string, AssigneeGroup>();

  for (const entry of entries) {
    const qaPairs: QAPair[] = (entry.questions || []).flatMap(q => {
      const ans = (entry.answers || []).find(a => a.questionId === q.id);
      if (!ans?.answer?.trim()) return [];
      return [{ question: q.question, answer: ans.answer.trim() }];
    });

    const enriched = { ...entry, qaPairs };

    if (!map.has(entry.assignee)) {
      map.set(entry.assignee, { assignee: entry.assignee, entries: [], totalAnswers: 0 });
    }
    const group = map.get(entry.assignee)!;
    group.entries.push(enriched);
    group.totalAnswers += qaPairs.length;
  }

  return Array.from(map.values()).sort((a, b) => b.totalAnswers - a.totalAnswers);
}

// ── サブコンポーネント ─────────────────────────────────

function QACard({ pair, idx, color }: { pair: QAPair; idx: number; color: string }) {
  const [open, setOpen] = useState(false);

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
        <Chip
          label={`Q${idx + 1}`}
          size="small"
          sx={{ bgcolor: color, color: '#fff', fontWeight: 'bold', height: 20, fontSize: '0.65rem', flexShrink: 0, mt: 0.2 }}
        />
        <Typography variant="body2" sx={{ flex: 1, fontWeight: open ? 'bold' : 'normal', color: '#333', lineHeight: 1.6 }}>
          {pair.question}
        </Typography>
        <IconButton size="small" sx={{ flexShrink: 0, mt: -0.3, color }}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* 回答（展開時） */}
      <Collapse in={open}>
        <Divider />
        <Box sx={{ px: 2.5, py: 2, bgcolor: '#fff' }}>
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

function EntrySection({
  entry,
  color,
  defaultOpen,
}: {
  entry: QAEntry & { qaPairs: QAPair[] };
  color: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (entry.qaPairs.length === 0) return null;

  return (
    <Box sx={{ mb: 1.5 }}>
      {/* 月ヘッダー */}
      <Box
        onClick={() => setOpen(v => !v)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, py: 0.8, px: 1,
          cursor: 'pointer', borderRadius: 1,
          '&:hover': { bgcolor: '#f5f5f5' },
        }}
      >
        <Chip
          label={formatMonth(entry.targetMonth)}
          size="small"
          variant="outlined"
          sx={{ borderColor: color, color, fontWeight: 'bold', fontSize: '0.72rem' }}
        />
        <Chip
          label={`${entry.qaPairs.length}件の回答`}
          size="small"
          sx={{ bgcolor: '#f5f5f5', color: '#666', fontSize: '0.68rem' }}
        />
        {entry.caseCount > 0 && (
          <Chip
            label={`${entry.caseCount}案件`}
            size="small"
            sx={{ bgcolor: `${color}20`, color, fontSize: '0.68rem' }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" sx={{ color: '#999' }}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={open}>
        <Box sx={{ pl: 1, display: 'flex', flexDirection: 'column', gap: 0.8, mt: 0.5 }}>
          {entry.qaPairs.map((pair, i) => (
            <QACard key={i} pair={pair} idx={i} color={color} />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

function AssigneeCard({
  group,
  color,
  defaultOpen,
}: {
  group: AssigneeGroup;
  color: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const avatarColor = getInitialColor(group.assignee);

  return (
    <Card sx={{ border: `2px solid ${open ? color : '#e0e0e0'}`, boxShadow: open ? 3 : 1, transition: 'all 0.2s' }}>
      {/* 担当者ヘッダー */}
      <Box
        onClick={() => setOpen(v => !v)}
        sx={{
          px: 2, py: 1.8, cursor: 'pointer',
          bgcolor: open ? `${color}08` : '#fff',
          display: 'flex', alignItems: 'center', gap: 1.5,
          '&:hover': { bgcolor: `${color}08` },
        }}
      >
        <Avatar
          sx={{
            bgcolor: avatarColor,
            width: 36, height: 36,
            fontSize: '0.85rem', fontWeight: 'bold', flexShrink: 0,
          }}
        >
          {group.assignee.slice(0, 1)}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333', lineHeight: 1.2 }}>
            {group.assignee}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {group.entries.length}ヶ月分・{group.totalAnswers}件の回答
          </Typography>
        </Box>
        <Chip
          label={`${group.totalAnswers}件`}
          size="small"
          sx={{ bgcolor: color, color: '#fff', fontWeight: 'bold', fontSize: '0.72rem' }}
        />
        <IconButton size="small" sx={{ color }}>
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      {/* 月別エントリー */}
      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2 }}>
          {group.entries.map((entry, i) => (
            <EntrySection
              key={entry.id}
              entry={entry}
              color={color}
              defaultOpen={i === 0}
            />
          ))}
        </Box>
      </Collapse>
    </Card>
  );
}

function LibraryTab({
  type,
  color,
  icon,
}: {
  type: 'exclusive' | 'other';
  color: string;
  icon: React.ReactNode;
}) {
  const [groups, setGroups] = useState<AssigneeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setGroups(buildAssigneeGroups(entries));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [type]);

  const totalAnswers = groups.reduce((s, g) => s + g.totalAnswers, 0);

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

  if (groups.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <QuestionAnswerIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
        <Typography color="text.secondary">
          まだ回答データがありません。
        </Typography>
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
          label={`${groups.length}名の担当者`}
          sx={{ bgcolor: `${color}20`, color, fontWeight: 'bold' }}
        />
        <Chip
          label={`計${totalAnswers}件の回答`}
          sx={{ bgcolor: `${color}20`, color, fontWeight: 'bold' }}
        />
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={load}
          sx={{ color, borderColor: color, ml: 'auto' }}
          variant="outlined"
        >
          更新
        </Button>
      </Box>

      {/* 担当者別カード */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {groups.map((group, i) => (
          <AssigneeCard
            key={group.assignee}
            group={group}
            color={color}
            defaultOpen={i === 0}
          />
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
          専任取得・他決それぞれの場面で、各担当者が実際にどう乗り切ったかをまとめています。
          後輩は先輩の言葉をそのまま読んで学べます。
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
          <Tab
            icon={<EmojiEventsIcon />}
            iconPosition="start"
            label="専任取得"
          />
          <Tab
            icon={<BlockIcon />}
            iconPosition="start"
            label="他決（競合負け）"
          />
        </Tabs>
      </Paper>

      {/* タブコンテンツ */}
      {tab === 0 && (
        <LibraryTab
          key="exclusive"
          type="exclusive"
          color="#f57c00"
          icon={<EmojiEventsIcon />}
        />
      )}
      {tab === 1 && (
        <LibraryTab
          key="other"
          type="other"
          color="#d32f2f"
          icon={<BlockIcon />}
        />
      )}
    </Box>
  );
}
