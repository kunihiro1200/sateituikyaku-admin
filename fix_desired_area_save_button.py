#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerDesiredConditionsPage.tsx に保存ボタンを追加するスクリプト
- pendingChanges / hasChanges / isSaving state を追加
- handleFieldChange 関数を追加
- desired_area の onClose 自動保存を廃止し handleFieldChange に変更
- SaveIcon インポートを追加
- ヘッダーに保存ボタンを追加
- handleSaveAll 関数を追加
- InlineEditableField の onSave を handleFieldChange に変更
- pendingAreasRef を削除
"""

import sys

TARGET_FILE = 'frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx'

with open(TARGET_FILE, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 1. SaveIcon インポートを追加
# ============================================================
text = text.replace(
    """import { 
  ArrowBack as ArrowBackIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';""",
    """import { 
  ArrowBack as ArrowBackIcon,
  ContentCopy as ContentCopyIcon,
  Save as SaveIcon,
} from '@mui/icons-material';"""
)

# ============================================================
# 2. pendingAreasRef を削除し、新しい state を追加
# ============================================================
text = text.replace(
    """  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  // ドロップダウンを閉じた時に保存する値を保持する ref
  const pendingAreasRef = useRef<string[] | null>(null);
  // selectedAreas の最新値を ref で保持（onClose クロージャー問題を回避）
  const selectedAreasRef = useRef<string[]>([]);""",
    """  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  // selectedAreas の最新値を ref で保持（onClose クロージャー問題を回避）
  const selectedAreasRef = useRef<string[]>([]);
  // 未保存の変更を蓄積するオブジェクト
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  // 変更があるかどうか
  const [hasChanges, setHasChanges] = useState(false);
  // 保存処理中かどうか
  const [isSaving, setIsSaving] = useState(false);"""
)

# ============================================================
# 3. handleFieldChange 関数を handleInlineFieldSave の前に追加
# ============================================================
text = text.replace(
    """  const handleInlineFieldSave = async (fieldName: string, newValue: any) => {""",
    """  // フィールドの変更を pendingChanges に蓄積する関数
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

  const handleInlineFieldSave = async (fieldName: string, newValue: any) => {"""
)

# ============================================================
# 4. desired_area の Select の onChange から pendingAreasRef を削除
# ============================================================
text = text.replace(
    """                      onChange={(e) => {
                        const selected = e.target.value as string[];
                        // UIを即時更新し、ref にも最新値を保持
                        setSelectedAreas(selected);
                        selectedAreasRef.current = selected;
                        pendingAreasRef.current = selected;
                      }}""",
    """                      onChange={(e) => {
                        const selected = e.target.value as string[];
                        // UIを即時更新し、ref にも最新値を保持
                        setSelectedAreas(selected);
                        selectedAreasRef.current = selected;
                      }}"""
)

# ============================================================
# 5. desired_area の onClose を handleFieldChange に変更
# ============================================================
text = text.replace(
    """                      onClose={() => {
                        // ドロップダウンを閉じた時に保存
                        // selectedAreasRef.current を使うことで onChange との順序問題を回避
                        if (pendingAreasRef.current !== null) {
                          const valueToSave = selectedAreasRef.current.join('|');
                          pendingAreasRef.current = null;
                          handleInlineFieldSave(field.key, valueToSave);
                        }
                      }}""",
    """                      onClose={() => {
                        // ドロップダウンを閉じた時に pendingChanges に蓄積（自動保存しない）
                        handleFieldChange('desired_area', selectedAreasRef.current.join('|'));
                      }}"""
)

# ============================================================
# 6. チップ削除（onDelete）を handleFieldChange に変更
# ============================================================
text = text.replace(
    """                                onDelete={(e) => {
                                  e.stopPropagation();
                                  // selectedAreasRef.current を使って最新値から削除
                                  const next = selectedAreasRef.current.filter((v) => v !== val);
                                  setSelectedAreas(next);
                                  selectedAreasRef.current = next;
                                  pendingAreasRef.current = null;
                                  // チップ削除は即時保存
                                  handleInlineFieldSave(field.key, next.join('|'));
                                }}""",
    """                                onDelete={(e) => {
                                  e.stopPropagation();
                                  // selectedAreasRef.current を使って最新値から削除
                                  const next = selectedAreasRef.current.filter((v) => v !== val);
                                  setSelectedAreas(next);
                                  selectedAreasRef.current = next;
                                  // チップ削除は pendingChanges に蓄積（自動保存しない）
                                  handleFieldChange(field.key, next.join('|'));
                                }}"""
)

# ============================================================
# 7. InlineEditableField の onSave を handleFieldChange に変更
# ============================================================
text = text.replace(
    """                  <InlineEditableField
                    value={buyer[field.key]}
                    onSave={(newValue) => handleInlineFieldSave(field.key, newValue)}""",
    """                  <InlineEditableField
                    value={buyer[field.key]}
                    onSave={(newValue) => handleFieldChange(field.key, newValue)}"""
)

# ============================================================
# 8. ヘッダーの右側に保存ボタンを追加
# ============================================================
text = text.replace(
    """        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
      </Box>""",
    """        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
      </Box>"""
)

# ============================================================
# 書き込み
# ============================================================
with open(TARGET_FILE, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! BuyerDesiredConditionsPage.tsx を更新しました。')

# エンコーディング確認
with open(TARGET_FILE, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (b"imp" などであればOK、b"\\xef\\xbb\\xbf" はBOM付き)')
