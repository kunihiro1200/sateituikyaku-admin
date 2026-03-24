#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NewBuyerPage.tsx に問合時持家ヒアリング関連の3フィールドを追加するスクリプト
- タスク4.1: 3フィールドの state を追加
- タスク4.2: 「問合せ情報」セクションに3フィールドのボタン選択UIを追加
- タスク4.3: handleSubmit の buyerData に3フィールドを追加
"""

with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== タスク4.1: 3フィールドの state を追加 =====
# 既存の ownedHomeHearing state の後に追加
old_state = "  const [ownedHomeHearing, setOwnedHomeHearing] = useState('');"
new_state = """  const [ownedHomeHearing, setOwnedHomeHearing] = useState('');
  const [ownedHomeHearingInquiry, setOwnedHomeHearingInquiry] = useState('');
  const [ownedHomeHearingResult, setOwnedHomeHearingResult] = useState('');
  const [valuationRequired, setValuationRequired] = useState('');"""

if old_state not in text:
    print("ERROR: ownedHomeHearing state が見つかりません")
    exit(1)

text = text.replace(old_state, new_state, 1)
print("✅ タスク4.1: state 追加完了")

# ===== タスク4.3: handleSubmit の buyerData に3フィールドを追加 =====
# 既存の owned_home_hearing の後に追加
old_submit = "        owned_home_hearing: ownedHomeHearing || null,"
new_submit = """        owned_home_hearing: ownedHomeHearing || null,
        owned_home_hearing_inquiry: ownedHomeHearingInquiry || null,
        owned_home_hearing_result: ownedHomeHearingResult || null,
        valuation_required: valuationRequired || null,"""

if old_submit not in text:
    print("ERROR: owned_home_hearing in buyerData が見つかりません")
    exit(1)

text = text.replace(old_submit, new_submit, 1)
print("✅ タスク4.3: handleSubmit buyerData 追加完了")

# ===== タスク4.2: 「問合せ情報」セクションに3フィールドのボタン選択UIを追加 =====
# 既存の ownedHomeHearing フィールド（TextField）の後、nextCallDate の前に追加
old_ui = """                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="持家ヒアリング"
                    value={ownedHomeHearing}
                    onChange={(e) => setOwnedHomeHearing(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="次電日"
                    type="date"
                    value={nextCallDate}"""

new_ui = """                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="持家ヒアリング"
                    value={ownedHomeHearing}
                    onChange={(e) => setOwnedHomeHearing(e.target.value)}
                  />
                </Grid>

                {/* 問合時持家ヒアリング */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap', flexShrink: 0, minWidth: 120 }}>
                      問合時持家ヒアリング
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                      {normalInitials.map((initial) => {
                        const isSelected = ownedHomeHearingInquiry === initial;
                        return (
                          <Button
                            key={initial}
                            size="small"
                            variant={isSelected ? 'contained' : 'outlined'}
                            color="primary"
                            onClick={() => setOwnedHomeHearingInquiry(isSelected ? '' : initial)}
                            sx={{ flex: 1, py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                          >
                            {initial}
                          </Button>
                        );
                      })}
                    </Box>
                  </Box>
                </Grid>

                {/* 持家ヒアリング結果 */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap', flexShrink: 0, minWidth: 120 }}>
                      持家ヒアリング結果
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                      {['持家（マンション）', '持家（戸建）', '賃貸', '他不明'].map((option) => {
                        const isSelected = ownedHomeHearingResult === option;
                        return (
                          <Button
                            key={option}
                            size="small"
                            variant={isSelected ? 'contained' : 'outlined'}
                            color="primary"
                            onClick={() => setOwnedHomeHearingResult(isSelected ? '' : option)}
                            sx={{ flex: 1, py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                          >
                            {option}
                          </Button>
                        );
                      })}
                    </Box>
                  </Box>
                </Grid>

                {/* 要査定 */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap', flexShrink: 0, minWidth: 120 }}>
                      要査定
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                      {['要', '不要'].map((option) => {
                        const isSelected = valuationRequired === option;
                        return (
                          <Button
                            key={option}
                            size="small"
                            variant={isSelected ? 'contained' : 'outlined'}
                            color="primary"
                            onClick={() => setValuationRequired(isSelected ? '' : option)}
                            sx={{ flex: 1, py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                          >
                            {option}
                          </Button>
                        );
                      })}
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="次電日"
                    type="date"
                    value={nextCallDate}"""

if old_ui not in text:
    print("ERROR: ownedHomeHearing UI が見つかりません")
    # デバッグ用に周辺テキストを表示
    idx = text.find('持家ヒアリング')
    if idx >= 0:
        print("Found '持家ヒアリング' at:", idx)
        print(repr(text[idx-100:idx+200]))
    exit(1)

text = text.replace(old_ui, new_ui, 1)
print("✅ タスク4.2: UI 追加完了")

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ ファイル書き込み完了")

# BOMチェック
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    check = f.read(3)
print('BOM check:', repr(check), '← b\'imp\' などであればOK')
