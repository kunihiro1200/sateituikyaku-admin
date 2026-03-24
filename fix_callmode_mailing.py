#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx に郵送フィールドUIを追加するスクリプト
- タスク3.1: mailingStatus / savingMailingStatus 状態変数を追加
- タスク3.2: 売主データロード時の mailingStatus 初期化処理を追加
- タスク3.3: handleMailingStatusChange ハンドラーを追加
- タスク3.4: handleValuationMethodChange に「郵送」選択時のデフォルト「未」設定ロジックを追加
- タスク3.5: 査定計算セクション内に郵送フィールドUI（「未」/「済」ボタン）を追加
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# タスク3.1: 状態変数を追加
# 「// 査定方法用の状態」ブロックの直後に郵送ステータス用の状態変数を追加
# ============================================================
old_3_1 = """  // 査定方法用の状態
  const [editedValuationMethod, setEditedValuationMethod] = useState<string>('');
  const [savingValuationMethod, setSavingValuationMethod] = useState(false);

  // コミュニケーションフィールド用の状態"""

new_3_1 = """  // 査定方法用の状態
  const [editedValuationMethod, setEditedValuationMethod] = useState<string>('');
  const [savingValuationMethod, setSavingValuationMethod] = useState(false);

  // 郵送ステータス用の状態
  const [mailingStatus, setMailingStatus] = useState<string>('');
  const [savingMailingStatus, setSavingMailingStatus] = useState(false);

  // コミュニケーションフィールド用の状態"""

assert old_3_1 in text, "タスク3.1: 挿入箇所が見つかりません"
text = text.replace(old_3_1, new_3_1, 1)
print("✅ タスク3.1: 状態変数を追加しました")

# ============================================================
# タスク3.2: 売主データロード時の mailingStatus 初期化処理を追加
# 「// 査定方法の初期化」の直後に追加
# ============================================================
old_3_2 = """      // 査定方法の初期化
      setEditedValuationMethod(sellerData.valuationMethod || '');

      // コミュニケーションフィールドの初期化"""

new_3_2 = """      // 査定方法の初期化
      setEditedValuationMethod(sellerData.valuationMethod || '');

      // 郵送ステータスの初期化
      // seller.mailingStatus があればそれを使用、なければ査定方法が「郵送」系の場合は「未」をデフォルト
      const initialValuationMethod = sellerData.valuationMethod || '';
      const defaultMailingStatus = sellerData.mailingStatus ||
        (initialValuationMethod.includes('郵送') ? '未' : '');
      setMailingStatus(defaultMailingStatus);

      // コミュニケーションフィールドの初期化"""

assert old_3_2 in text, "タスク3.2: 挿入箇所が見つかりません"
text = text.replace(old_3_2, new_3_2, 1)
print("✅ タスク3.2: mailingStatus 初期化処理を追加しました")

# ============================================================
# タスク3.3: handleMailingStatusChange ハンドラーを追加
# 「// 査定方法更新ハンドラー」の直前に追加
# ============================================================
old_3_3 = """  // 査定方法更新ハンドラー
  const handleValuationMethodChange = async (method: string) => {"""

new_3_3 = """  // 郵送ステータス更新ハンドラー
  const handleMailingStatusChange = async (status: string) => {
    try {
      setSavingMailingStatus(true);
      setError(null);

      await api.put(`/api/sellers/${id}`, {
        mailingStatus: status,
      });

      setMailingStatus(status);
      setSuccessMessage(`郵送ステータスを「${status}」に更新しました`);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '郵送ステータスの更新に失敗しました');
    } finally {
      setSavingMailingStatus(false);
    }
  };

  // 査定方法更新ハンドラー
  const handleValuationMethodChange = async (method: string) => {"""

assert old_3_3 in text, "タスク3.3: 挿入箇所が見つかりません"
text = text.replace(old_3_3, new_3_3, 1)
print("✅ タスク3.3: handleMailingStatusChange ハンドラーを追加しました")

# ============================================================
# タスク3.4: handleValuationMethodChange に「郵送」選択時のデフォルト「未」設定ロジックを追加
# ============================================================
old_3_4 = """      // ローカル状態を更新
      setEditedValuationMethod(newMethod);

      if (newMethod === '') {
        setSuccessMessage('査定方法を解除しました');
      } else {
        setSuccessMessage(`査定方法を「${newMethod}」に更新しました`);
      }"""

new_3_4 = """      // ローカル状態を更新
      setEditedValuationMethod(newMethod);

      // 「郵送」系の査定方法が選択された場合、郵送ステータスが未設定なら「未」をデフォルト設定
      if (newMethod.includes('郵送') && !mailingStatus) {
        setMailingStatus('未');
        // DBにも保存
        await api.put(`/api/sellers/${id}`, {
          mailingStatus: '未',
        });
      }

      if (newMethod === '') {
        setSuccessMessage('査定方法を解除しました');
      } else {
        setSuccessMessage(`査定方法を「${newMethod}」に更新しました`);
      }"""

assert old_3_4 in text, "タスク3.4: 挿入箇所が見つかりません"
text = text.replace(old_3_4, new_3_4, 1)
print("✅ タスク3.4: 「郵送」選択時のデフォルト「未」設定ロジックを追加しました")

# ============================================================
# タスク3.5: 査定計算セクション内に郵送フィールドUIを追加
# 査定方法ボタン（査定額あり・非編集モード）の直後に追加
# ============================================================
# 査定額あり・非編集モードの査定方法ボタンブロックの末尾を特定
old_3_5 = """                        {savingValuationMethod && <CircularProgress size={20} />}
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>"""

new_3_5 = """                        {savingValuationMethod && <CircularProgress size={20} />}
                      </Box>
                    </Box>

                    {/* 郵送フィールド - 査定方法が「郵送」系の場合のみ表示 */}
                    {editedValuationMethod.includes('郵送') && (
                      <Box sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200', borderRadius: 1, mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          郵送
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Button
                            variant={mailingStatus === '未' ? 'contained' : 'outlined'}
                            color="warning"
                            size="small"
                            onClick={() => handleMailingStatusChange('未')}
                            disabled={savingMailingStatus}
                            sx={{ minWidth: 60 }}
                          >
                            未
                          </Button>
                          <Button
                            variant={mailingStatus === '済' ? 'contained' : 'outlined'}
                            color="success"
                            size="small"
                            onClick={() => handleMailingStatusChange('済')}
                            disabled={savingMailingStatus}
                            sx={{ minWidth: 60 }}
                          >
                            済
                          </Button>
                          {savingMailingStatus && <CircularProgress size={20} />}
                        </Box>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>"""

assert old_3_5 in text, "タスク3.5: 挿入箇所が見つかりません"
text = text.replace(old_3_5, new_3_5, 1)
print("✅ タスク3.5: 郵送フィールドUI（査定額あり・非編集モード）を追加しました")

# ============================================================
# タスク3.5（編集モード）: 査定額なし or 編集モードの査定方法ボタンブロックの直後にも追加
# ============================================================
old_3_5b = """                            {savingValuationMethod && <CircularProgress size={20} />}
                          </Box>
                        </Box>
                      </Grid>

                      {/* 査定額表示エリア（編集モード時） */}"""

new_3_5b = """                            {savingValuationMethod && <CircularProgress size={20} />}
                          </Box>
                        </Box>
                      </Grid>

                      {/* 郵送フィールド（編集モード） - 査定方法が「郵送」系の場合のみ表示 */}
                      {editedValuationMethod.includes('郵送') && (
                        <Grid item xs={12}>
                          <Box sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200', borderRadius: 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              郵送
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Button
                                variant={mailingStatus === '未' ? 'contained' : 'outlined'}
                                color="warning"
                                size="small"
                                onClick={() => handleMailingStatusChange('未')}
                                disabled={savingMailingStatus}
                                sx={{ minWidth: 60 }}
                              >
                                未
                              </Button>
                              <Button
                                variant={mailingStatus === '済' ? 'contained' : 'outlined'}
                                color="success"
                                size="small"
                                onClick={() => handleMailingStatusChange('済')}
                                disabled={savingMailingStatus}
                                sx={{ minWidth: 60 }}
                              >
                                済
                              </Button>
                              {savingMailingStatus && <CircularProgress size={20} />}
                            </Box>
                          </Box>
                        </Grid>
                      )}

                      {/* 査定額表示エリア（編集モード時） */}"""

assert old_3_5b in text, "タスク3.5（編集モード）: 挿入箇所が見つかりません"
text = text.replace(old_3_5b, new_3_5b, 1)
print("✅ タスク3.5: 郵送フィールドUI（編集モード）を追加しました")

# ============================================================
# UTF-8で書き込む（BOMなし）
# ============================================================
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n🎉 全ての変更を適用しました（UTF-8エンコーディング保持）")

# BOMチェック
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f"BOMチェック: {repr(first_bytes[:3])} (b'imp' などであればOK)")
