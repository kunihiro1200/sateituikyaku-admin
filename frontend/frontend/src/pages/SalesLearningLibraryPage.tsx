/**
 * 📚 営業学習ライブラリ
 * 専任媒介・他決分析のQ&A回答を一覧表示する学習コンテンツページ
 * /sales-learning-library
 */
import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Chip, CircularProgress, Alert, Button,
  Divider, Select, MenuItem, FormControl, InputLabel, Collapse,
  Card, CardContent, IconButton,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import api from '../services/api';

interface QaEntry {
  id: string;
  type: 'exclusive' | 'otherDecision';
  assignee: string;
  targetMonth: string;       // YYYY-MM
  monthLabel: string;        // 例: 2026年6月
  caseCount: number;
  aiAnalysis: string;
  questions: { id: string; question: string }[];
  answers: { questionId: string; answer: string }[];
}

export default function SalesLearningLibraryPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<QaEntry[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    try {
      setLoading(true);
      const [exclusiveRes, otherRes] = await Promise.all([
        api.get('/api/sellers/learning-library/exclusive'),
        api.get('/api/sellers/learning-library/other-decision'),
      ]);

      const exclusiveEntries: QaEntry[] = (exclusiveRes.data.entries || []).map((e: any) => ({
        ...e, type: 'exclusive' as const,
        monthLabel: formatMonthLabel(e.targetMonth),
      }));
      const otherEntries: QaEntry[] = (otherRes.data.entries || []).map((e: any) => ({
        ...e, type: 'otherDecision' as const,
        monthLabel: formatMonthLabel(e.targetMonth),
      }));

      const all = [...exclusiveEntries, ...otherEntries]
        .sort((a, b) => b.targetMonth.localeCompare(a.targetMonth) || a.assignee.localeCompare(b.assignee));
      setEntries(all);

      // 最新月を自動選択
      if (all.length > 0) {
        setFilterMonth(all[0].targetMonth);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatMonthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${y}年${parseInt(m)}月`;
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // フィルタリング
  const filtered = entries.filter(e => {
    if (filterAssignee !== 'all' && e.assignee !== filterAssignee) return false;
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (filterMonth !== 'all' && e.targetMonth !== filterMonth) return false;
    // 回答が1つ以上ある or AI分析あり のものだけ表示
    return e.aiAnalysis || e.answers.some(a => a.answer?.trim());
  });

  // フィルター選択肢
  const assignees = [...new Set(entries.map(e => e.assignee))].sort();
  const months = [...new Set(entries.map(e => e.targetMonth))].sort((a, b) => b.localeCompare(a));

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* ヘッダー */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f3e5f5', borderLeft: '4px solid #9c27b0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon sx={{ color: '#9c27b0', fontSize: 28 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>📚 営業学習ライブラリ</Typography>
            <Typography variant="caption" color="text.secondary">
              専任媒介取得・他決の担当者インタビューを蓄積した学習コンテンツです
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* フィルター */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>月</InputLabel>
          <Select value={filterMonth} label="月" onChange={e => setFilterMonth(e.target.value)}>
            <MenuItem value="all">全期間</MenuItem>
            {months.map(m => <MenuItem key={m} value={m}>{formatMonthLabel(m)}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>担当者</InputLabel>
          <Select value={filterAssignee} label="担当者" onChange={e => setFilterAssignee(e.target.value)}>
            <MenuItem value="all">全員</MenuItem>
            {assignees.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>種別</InputLabel>
          <Select value={filterType} label="種別" onChange={e => setFilterType(e.target.value)}>
            <MenuItem value="all">専任＋他決</MenuItem>
            <MenuItem value="exclusive">専任媒介のみ</MenuItem>
            <MenuItem value="otherDecision">他決のみ</MenuItem>
          </Select>
        </FormControl>
        <Button variant="outlined" size="small" onClick={fetchLibrary} sx={{ ml: 'auto' }}>
          更新
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Alert severity="info">
          該当するQ&Aがありません。担当者が分析ページで質問に回答すると、ここに表示されます。
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.map(entry => {
            const isExclusive = entry.type === 'exclusive';
            const color = isExclusive ? '#ff6d00' : '#e53935';
            const bgColor = isExclusive ? '#fff3e0' : '#fce4ec';
            const isExpanded = expandedIds.has(entry.id);
            const answeredCount = entry.answers.filter(a => a.answer?.trim()).length;

            return (
              <Card key={entry.id} sx={{ border: `1px solid ${color}40`, boxShadow: 1 }}>
                {/* カードヘッダー */}
                <Box
                  sx={{ p: 2, bgcolor: bgColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  onClick={() => toggleExpand(entry.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    {isExclusive
                      ? <EmojiEventsIcon sx={{ color, fontSize: 20 }} />
                      : <TrendingDownIcon sx={{ color, fontSize: 20 }} />}
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color }}>
                      {entry.assignee}
                    </Typography>
                    <Chip
                      label={entry.monthLabel}
                      size="small"
                      sx={{ bgcolor: color, color: '#fff', fontWeight: 'bold', height: 22 }}
                    />
                    <Chip
                      label={isExclusive ? `専任 ${entry.caseCount}件` : `他決 ${entry.caseCount}件`}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: color, color, height: 22 }}
                    />
                    {answeredCount > 0 && (
                      <Chip
                        label={`Q&A ${answeredCount}問`}
                        size="small"
                        sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', height: 22, fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                  <IconButton size="small">
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>

                <Collapse in={isExpanded}>
                  <CardContent sx={{ pt: 2 }}>
                    {/* AI分析 */}
                    {entry.aiAnalysis && (
                      <Box sx={{ mb: 2, p: 1.5, bgcolor: '#fafafa', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                          <AutoAwesomeIcon sx={{ fontSize: 14, color: '#9c27b0' }} />
                          <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#9c27b0' }}>AI分析</Typography>
                        </Box>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.82rem' }}>
                          {entry.aiAnalysis}
                        </Typography>
                      </Box>
                    )}

                    {/* Q&A */}
                    {entry.questions.length > 0 && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Divider sx={{ my: 1 }}>
                          <Typography variant="caption" color="text.secondary">担当者インタビュー</Typography>
                        </Divider>
                        {entry.questions.map((q, idx) => {
                          const ans = entry.answers.find(a => a.questionId === q.id)?.answer?.trim();
                          return (
                            <Box key={q.id}>
                              <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                                <Chip label={`Q${idx + 1}`} size="small" sx={{ bgcolor: color, color: '#fff', fontWeight: 'bold', height: 20, minWidth: 32, fontSize: '0.7rem' }} />
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#333', lineHeight: 1.5 }}>{q.question}</Typography>
                              </Box>
                              {ans ? (
                                <Box sx={{ ml: 5, p: 1.5, bgcolor: '#f9f9f9', borderLeft: `3px solid ${color}`, borderRadius: '0 4px 4px 0' }}>
                                  <Typography variant="body2" sx={{ lineHeight: 1.7, color: '#333' }}>{ans}</Typography>
                                </Box>
                              ) : (
                                <Box sx={{ ml: 5 }}>
                                  <Typography variant="caption" color="text.disabled" fontStyle="italic">未回答</Typography>
                                </Box>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    )}

                    {entry.questions.length === 0 && !entry.aiAnalysis && (
                      <Typography variant="body2" color="text.secondary">Q&Aがまだ記入されていません。</Typography>
                    )}
                  </CardContent>
                </Collapse>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
