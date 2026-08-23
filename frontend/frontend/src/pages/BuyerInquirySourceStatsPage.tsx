import { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Tabs,
  Tab,
  Collapse,
  IconButton,
  Link,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { SECTION_COLORS } from '../theme/sectionColors';

interface SourceData {
  phone: number;
  email: number;
}

interface MonthlyStats {
  month: string;
  sources: Record<string, SourceData>;
}

interface InquirySourceStats {
  fukuoka: MonthlyStats[];
  oita: MonthlyStats[];
}

interface Buyer {
  buyer_number: string;
  name: string;
  inquiry_source: string;
  reception_date: string;
}

export default function BuyerInquirySourceStatsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<InquirySourceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'fukuoka' | 'oita'>('oita');
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [monthBuyers, setMonthBuyers] = useState<Buyer[]>([]);
  const [loadingBuyers, setLoadingBuyers] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/buyers/inquiry-source-monthly-stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch inquiry source stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthBuyers = async (month: string, area: 'fukuoka' | 'oita') => {
    try {
      setLoadingBuyers(true);
      const response = await api.get('/api/buyers', {
        params: {
          page: 1,
          limit: 1000,
          sortBy: 'reception_date',
          sortOrder: 'desc',
        }
      });

      // クライアント側でフィルタリング
      const filtered = response.data.data.filter((buyer: any) => {
        const buyerMonth = buyer.reception_date?.substring(0, 7);
        const isFukuoka = buyer.buyer_number?.startsWith('FK');
        const isTargetArea = area === 'fukuoka' ? isFukuoka : !isFukuoka;
        return buyerMonth === month && isTargetArea && buyer.inquiry_source;
      });

      setMonthBuyers(filtered);
    } catch (error) {
      console.error('Failed to fetch month buyers:', error);
    } finally {
      setLoadingBuyers(false);
    }
  };

  const handleMonthClick = async (month: string) => {
    if (expandedMonth === month) {
      setExpandedMonth(null);
      setMonthBuyers([]);
    } else {
      setExpandedMonth(month);
      await fetchMonthBuyers(month, activeTab);
    }
  };

  // 全問合せ元を抽出（重複なし、指定順でソート）
  const getAllSources = (data: MonthlyStats[], area: 'fukuoka' | 'oita') => {
    const sourcesSet = new Set<string>();
    data.forEach(monthData => {
      Object.keys(monthData.sources).forEach(source => {
        // 福岡の場合は「いふうHP」を除外
        if (area === 'fukuoka' && source === 'いふうHP') {
          return;
        }
        sourcesSet.add(source);
      });
    });
    
    const sources = Array.from(sourcesSet);
    
    // カスタムソート順: at home/athome → スーモ/SUUMO → いふうHP → その他（アルファベット順）
    const priorityOrder = ['at home', 'athome', 'スーモ', 'SUUMO', 'いふうHP'];
    
    return sources.sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a);
      const bIndex = priorityOrder.indexOf(b);
      
      // 両方とも優先リストにある場合
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // aのみ優先リストにある場合
      if (aIndex !== -1) {
        return -1;
      }
      
      // bのみ優先リストにある場合
      if (bIndex !== -1) {
        return 1;
      }
      
      // 両方とも優先リストにない場合はアルファベット順
      return a.localeCompare(b);
    });
  };

  const renderTable = (data: MonthlyStats[], title: string, area: 'fukuoka' | 'oita') => {
    if (!data || data.length === 0) {
      return (
        <Typography align="center" sx={{ py: 4 }}>
          データがありません
        </Typography>
      );
    }

    const allSources = getAllSources(data, area);

    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 50 }}></TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>月</TableCell>
              {allSources.map(source => (
                <TableCell
                  key={source}
                  align="center"
                  colSpan={2}
                  sx={{ fontWeight: 'bold', borderLeft: '2px solid #ddd' }}
                >
                  {source}
                </TableCell>
              ))}
              <TableCell align="center" colSpan={2} sx={{ fontWeight: 'bold', bgcolor: '#e8f5e9', borderLeft: '2px solid #ddd' }}>
                合計
              </TableCell>
            </TableRow>
            <TableRow sx={{ bgcolor: '#fafafa' }}>
              <TableCell></TableCell>
              <TableCell></TableCell>
              {allSources.map(source => (
                <>
                  <TableCell key={`${source}-phone`} align="right" sx={{ fontSize: '0.75rem', color: '#666', borderLeft: '2px solid #ddd' }}>
                    電話
                  </TableCell>
                  <TableCell key={`${source}-email`} align="right" sx={{ fontSize: '0.75rem', color: '#666' }}>
                    メール
                  </TableCell>
                </>
              ))}
              <TableCell align="right" sx={{ fontSize: '0.75rem', color: '#666', bgcolor: '#e8f5e9', borderLeft: '2px solid #ddd' }}>
                電話
              </TableCell>
              <TableCell align="right" sx={{ fontSize: '0.75rem', color: '#666', bgcolor: '#e8f5e9' }}>
                メール
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((monthData) => {
              const isExpanded = expandedMonth === monthData.month;
              let totalPhone = 0;
              let totalEmail = 0;
              Object.values(monthData.sources).forEach(sourceData => {
                totalPhone += sourceData.phone || 0;
                totalEmail += sourceData.email || 0;
              });

              return (
                <>
                  <TableRow
                    key={monthData.month}
                    hover
                    sx={{
                      cursor: 'pointer',
                      bgcolor: isExpanded ? '#f5f5f5' : 'inherit'
                    }}
                    onClick={() => handleMonthClick(monthData.month)}
                  >
                    <TableCell>
                      <IconButton size="small">
                        {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      {monthData.month}
                    </TableCell>
                    {allSources.map(source => {
                      const sourceData = monthData.sources[source] || { phone: 0, email: 0 };
                      return (
                        <>
                          <TableCell key={`${source}-phone`} align="right" sx={{ bgcolor: '#e3f2fd', borderLeft: '2px solid #ddd' }}>
                            {sourceData.phone || '-'}
                          </TableCell>
                          <TableCell key={`${source}-email`} align="right" sx={{ bgcolor: '#fff3e0' }}>
                            {sourceData.email || '-'}
                          </TableCell>
                        </>
                      );
                    })}
                    <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd', borderLeft: '2px solid #ddd' }}>
                      {totalPhone}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#fff3e0' }}>
                      {totalEmail}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={2 + allSources.length * 2 + 2}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 2, px: 3, bgcolor: '#fafafa' }}>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                            {monthData.month} の買主一覧（{monthBuyers.length}件）
                          </Typography>
                          {loadingBuyers ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                              <CircularProgress size={24} />
                            </Box>
                          ) : monthBuyers.length > 0 ? (
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                  <TableCell sx={{ fontWeight: 'bold' }}>買主番号</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold' }}>氏名</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold' }}>問合せ元</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold' }}>受付日</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {monthBuyers.map((buyer) => (
                                  <TableRow key={buyer.buyer_number} hover>
                                    <TableCell>
                                      <Link
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/buyers/${buyer.buyer_number}`);
                                        }}
                                        sx={{ cursor: 'pointer', color: SECTION_COLORS.buyer.main }}
                                      >
                                        {buyer.buyer_number}
                                      </Link>
                                    </TableCell>
                                    <TableCell>{buyer.name || '-'}</TableCell>
                                    <TableCell>{buyer.inquiry_source || '-'}</TableCell>
                                    <TableCell>{buyer.reception_date || '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <Typography variant="body2" sx={{ color: '#999' }}>
                              買主データがありません
                            </Typography>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/buyers')}
          sx={{ mr: 2 }}
        >
          買主リストに戻る
        </Button>
        <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.buyer.main }}>
          問合せ元 月次統計
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper sx={{ p: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => {
              setActiveTab(newValue);
              setExpandedMonth(null);
              setMonthBuyers([]);
            }}
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
          >
            <Tab
              label="大分"
              value="oita"
              sx={{
                fontWeight: activeTab === 'oita' ? 'bold' : 'normal',
                fontSize: '1.1rem',
              }}
            />
            <Tab
              label="福岡"
              value="fukuoka"
              sx={{
                fontWeight: activeTab === 'fukuoka' ? 'bold' : 'normal',
                fontSize: '1.1rem',
              }}
            />
          </Tabs>

          {activeTab === 'oita' && stats?.oita && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2, color: SECTION_COLORS.buyer.main }}>
                大分の問合せ元（受付日基準）
              </Typography>
              {renderTable(stats.oita, '大分', 'oita')}
            </Box>
          )}

          {activeTab === 'fukuoka' && stats?.fukuoka && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2, color: '#d32f2f' }}>
                福岡の問合せ元（受付日基準）
              </Typography>
              {renderTable(stats.fukuoka, '福岡', 'fukuoka')}
            </Box>
          )}
        </Paper>
      )}
    </Container>
  );
}
