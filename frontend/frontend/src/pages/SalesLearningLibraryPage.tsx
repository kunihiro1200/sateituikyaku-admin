/**
 * 📚 営業学習ライブラリ（教科書モード）
 * AIが全Q&A回答を統合して生成する営業マニュアル
 * 回答が増えるたびに自動更新される
 */
import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Chip, CircularProgress, Alert, Button,
  Divider, Card, CardContent, Collapse, IconButton, LinearProgress,
  Skeleton,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../services/api';

interface Scenario {
  id: string;
  situation: string;
  question: string;
  answer: string;
  tips: string[];
}

interface Chapter {
  id: string;
  title: string;
  icon: string;
  summary: string;
  scenarios: Scenario[];
}

interface Textbook {
  lastUpdated: string;
  answerCount: number;
  chapters: Chapter[];
}

export default function SalesLearningLibraryPage() {
  const [loading, setLoading] = useState(true);
  const [textbook, setTextbook] = useState<Textbook | null>(null);
  const [answerCount, setAnswerCount] = useState(0);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set(['ch1']));
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetchTextbook();
  }, []);

  const fetchTextbook = async (forceRegenerate = false) => {
    try {
      setLoading(true);
      setError(null);
      const url = forceRegenerate
        ? '/api/sellers/learning-library/textbook?force=true'
        : '/api/sellers/learning-library/textbook';
      const res = await api.get(url);
      setTextbook(res.data.textbook);
      setAnswerCount(res.data.answerCount || 0);
      setCached(res.data.cached || false);
    } catch (err: any) {
      setError(err?.response?.data?.error || '教科書の生成に失敗しました');
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    await fetchTextbook(true);
  };

  const toggleScenario = (id: string) => {
    setExpandedScenarios(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleChapter = (id: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  // チャプターごとの配色
  const chapterColors: Record<string, { bg: string; border: string; text: string; chip: string }> = {
    ch1: { bg: '#fff3e0', border: '#ff6d00', text: '#e65100', chip: '#ff6d00' },
    ch2: { bg: '#fce4ec', border: '#e53935', text: '#c62828', chip: '#e53935' },
    ch3: { bg: '#e8f5e9', border: '#43a047', text: '#2e7d32', chip: '#43a047' },
    ch4: { bg: '#e3f2fd', border: '#1e88e5', text: '#1565c0', chip: '#1e88e5' },
    ch5: { bg: '#f3e5f5', border: '#8e24aa', text: '#6a1b9a', chip: '#8e24aa' },
  };

  const getChapterColor = (idx: number) => {
    const keys = Object.keys(chapterColors);
    return chapterColors[keys[idx % keys.length]];
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* ヘッダー */}
      <Paper sx={{ p: 2.5, mb: 3, bgcolor: '#f3e5f5', borderLeft: '4px solid #9c27b0' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <AutoAwesomeIcon sx={{ color: '#9c27b0', fontSize: 28 }} />
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#6a1b9a' }}>
                📚 営業学習ライブラリ
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              担当者のインタビュー回答をAIが統合した営業マニュアルです。
              回答が増えるたびに内容が自動更新されます。
            </Typography>
            {textbook && (
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={`${answerCount}件の回答を統合`}
                  size="small"
                  sx={{ bgcolor: '#9c27b0', color: '#fff', fontWeight: 'bold' }}
                />
                <Chip
                  label={cached ? `キャッシュ（${formatDate(textbook.lastUpdated)}）` : '最新版'}
                  size="small"
                  variant="outlined"
                  sx={{ borderColor: '#9c27b0', color: '#6a1b9a' }}
                />
              </Box>
            )}
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={regenerating ? <CircularProgress size={14} /> : <RefreshIcon />}
            onClick={handleRegenerate}
            disabled={loading || regenerating}
            sx={{ borderColor: '#9c27b0', color: '#9c27b0', whiteSpace: 'nowrap' }}
          >
            {regenerating ? '生成中...' : '最新に更新'}
          </Button>
        </Box>
      </Paper>

      {/* ローディング */}
      {loading && (
        <Box>
          <LinearProgress sx={{ mb: 2, borderRadius: 1 }} color="secondary" />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            AIが全データを統合して教科書を生成中です...（初回は20〜30秒かかります）
          </Typography>
          {[1, 2, 3].map(i => (
            <Box key={i} sx={{ mb: 2 }}>
              <Skeleton variant="rounded" height={80} sx={{ mb: 1 }} />
            </Box>
          ))}
        </Box>
      )}

      {/* エラー */}
      {error && !loading && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          <Button size="small" onClick={() => fetchTextbook()} sx={{ ml: 2 }}>再試行</Button>
        </Alert>
      )}

      {/* データ不足の案内 */}
      {!loading && textbook && answerCount < 5 && (
        <Alert severity="info" sx={{ mb: 2 }} icon={<AutoAwesomeIcon />}>
          <Typography variant="body2">
            <strong>現在{answerCount}件の回答データがあります。</strong>
            担当者が分析ページで質問に回答すると、教科書の内容が充実します。
            目安として10件以上の回答があると実践的な内容になります。
          </Typography>
        </Alert>
      )}

      {/* 教科書本体 */}
      {!loading && textbook && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(textbook.chapters || []).map((chapter, chIdx) => {
            const colors = getChapterColor(chIdx);
            const isExpanded = expandedChapters.has(chapter.id);

            return (
              <Card key={chapter.id} sx={{ border: `2px solid ${colors.border}`, boxShadow: 2 }}>
                {/* チャプターヘッダー */}
                <Box
                  sx={{
                    p: 2, bgcolor: colors.bg, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                  onClick={() => toggleChapter(chapter.id)}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: colors.text }}>
                      {chapter.icon} {chapter.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {chapter.summary}
                    </Typography>
                    <Chip
                      label={`${(chapter.scenarios || []).length}シナリオ`}
                      size="small"
                      sx={{ mt: 0.5, bgcolor: colors.chip, color: '#fff', height: 20, fontSize: '0.7rem' }}
                    />
                  </Box>
                  <IconButton size="small">
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>

                {/* シナリオ一覧 */}
                <Collapse in={isExpanded}>
                  <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {(chapter.scenarios || []).map((scenario, sIdx) => {
                      const scenarioKey = `${chapter.id}-${scenario.id}`;
                      const isScenarioExpanded = expandedScenarios.has(scenarioKey);

                      return (
                        <Paper key={scenario.id} variant="outlined" sx={{ overflow: 'hidden' }}>
                          {/* 状況 */}
                          <Box
                            sx={{
                              px: 2, py: 1.5,
                              bgcolor: isScenarioExpanded ? colors.bg : '#fafafa',
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1,
                              '&:hover': { bgcolor: colors.bg },
                            }}
                            onClick={() => toggleScenario(scenarioKey)}
                          >
                            <Box sx={{ flex: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Chip
                                  label={`場面 ${sIdx + 1}`}
                                  size="small"
                                  sx={{ bgcolor: colors.chip, color: '#fff', height: 18, fontSize: '0.65rem', minWidth: 52 }}
                                />
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: colors.text }}>
                                  {scenario.situation}
                                </Typography>
                              </Box>
                              <Typography variant="body2" color="text.secondary" sx={{ pl: 0.5 }}>
                                ❓ {scenario.question}
                              </Typography>
                            </Box>
                            <IconButton size="small" sx={{ flexShrink: 0, mt: -0.5 }}>
                              {isScenarioExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            </IconButton>
                          </Box>

                          {/* 回答（展開時） */}
                          <Collapse in={isScenarioExpanded}>
                            <Divider />
                            <Box sx={{ p: 2, bgcolor: '#fff' }}>
                              <Typography variant="caption" sx={{ color: colors.text, fontWeight: 'bold', display: 'block', mb: 1 }}>
                                💡 先輩担当者たちの実践から
                              </Typography>
                              <Typography variant="body2" sx={{ lineHeight: 1.8, color: '#333', mb: 1.5 }}>
                                {scenario.answer}
                              </Typography>

                              {scenario.tips && scenario.tips.length > 0 && (
                                <Box sx={{ bgcolor: colors.bg, borderRadius: 1, p: 1.5 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 'bold', color: colors.text, display: 'block', mb: 0.5 }}>
                                    ✅ ポイント
                                  </Typography>
                                  {scenario.tips.map((tip, tIdx) => (
                                    <Typography key={tIdx} variant="body2" sx={{ color: '#333', lineHeight: 1.7 }}>
                                      • {tip}
                                    </Typography>
                                  ))}
                                </Box>
                              )}
                            </Box>
                          </Collapse>
                        </Paper>
                      );
                    })}
                  </Box>
                </Collapse>
              </Card>
            );
          })}
        </Box>
      )}

      {/* フッター */}
      {!loading && textbook && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            このマニュアルは担当者の実際の回答をAIが統合して生成しています。
            回答が増えるほど内容が充実します。
          </Typography>
        </Box>
      )}
    </Box>
  );
}
