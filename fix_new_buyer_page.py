# -*- coding: utf-8 -*-
"""
NewBuyerPage.tsx の改修:
1. 業者問合せ TextField → Select ドロップダウン（「業者問合せ」「業者（両手）」）
2. 法人名入力時に業者問合せを required に
3. inquiryConfidence → latestStatus（★最新状況 ドロップダウン）
4. 登録後に「希望条件」「内覧」ボタンを表示
"""

with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. LATEST_STATUS_OPTIONS のインポートを追加
old_import = "import { INQUIRY_SOURCE_OPTIONS } from '../utils/buyerInquirySourceOptions';"
new_import = """import { INQUIRY_SOURCE_OPTIONS } from '../utils/buyerInquirySourceOptions';
import { LATEST_STATUS_OPTIONS } from '../utils/buyerLatestStatusOptions';"""
text = text.replace(old_import, new_import)

# 2. inquiryConfidence 状態変数を latestStatus に変更
old_state = "  const [inquiryConfidence, setInquiryConfidence] = useState('');"
new_state = "  const [latestStatus, setLatestStatus] = useState('');"
text = text.replace(old_state, new_state)

# 3. 登録完了後の状態変数を追加（registeredBuyerNumber）
old_navigate_import = "  const navigate = useNavigate();"
new_navigate_import = """  const navigate = useNavigate();
  const [registeredBuyerNumber, setRegisteredBuyerNumber] = useState<string | null>(null);"""
text = text.replace(old_navigate_import, new_navigate_import)

# 4. handleSubmit の buyerData を修正（inquiry_confidence → latest_status）
old_buyer_data = """        inquiry_hearing: inquiryHearing,
        inquiry_confidence: inquiryConfidence,
        initial_assignee: initialAssignee,"""
new_buyer_data = """        inquiry_hearing: inquiryHearing,
        latest_status: latestStatus,
        initial_assignee: initialAssignee,"""
text = text.replace(old_buyer_data, new_buyer_data)

# 5. handleSubmit の登録後処理を変更（登録完了後にボタン表示）
old_after_submit = """      await api.post('/api/buyers', buyerData);
      
      // 物件番号がある場合は物件詳細ページに戻る
      if (propertyNumberField) {
        navigate(`/property-listings/${propertyNumberField}`);
      } else {
        navigate('/buyers');
      }"""
new_after_submit = """      const response = await api.post('/api/buyers', buyerData);
      const createdBuyerNumber = response.data.buyer_number || nextBuyerNumber;
      setRegisteredBuyerNumber(createdBuyerNumber);"""
text = text.replace(old_after_submit, new_after_submit)

# 6. 業者問合せ TextField → Select ドロップダウン
old_broker_field = """                {showBrokerInquiry(companyName) && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="業者問合せ"
                      value={brokerInquiry}
                      onChange={(e) => setBrokerInquiry(e.target.value)}
                    />
                  </Grid>
                )}"""
new_broker_field = """                {showBrokerInquiry(companyName) && (
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required>
                      <InputLabel>業者問合せ</InputLabel>
                      <Select
                        value={brokerInquiry}
                        label="業者問合せ"
                        onChange={(e) => setBrokerInquiry(e.target.value)}
                      >
                        <MenuItem value="業者問合せ">業者問合せ</MenuItem>
                        <MenuItem value="業者（両手）">業者（両手）</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}"""
text = text.replace(old_broker_field, new_broker_field)

# 7. 問合時確度フィールドを ★最新状況 ドロップダウンに変更
old_confidence_field = """                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="問合時確度"
                    value={inquiryConfidence}
                    onChange={(e) => setInquiryConfidence(e.target.value)}
                    placeholder="例: A, B, C, S"
                  />
                </Grid>"""
new_confidence_field = """                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>★最新状況</InputLabel>
                    <Select
                      value={latestStatus}
                      label="★最新状況"
                      onChange={(e) => setLatestStatus(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {LATEST_STATUS_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>"""
text = text.replace(old_confidence_field, new_confidence_field)

# 8. 登録完了後のボタン表示を追加（フォームの前に挿入）
old_form_start = """      <Grid container spacing={3}>
        {/* 左側: 物件情報 */}"""
new_form_start = """      {/* 登録完了後のボタン表示 */}
      {registeredBuyerNumber && (
        <Box sx={{ mb: 3, p: 3, bgcolor: 'success.light', borderRadius: 2 }}>
          <Typography variant="h6" color="success.dark" gutterBottom>
            ✅ 買主番号 {registeredBuyerNumber} を登録しました
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
            <Button
              variant="contained"
              color="success"
              onClick={() => navigate(`/buyers/${registeredBuyerNumber}/desired-conditions`)}
            >
              希望条件を入力
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate(`/buyers/${registeredBuyerNumber}/viewing-result`)}
            >
              内覧を入力
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate(`/buyers/${registeredBuyerNumber}`)}
            >
              買主詳細を見る
            </Button>
            {propertyNumberField && (
              <Button
                variant="outlined"
                onClick={() => navigate(`/property-listings/${propertyNumberField}`)}
              >
                物件詳細に戻る
              </Button>
            )}
            <Button
              variant="outlined"
              onClick={() => navigate('/buyers')}
            >
              買主リストに戻る
            </Button>
          </Box>
        </Box>
      )}

      <Grid container spacing={3}>
        {/* 左側: 物件情報 */}"""
text = text.replace(old_form_start, new_form_start)

# UTF-8 で書き込む（BOMなし）
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! NewBuyerPage.tsx を修正しました')

# BOM チェック
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print('BOM check:', repr(first_bytes[:3]))
