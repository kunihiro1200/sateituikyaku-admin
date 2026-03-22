import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import api from '../services/api';
import { SECTION_COLORS } from '../theme/sectionColors';

interface SharedItem {
  id: string;
  [key: string]: any;
}

interface Staff {
  name: string;
  is_normal: boolean;
}

export default function SharedItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sharedItemsColor = SECTION_COLORS.sharedItems;
  const [item, setItem] = useState<SharedItem | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItem();
    fetchStaff();
  }, [id]);

  const fetchItem = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/shared-items');
      const items = response.data.data || [];
      const foundItem = items.find((i: SharedItem) => i.id === id);
      
      setItem(foundItem || null);
    } catch (error) {
      console.error('Failed to fetch shared item:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await api.get('/api/shared-items/staff');
      setStaff(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch staff:', error);
    }
  };

  const handleBack = () => {
    navigate('/shared-items');
  };

  // 日付フォーマット関数（バックエンドで既に変換済みなのでそのまま返す）
  const formatDateForInput = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    return dateStr;
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography>読み込み中...</Typography>
      </Container>
    );
  }

  if (!item) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography>データが見つかりませんでした</Typography>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          戻る
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            sx={{ color: sharedItemsColor.main }}
          >
            戻る
          </Button>
          <Typography variant="h5" fontWeight="bold" sx={{ color: sharedItemsColor.main }}>
            共有詳細
          </Typography>
        </Box>
        <Button
          variant="contained"
          sx={{
            bgcolor: sharedItemsColor.main,
            color: '#fff',
            '&:hover': {
              bgcolor: sharedItemsColor.dark,
            },
          }}
        >
          保存
        </Button>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* 日付 */}
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              日付
            </Typography>
            <TextField
              fullWidth
              type="date"
              value={formatDateForInput(item['日付'])}
              disabled
              sx={{ 
                mt: 1,
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: '#000',
                  color: '#000',
                }
              }}
            />
          </Grid>

          {/* 入力者 */}
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              入力者
            </Typography>
            <TextField
              fullWidth
              value={item['入力者'] || ''}
              disabled
              sx={{ 
                mt: 1,
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: '#000',
                  color: '#000',
                }
              }}
            />
          </Grid>

          {/* タイトル */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              タイトル *
            </Typography>
            <TextField
              fullWidth
              value={item['タイトル'] || ''}
              disabled
              sx={{ 
                mt: 1,
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: sharedItemsColor.main,
                  color: sharedItemsColor.main,
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                },
                '& .MuiOutlinedInput-root': {
                  bgcolor: `${sharedItemsColor.light}15`,
                }
              }}
            />
          </Grid>

          {/* 内容 */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              内容
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={item['内容'] || ''}
              disabled
              sx={{ 
                mt: 1,
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: sharedItemsColor.dark,
                  color: sharedItemsColor.dark,
                  fontWeight: 500,
                  fontSize: '1rem',
                },
                '& .MuiOutlinedInput-root': {
                  bgcolor: `${sharedItemsColor.light}15`,
                }
              }}
            />
          </Grid>

          {/* 共有日 */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              共有日
            </Typography>
            <TextField
              fullWidth
              type="date"
              value={item['共有日'] || ''}
              disabled
              sx={{ 
                mt: 1,
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: '#000',
                  color: '#000',
                }
              }}
            />
          </Grid>

          {/* 共有できていない */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              共有できていない
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {staff.map((s, index) => {
                // イニシャルを取得（名前の最初の1文字）
                const initial = s.name.charAt(0);
                
                // このスタッフが「共有できていない」リストに含まれているか確認
                const notSharedList = item['共有できていない'] ? 
                  item['共有できていない'].split(',').map((n: string) => n.trim()) : 
                  [];
                const isNotShared = notSharedList.includes(s.name);
                
                return (
                  <Button
                    key={index}
                    variant={isNotShared ? 'contained' : 'outlined'}
                    sx={{
                      minWidth: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      bgcolor: isNotShared ? sharedItemsColor.main : 'transparent',
                      color: isNotShared ? '#fff' : sharedItemsColor.main,
                      borderColor: sharedItemsColor.main,
                      '&:hover': {
                        bgcolor: isNotShared ? sharedItemsColor.dark : `${sharedItemsColor.light}30`,
                      },
                    }}
                  >
                    {initial}
                  </Button>
                );
              })}
            </Box>
          </Grid>

          {/* 確認日 */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              確認日
            </Typography>
            <TextField
              fullWidth
              type="date"
              value={item['確認日'] || ''}
              disabled
              sx={{ 
                mt: 1,
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: '#000',
                  color: '#000',
                }
              }}
            />
          </Grid>

          {/* PDF1-4 */}
          {[1, 2, 3, 4].map((num) => (
            <Grid item xs={12} key={`pdf${num}`}>
              <Typography variant="caption" color="text.secondary">
                PDF{num}
              </Typography>
              <Box
                sx={{
                  mt: 1,
                  p: 3,
                  border: '2px dashed #ddd',
                  borderRadius: 1,
                  textAlign: 'center',
                  bgcolor: '#fafafa',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  📄
                </Typography>
              </Box>
            </Grid>
          ))}

          {/* 画像1-4 */}
          {[1, 2, 3, 4].map((num) => (
            <Grid item xs={12} key={`image${num}`}>
              <Typography variant="caption" color="text.secondary">
                画像 {num}
              </Typography>
              <Box
                sx={{
                  mt: 1,
                  p: 3,
                  border: '2px dashed #ddd',
                  borderRadius: 1,
                  textAlign: 'center',
                  bgcolor: '#fafafa',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  📷
                </Typography>
              </Box>
            </Grid>
          ))}

          {/* URL */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              URL
            </Typography>
            <TextField
              fullWidth
              value={item['URL'] || 'http://'}
              disabled
              sx={{ 
                mt: 1,
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: '#000',
                  color: '#000',
                }
              }}
            />
          </Grid>

          {/* ID */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              ID *
            </Typography>
            <TextField
              fullWidth
              value={item['ID'] || ''}
              disabled
              sx={{ 
                mt: 1,
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: '#000',
                  color: '#000',
                }
              }}
            />
          </Grid>

          {/* 共有場 */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              共有場 *
            </Typography>
            <TextField
              fullWidth
              value={item['共有場'] || ''}
              disabled
              sx={{ 
                mt: 1,
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: '#000',
                  color: '#000',
                }
              }}
            />
          </Grid>

          {/* 項目 */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              項目 *
            </Typography>
            <TextField
              fullWidth
              value={item['項目'] || ''}
              disabled
              sx={{ 
                mt: 1,
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: '#000',
                  color: '#000',
                }
              }}
            />
          </Grid>

          {/* 打ち合わせ内容 */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              打ち合わせ内容
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={item['打ち合わせ内容'] || ''}
              disabled
              sx={{ 
                mt: 1,
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: '#000',
                  color: '#000',
                }
              }}
            />
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
}
