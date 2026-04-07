import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  IconButton,
  Alert,
  Snackbar,
  Tooltip,
  Checkbox,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  FormControl,
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  ContentCopy as ContentCopyIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import api, { buyerApi } from '../services/api';
import { InlineEditableField } from '../components/InlineEditableField';
import { SECTION_COLORS } from '../theme/sectionColors';
import {
  AREA_OPTIONS,
  DESIRED_PROPERTY_TYPE_OPTIONS,
  PARKING_SPACES_OPTIONS,
  PRICE_RANGE_DETACHED_OPTIONS,
  PRICE_RANGE_MANSION_OPTIONS,
  PRICE_RANGE_LAND_OPTIONS,
  BUILDING_AGE_OPTIONS,
  FLOOR_PLAN_OPTIONS,
  HOT_SPRING_OPTIONS,
  GARDEN_OPTIONS,
  PET_ALLOWED_OPTIONS,
  HIGH_FLOOR_OPTIONS,
  CORNER_ROOM_OPTIONS,
  GOOD_VIEW_OPTIONS,
  MONTHLY_PARKING_OK_OPTIONS,
} from '../utils/buyerDesiredConditionsOptions';

interface Buyer {
  [key: string]: any;
}

const DESIRED_CONDITIONS_FIELDS = [
  { key: 'desired_timing', label: '希望時期', inlineEditable: true, fieldType: 'text' },
  { key: 'desired_area', label: '★エリア', inlineEditable: false, fieldType: 'multiselect', options: AREA_OPTIONS },
  { key: 'desired_property_type', label: '★希望種別', inlineEditable: true, fieldType: 'dropdown', options: DESIRED_PROPERTY_TYPE_OPTIONS },
  { key: 'desired_building_age', label: '★築年数', inlineEditable: true, fieldType: 'dropdown', options: BUILDING_AGE_OPTIONS },
  { key: 'desired_floor_plan', label: '★間取り', inlineEditable: true, fieldType: 'dropdown', options: FLOOR_PLAN_OPTIONS },
  { key: 'budget', label: '予算', inlineEditable: true, fieldType: 'text' },
  { key: 'price_range_house', label: '価格帯（戸建）', inlineEditable: true, fieldType: 'dropdown', options: PRICE_RANGE_DETACHED_OPTIONS },
  { key: 'price_range_apartment', label: '価格帯（マンション）', inlineEditable: true, fieldType: 'dropdown', options: PRICE_RANGE_MANSION_OPTIONS },
  { key: 'price_range_land', label: '価格帯（土地）', inlineEditable: true, fieldType: 'dropdown', options: PRICE_RANGE_LAND_OPTIONS },
  { key: 'parking_spaces', label: '●P台数', inlineEditable: true, fieldType: 'dropdown', options: PARKING_SPACES_OPTIONS },
  { key: 'monthly_parking_ok', label: '★月極でも可', inlineEditable: true, fieldType: 'dropdown', options: MONTHLY_PARKING_OK_OPTIONS },
  { key: 'hot_spring_required', label: '★温泉あり', inlineEditable: true, fieldType: 'dropdown', options: HOT_SPRING_OPTIONS },
  { key: 'garden_required', label: '★庭付き', inlineEditable: true, fieldType: 'dropdown', options: GARDEN_OPTIONS },
  { key: 'pet_allowed_required', label: '★ペット可', inlineEditable: true, fieldType: 'dropdown', options: PET_ALLOWED_OPTIONS },
  { key: 'good_view_required', label: '★眺望良好', inlineEditable: true, fieldType: 'dropdown', options: GOOD_VIEW_OPTIONS },
  { key: 'high_floor_required', label: '★高層階', inlineEditable: true, fieldType: 'dropdown', options: HIGH_FLOOR_OPTIONS },
  { key: 'corner_room_required', label: '★角部屋', inlineEditable: true, fieldType: 'dropdown', options: CORNER_ROOM_OPTIONS },
];

export default function BuyerDesiredConditionsPage() {
  const { buyer_number } = useParams<{ buyer_number: string }>();
  const navigate = useNavigate();
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedBuyerNumber, setCopiedBuyerNumber] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  // selectedAreas の最新値を ref で保持（onClose クロージャー問題を回避）
  const selectedAreasRef = useRef<string[]>([]);
  // 未保存の変更を蓄積するオブジェクト
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  // 変更があるかどうか
  const [hasChanges, setHasChanges] = useState(false);
  // 保存処理中かどうか
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Validate buyer_number parameter
  const isUuid = buyer_number ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(buyer_number) : false;
  const isNumericBuyerNumber = buyer_number ? /^\d+$/.test(buyer_number) : false;
  const isByPrefixBuyerNumber = buyer_number ? /^BY_[A-Za-z0-9_]+$/.test(buyer_number) : false;
  const isValidBuyerNumber = isUuid || isNumericBuyerNumber || isByPrefixBuyerNumber;

  useEffect(() => {
    if (buyer_number && isValidBuyerNumber) {
      fetchBuyer();
    }
  }, [buyer_number, isValidBuyerNumber]);

  const fetchBuyer = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/buyers/${buyer_number}`);
      setBuyer(res.data);
      // desired_area の初期値をローカル state にセット
      const areaVal = res.data?.desired_area || '';
      const initialAreas = areaVal ? areaVal.split('|').map((v: string) => v.trim()).filter(Boolean) : [];
      setSelectedAreas(initialAreas);
      selectedAreasRef.current = initialAreas;
    } catch (error) {
      console.error('Failed to fetch buyer:', error);
    } finally {
      setLoading(false);
    }
  };

  // 配信メール「要」時の希望条件必須チェック
  const checkDistributionRequiredFields = (fieldName: string, newValue: any): string | null => {
    if (!buyer) return null;

    // 保存後の値を仮想的に計算
    const updatedBuyer = { ...buyer, [fieldName]: newValue };

    // 配信メールが「要」かどうか確認
    const distributionType = String(updatedBuyer.distribution_type || '').trim();
    if (distributionType !== '要') return null;

    // エリア・価格帯・種別の未入力チェック
    const desiredArea = String(updatedBuyer.desired_area || '').trim();
    const desiredPropertyType = String(updatedBuyer.desired_property_type || '').trim();
    const priceRangeHouse = String(updatedBuyer.price_range_house || '').trim();
    const priceRangeApartment = String(updatedBuyer.price_range_apartment || '').trim();
    const priceRangeLand = String(updatedBuyer.price_range_land || '').trim();

    const missing: string[] = [];
    if (!desiredArea) missing.push('エリア');
    if (!desiredPropertyType) missing.push('希望種別');

    // 希望種別に応じた価格帯の必須チェック
    const needsHouse = desiredPropertyType.includes('戸建て');
    const needsApartment = desiredPropertyType.includes('マンション');
    const needsLand = desiredPropertyType.includes('土地');
    const hasAnyPriceRange = priceRangeHouse || priceRangeApartment || priceRangeLand;

    if (needsHouse && !priceRangeHouse) missing.push('価格帯（戸建）');
    if (needsApartment && !priceRangeApartment) missing.push('価格帯（マンション）');
    if (needsLand && !priceRangeLand) missing.push('価格帯（土地）');
    // 種別未設定 or 条件次第の場合は3つのうちいずれか1つが必要
    if (!needsHouse && !needsApartment && !needsLand && !hasAnyPriceRange) {
      missing.push('価格帯（戸建・マンション・土地のいずれか）');
    }

    if (missing.length > 0) {
      return `配信メールが「要」の場合、${missing.join('・')}は必須です。希望条件を入力してください。`;
    }
    return null;
  };

  // フィールドの変更を pendingChanges に蓄積する関数
  const handleFieldChange = (fieldName: string, newValue: any) => {
    setPendingChanges(prev => ({ ...prev, [fieldName]: newValue }));
    setHasChanges(true);
  };

  // 保存ボタン押下時に pendingChanges を一括保存する関数
  const handleSaveAll = async () => {
    if (!buyer || Object.keys(pendingChanges).length === 0) return;

    // 配信メール「要」時の必須バリデーション
    for (const [fieldName, newValue] of Object.entries(pendingChanges)) {
      const validationError = checkDistributionRequiredFields(fieldName, newValue);
      if (validationError) {
        setSnackbar({ open: true, message: validationError, severity: 'error' });
        return;
      }
    }

    setIsSaving(true);
    try {
      const result = await buyerApi.update(buyer_number!, pendingChanges, { sync: true });

      if (result.conflicts && result.conflicts.length > 0) {
        setSnackbar({ open: true, message: '同期競合が発生しました。スプレッドシートの値が変更されています。', severity: 'warning' });
        setBuyer(result.buyer);
        setPendingChanges({});
        setHasChanges(false);
        return;
      }

      setBuyer(result.buyer);
      // desired_area が更新された場合はローカル state も同期
      if (pendingChanges.desired_area !== undefined && result.buyer?.desired_area !== undefined) {
        const areaVal = result.buyer.desired_area || '';
        const updatedAreas = areaVal ? areaVal.split('|').map((v: string) => v.trim()).filter(Boolean) : [];
        setSelectedAreas(updatedAreas);
        selectedAreasRef.current = updatedAreas;
      }

      setPendingChanges({});
      setHasChanges(false);

      if (result.syncStatus === 'pending') {
        setSnackbar({ open: true, message: '保存しました（スプシ同期は保留中）', severity: 'warning' });
      } else if (result.syncStatus === 'failed' || result.syncError) {
        setSnackbar({ open: true, message: 'DBへの保存は完了しましたが、スプレッドシートへの同期に失敗しました', severity: 'warning' });
      } else {
        setSnackbar({ open: true, message: '保存しました（スプシ同期済み）', severity: 'success' });
      }
    } catch (error: any) {
      console.error('Failed to save:', error);
      setSnackbar({ open: true, message: error.response?.data?.error || '保存に失敗しました', severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInlineFieldSave = async (fieldName: string, newValue: any) => {
    if (!buyer) return;

    // 配信メール「要」時の必須チェック
    const validationError = checkDistributionRequiredFields(fieldName, newValue);
    if (validationError) {
      setSnackbar({
        open: true,
        message: validationError,
        severity: 'error',
      });
      return { success: false, error: validationError };
    }

    try {
      const result = await buyerApi.update(
        buyer_number!,
        { [fieldName]: newValue },
        { sync: true }
      );
      
      if (result.conflicts && result.conflicts.length > 0) {
        console.warn('Sync conflict detected:', result.conflicts);
        setSnackbar({
          open: true,
          message: '同期競合が発生しました。スプレッドシートの値が変更されています。',
          severity: 'warning'
        });
        setBuyer(result.buyer);
        return { success: true };
      }
      
      setBuyer(result.buyer);
      // desired_area が更新された場合はローカル state も同期
      if (fieldName === 'desired_area' && result.buyer?.desired_area !== undefined) {
        const areaVal = result.buyer.desired_area || '';
        const updatedAreas = areaVal ? areaVal.split('|').map((v: string) => v.trim()).filter(Boolean) : [];
        setSelectedAreas(updatedAreas);
        selectedAreasRef.current = updatedAreas;
      }
      
      if (result.syncStatus === 'pending') {
        setSnackbar({
          open: true,
          message: '保存しました（スプレッドシート同期は保留中）',
          severity: 'warning'
        });
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Failed to update field:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || '更新に失敗しました' 
      };
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleCopyBuyerNumber = () => {
    if (buyer?.buyer_number) {
      navigator.clipboard.writeText(buyer.buyer_number);
      setCopiedBuyerNumber(true);
      setTimeout(() => setCopiedBuyerNumber(false), 2000);
    }
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
  };

  if (!buyer_number || !isValidBuyerNumber) {
    return (
      <Container maxWidth="xl" sx={{ py: 3, px: 2 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h5" color="error" gutterBottom>
            無効な買主番号です
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            買主番号は有効な数値、UUID、またはBY_形式である必要があります
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<ArrowBackIcon />} 
            onClick={() => navigate('/buyers')}
          >
            買主一覧に戻る
          </Button>
        </Box>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3, px: 2, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!buyer) {
    return (
      <Container maxWidth="xl" sx={{ py: 3, px: 2 }}>
        <Typography>買主が見つかりませんでした</Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/buyers')}>
          一覧に戻る
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3, px: 2 }}>
      {/* ヘッダー */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        mb: 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton 
            onClick={() => navigate(`/buyers/${buyer_number}`)} 
            aria-label="買主詳細に戻る"
          >
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.buyer.main }}>
              希望条件 - {buyer.name ? `${buyer.name}様` : buyer.buyer_number}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                買主番号: {buyer.buyer_number}
              </Typography>
              <Tooltip title={copiedBuyerNumber ? 'コピーしました！' : '買主番号をコピー'}>
                <IconButton
                  size="small"
                  onClick={handleCopyBuyerNumber}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
        <Button
          variant="contained"
          color={hasChanges ? "warning" : "primary"}
          disabled={isSaving || !hasChanges}
          onClick={handleSaveAll}
          startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          sx={{ minWidth: 100 }}
        >
          {isSaving ? '保存中...' : '保存'}
        </Button>
      </Box>

      {/* 配信メール「要」時の必須項目警告バナー */}
      {buyer.distribution_type === '要' && (
        (() => {
          const missingItems: string[] = [];
          if (!buyer.desired_area) missingItems.push('エリア');
          if (!buyer.desired_property_type) missingItems.push('希望種別');
          // 希望種別に応じた価格帯チェック
          const _pt = String(buyer.desired_property_type || '').trim();
          const _needsH = _pt.includes('戸建て');
          const _needsA = _pt.includes('マンション');
          const _needsL = _pt.includes('土地');
          const _anyPrice = buyer.price_range_house || buyer.price_range_apartment || buyer.price_range_land;
          if (_needsH && !buyer.price_range_house) missingItems.push('価格帯（戸建）');
          if (_needsA && !buyer.price_range_apartment) missingItems.push('価格帯（マンション）');
          if (_needsL && !buyer.price_range_land) missingItems.push('価格帯（土地）');
          if (!_needsH && !_needsA && !_needsL && !_anyPrice) missingItems.push('価格帯（いずれか）');
          return missingItems.length > 0 ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              <strong>配信メールが「要」に設定されています。</strong>
              以下の必須項目を入力してください：{missingItems.join('・')}
            </Alert>
          ) : null;
        })()
      )}

      {/* 希望条件フィールド */}
      <Paper sx={{ 
        p: 3,
        borderTop: `4px solid ${SECTION_COLORS.buyer.main}`,
      }}>
        <Typography variant="h6" sx={{ mb: 2, color: SECTION_COLORS.buyer.main }}>
          希望条件
        </Typography>
        <Grid container spacing={2}>
          {DESIRED_CONDITIONS_FIELDS.map((field) => (
            <Grid item xs={12} sm={6} md={4} key={field.key}>
              <Box>
                <Typography
                  variant="caption"
                  color={
                    (() => {
                      if (buyer.distribution_type !== '要') return 'text.secondary';
                      const pt = String(buyer.desired_property_type || '').trim();
                      const alwaysRequired = ['desired_area', 'desired_property_type'].includes(field.key) && !buyer[field.key];
                      const houseRequired = field.key === 'price_range_house' && pt.includes('戸建て') && !buyer[field.key];
                      const aptRequired = field.key === 'price_range_apartment' && pt.includes('マンション') && !buyer[field.key];
                      const landRequired = field.key === 'price_range_land' && pt.includes('土地') && !buyer[field.key];
                      return (alwaysRequired || houseRequired || aptRequired || landRequired) ? 'error' : 'text.secondary';
                    })()
                  }
                  sx={{ display: 'block', mb: 0.5, fontWeight:
                    (() => {
                      if (buyer.distribution_type !== '要') return 'normal';
                      const pt = String(buyer.desired_property_type || '').trim();
                      const alwaysRequired = ['desired_area', 'desired_property_type'].includes(field.key) && !buyer[field.key];
                      const houseRequired = field.key === 'price_range_house' && pt.includes('戸建て') && !buyer[field.key];
                      const aptRequired = field.key === 'price_range_apartment' && pt.includes('マンション') && !buyer[field.key];
                      const landRequired = field.key === 'price_range_land' && pt.includes('土地') && !buyer[field.key];
                      return (alwaysRequired || houseRequired || aptRequired || landRequired) ? 'bold' : 'normal';
                    })()
                  }}
                >
                  {field.label}
                  {(() => {
                    if (buyer.distribution_type !== '要') return null;
                    const pt = String(buyer.desired_property_type || '').trim();
                    const alwaysRequired = ['desired_area', 'desired_property_type'].includes(field.key) && !buyer[field.key];
                    const houseRequired = field.key === 'price_range_house' && pt.includes('戸建て') && !buyer[field.key];
                    const aptRequired = field.key === 'price_range_apartment' && pt.includes('マンション') && !buyer[field.key];
                    const landRequired = field.key === 'price_range_land' && pt.includes('土地') && !buyer[field.key];
                    return (alwaysRequired || houseRequired || aptRequired || landRequired) ? ' ※必須' : null;
                  })()}
                </Typography>
                {field.key === 'desired_area' ? (
                  <FormControl fullWidth size="small">
                    <Select
                      multiple
                      value={selectedAreas}
                      onChange={(e) => {
                        const selected = e.target.value as string[];
                        // UIを即時更新し、ref にも最新値を保持
                        setSelectedAreas(selected);
                        selectedAreasRef.current = selected;
                        // ✅ 修正: onChangeで即座にpendingChangesに反映（ドロップダウンを閉じなくても保存可能）
                        handleFieldChange('desired_area', selected.join('|'));
                      }}
                      input={<OutlinedInput />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((val) => {
                            const opt = (field.options || []).find((o) => o.value === val);
                            return (
                              <Chip
                                key={val}
                                label={opt ? opt.label : val}
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                                onDelete={(e) => {
                                  e.stopPropagation();
                                  // selectedAreasRef.current を使って最新値から削除
                                  const next = selectedAreasRef.current.filter((v) => v !== val);
                                  setSelectedAreas(next);
                                  selectedAreasRef.current = next;
                                  // チップ削除は pendingChanges に蓄積（自動保存しない）
                                  handleFieldChange(field.key, next.join('|'));
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                              />
                            );
                          })}
                        </Box>
                      )}
                      MenuProps={{ PaperProps: { style: { maxHeight: 400 } } }}
                    >
                      {(field.options || []).map((opt) => (
                        <MenuItem key={opt.value} value={opt.value} dense>
                          <Checkbox size="small" checked={selectedAreas.includes(opt.value)} sx={{ p: 0, mr: 1 }} />
                          <Typography variant="body2">{opt.label}</Typography>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : field.inlineEditable ? (
                  <InlineEditableField
                    value={buyer[field.key]}
                    onSave={(newValue) => handleFieldChange(field.key, newValue)}
                    fieldType={field.fieldType || 'text'}
                    fieldName={field.key}
                    options={field.options}
                    multiline={false}
                    buyerId={buyer_number}
                    enableConflictDetection={true}
                    showEditIndicator={true}
                    oneClickDropdown={field.fieldType === 'dropdown'}
                  />
                ) : (
                  <Typography variant="body2">
                    {formatValue(buyer[field.key])}
                  </Typography>
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
