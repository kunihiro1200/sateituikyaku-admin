# -*- coding: utf-8 -*-
"""
「売買契約完了」フィールドを PropertyListingDetailPage.tsx に追加するスクリプト
- 手数料情報セクションの上に配置
- Enumボックス（Select）として実装
- 値が選択されたらメッセージダイアログを表示
- PropertyListingインターフェースに sales_contract_completed を追加
"""

import re

filepath = 'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# -------------------------------------------------------
# 1. PropertyListingインターフェースに sales_contract_completed を追加
#    memo?: string; の後に追加
# -------------------------------------------------------
old_interface = '  memo?: string;\n  running_cost?: number;'
new_interface = '  memo?: string;\n  sales_contract_completed?: string;\n  running_cost?: number;'

if 'sales_contract_completed' not in text:
    text = text.replace(old_interface, new_interface, 1)
    print('✅ インターフェースに sales_contract_completed を追加しました')
else:
    print('ℹ️  インターフェースに sales_contract_completed は既に存在します')

# -------------------------------------------------------
# 2. state変数を追加
#    snackbar state の前に salesContractDialog state を追加
# -------------------------------------------------------
old_state = '  const [snackbar, setSnackbar] = useState<{\n    open: boolean;\n    message: string;\n    severity: \'success\' | \'error\';\n  }>({\n    open: false,\n    message: \'\',\n    severity: \'success\',\n  });'

new_state = '''  const [salesContractDialog, setSalesContractDialog] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });'''

if 'salesContractDialog' not in text:
    text = text.replace(old_state, new_state, 1)
    print('✅ salesContractDialog state を追加しました')
else:
    print('ℹ️  salesContractDialog state は既に存在します')

# -------------------------------------------------------
# 3. 手数料情報セクションの上に「売買契約完了」セクションを追加
# -------------------------------------------------------
old_fee_section = '            {/* 手数料情報 */}\n            <Box sx={{ flex: { xs: \'1 1 100%\', md: \'0 0 50%\' } }}>'

new_contract_and_fee = '''            {/* 売買契約完了 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <Paper sx={{ p: 2, mb: 2 }}>
                <Box sx={{ mb: 2, pb: 1, borderBottom: `2px solid ${SECTION_COLORS.property.main}` }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>売買契約完了</Typography>
                </Box>
                <FormControl fullWidth size="small">
                  <Select
                    value={editedData.sales_contract_completed !== undefined ? editedData.sales_contract_completed : (data.sales_contract_completed || '')}
                    displayEmpty
                    onChange={(e) => {
                      const val = e.target.value;
                      handleFieldChange('sales_contract_completed', val);
                      if (val === '契約完了したのでネット非公開お願いします。') {
                        setSalesContractDialog(true);
                      }
                    }}
                  >
                    <MenuItem value="">（未設定）</MenuItem>
                    <MenuItem value="契約完了したのでネット非公開お願いします。">契約完了したのでネット非公開お願いします。</MenuItem>
                  </Select>
                </FormControl>
                {(editedData.sales_contract_completed !== undefined ? editedData.sales_contract_completed : (data.sales_contract_completed || '')) === '契約完了したのでネット非公開お願いします。' && (
                  <Box sx={{ mt: 1 }}>
                    <Button
                      variant="contained"
                      color="warning"
                      size="small"
                      onClick={() => setSalesContractDialog(true)}
                    >
                      チャット送信メッセージを表示
                    </Button>
                  </Box>
                )}
              </Paper>
            </Box>
            {/* 手数料情報 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>'''

if 'salesContractDialog' in text and '売買契約完了' not in text:
    text = text.replace(old_fee_section, new_contract_and_fee, 1)
    print('✅ 売買契約完了セクションを追加しました')
elif '売買契約完了' in text:
    print('ℹ️  売買契約完了セクションは既に存在します')
else:
    # state追加後に再チェック
    if old_fee_section in text:
        text = text.replace(old_fee_section, new_contract_and_fee, 1)
        print('✅ 売買契約完了セクションを追加しました')
    else:
        print('❌ 手数料情報セクションが見つかりませんでした')

# -------------------------------------------------------
# 4. ダイアログコンポーネントを追加（Snackbarの直前）
# -------------------------------------------------------
old_snackbar_component = '      <Snackbar\n        open={snackbar.open}'

new_dialog_and_snackbar = '''      {/* 売買契約完了 チャット送信メッセージダイアログ */}
      <Dialog open={salesContractDialog} onClose={() => setSalesContractDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>チャット送信メッセージ</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            担当は、チャット送信後、下記より物件番号のみを入力してください↓↓
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <a
              href="https://docs.google.com/spreadsheets/d/1D3qEGGroXQ17jwF5aoRN5TeSswTxRvoAhHY87bSA56M/edit?gid=534678762#gid=534678762"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://docs.google.com/spreadsheets/d/1D3qEGGroXQ17jwF5aoRN5TeSswTxRvoAhHY87bSA56M/edit?gid=534678762#gid=534678762
            </a>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSalesContractDialog(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}'''

if 'salesContractDialog' in text and 'チャット送信メッセージ' not in text:
    text = text.replace(old_snackbar_component, new_dialog_and_snackbar, 1)
    print('✅ ダイアログコンポーネントを追加しました')
elif 'チャット送信メッセージ' in text:
    print('ℹ️  ダイアログコンポーネントは既に存在します')
else:
    print('❌ Snackbarコンポーネントが見つかりませんでした')

# -------------------------------------------------------
# 5. 保存処理に sales_contract_completed を含める確認
#    （handleSave は editedData をそのまま送るので追加不要）
# -------------------------------------------------------

# -------------------------------------------------------
# 書き込み
# -------------------------------------------------------
with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n✅ 完了！')
