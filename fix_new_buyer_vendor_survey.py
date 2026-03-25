# NewBuyerPage.tsx の変更スクリプト
# 1. vendorSurvey の state を追加
# 2. vendor_survey を POST データに追加
# 3. 問合時ヒアリングの直前に vendor_survey ボタン選択UIを追加
# 4. three_calls_confirmed を条件付き表示・2択ボタンに変更

with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# --- 変更1: vendorSurvey の state を追加 ---
old_state = """  // 問合せ情報（追加フィールド）
  const [inquiryEmailPhone, setInquiryEmailPhone] = useState('');
  const [threeCallsConfirmed, setThreeCallsConfirmed] = useState('');"""

new_state = """  // 問合せ情報（追加フィールド）
  const [inquiryEmailPhone, setInquiryEmailPhone] = useState('');
  const [threeCallsConfirmed, setThreeCallsConfirmed] = useState('');
  const [vendorSurvey, setVendorSurvey] = useState('');"""

if old_state in text:
    text = text.replace(old_state, new_state)
    print('変更1: vendorSurvey state 追加完了')
else:
    print('エラー: 変更1のターゲットが見つかりません')

# --- 変更2: vendor_survey を POST データに追加 ---
old_post = """        // 問合せ情報（追加）
        inquiry_email_phone: inquiryEmailPhone || null,
        three_calls_confirmed: threeCallsConfirmed || null,"""

new_post = """        // 問合せ情報（追加）
        inquiry_email_phone: inquiryEmailPhone || null,
        three_calls_confirmed: threeCallsConfirmed || null,
        vendor_survey: vendorSurvey || null,"""

if old_post in text:
    text = text.replace(old_post, new_post)
    print('変更2: vendor_survey POST データ追加完了')
else:
    print('エラー: 変更2のターゲットが見つかりません')

# --- 変更3: 問合時ヒアリングの直前に vendor_survey ボタン選択UIを追加 ---
old_hearing_before = """                <Grid item xs={12}>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      問合時ヒアリング
                    </Typography>"""

new_hearing_before = """                {/* 業者向けアンケート */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                      業者向けアンケート
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                      {['確認済み', '未'].map((opt) => {
                        const isSelected = vendorSurvey === opt;
                        return (
                          <Button
                            key={opt}
                            size="small"
                            variant={isSelected ? 'contained' : 'outlined'}
                            color="primary"
                            onClick={() => setVendorSurvey(isSelected ? '' : opt)}
                            sx={{ flex: 1, py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                          >
                            {opt}
                          </Button>
                        );
                      })}
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      問合時ヒアリング
                    </Typography>"""

if old_hearing_before in text:
    text = text.replace(old_hearing_before, new_hearing_before)
    print('変更3: vendor_survey UI 追加完了')
else:
    print('エラー: 変更3のターゲットが見つかりません')

# --- 変更4: three_calls_confirmed を条件付き表示・2択ボタンに変更 ---
old_three_calls = """                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>3回架電確認済み</InputLabel>
                    <Select
                      value={threeCallsConfirmed}
                      label="3回架電確認済み"
                      onChange={(e) => setThreeCallsConfirmed(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {THREE_CALLS_CONFIRMED_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>"""

new_three_calls = """                {/* 3回架電確認済み: inquiry_email_phone が「不通」のときのみ表示 */}
                {inquiryEmailPhone === '不通' && (
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" color="error" sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 'bold' }}>
                        3回架電確認済み *
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                        {['確認済み', '未'].map((opt) => {
                          const isSelected = threeCallsConfirmed === opt;
                          return (
                            <Button
                              key={opt}
                              size="small"
                              variant={isSelected ? 'contained' : 'outlined'}
                              color="primary"
                              onClick={() => setThreeCallsConfirmed(isSelected ? '' : opt)}
                              sx={{ flex: 1, py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                            >
                              {opt}
                            </Button>
                          );
                        })}
                      </Box>
                    </Box>
                  </Grid>
                )}"""

if old_three_calls in text:
    text = text.replace(old_three_calls, new_three_calls)
    print('変更4: three_calls_confirmed 条件付き表示・2択ボタンに変更完了')
else:
    print('エラー: 変更4のターゲットが見つかりません')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: NewBuyerPage.tsx を更新しました')
