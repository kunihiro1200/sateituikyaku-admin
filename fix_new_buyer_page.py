#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NewBuyerPage.tsx に法人名・業者問合せフィールドを追加するスクリプト
UTF-8エンコーディングで安全に書き込む
"""

with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. Selectコンポーネントのインポートを追加（MUIのインポートに追加）
old_import = """  Autocomplete,
} from '@mui/material';"""

new_import = """  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';"""

text = text.replace(old_import, new_import)

# 2. company_name と broker_inquiry の state を追加（基本情報セクションの後）
old_state = """  // 問合せ情報
  const [receptionDate, setReceptionDate] = useState(new Date().toISOString().split('T')[0]);"""

new_state = """  // 法人名・業者問合せ
  const [companyName, setCompanyName] = useState('');
  const [brokerInquiry, setBrokerInquiry] = useState('');

  // 問合せ情報
  const [receptionDate, setReceptionDate] = useState(new Date().toISOString().split('T')[0]);"""

text = text.replace(old_state, new_state)

# 3. showBrokerInquiry ヘルパー関数を追加（handleSubmit の前）
old_handle_submit = """  const handleSubmit = async (e: React.FormEvent) => {"""

new_handle_submit = """  // 法人名に入力がある場合のみ業者問合せを表示する
  const showBrokerInquiry = (name: string): boolean => {
    return Boolean(name && name.trim().length > 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {"""

text = text.replace(old_handle_submit, new_handle_submit)

# 4. 送信データに company_name と broker_inquiry を追加
old_buyer_data = """      const buyerData = {
        name,
        phone_number: phoneNumber,
        email,
        property_number: propertyNumberField,
        reception_date: receptionDate,
        inquiry_source: inquirySource,
        inquiry_hearing: inquiryHearing,
        inquiry_confidence: inquiryConfidence,
        desired_area: desiredArea,
        desired_property_type: desiredPropertyType,
        budget,
      };"""

new_buyer_data = """      const buyerData = {
        name,
        phone_number: phoneNumber,
        email,
        company_name: companyName,
        broker_inquiry: companyName.trim() ? brokerInquiry : '',
        property_number: propertyNumberField,
        reception_date: receptionDate,
        inquiry_source: inquirySource,
        inquiry_hearing: inquiryHearing,
        inquiry_confidence: inquiryConfidence,
        desired_area: desiredArea,
        desired_property_type: desiredPropertyType,
        budget,
      };"""

text = text.replace(old_buyer_data, new_buyer_data)

# 5. 基本情報セクションにメールアドレスの後に法人名・業者問合せフィールドを追加
old_email_field = """                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="メールアドレス"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Grid>

                {/* 問合せ情報 */}"""

new_email_field = """                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="メールアドレス"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="法人名"
                    value={companyName}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setCompanyName(newValue);
                      // 法人名がクリアされた場合は業者問合せをリセット
                      if (!newValue.trim()) {
                        setBrokerInquiry('');
                      }
                    }}
                    placeholder="法人の場合は会社名を入力"
                  />
                </Grid>

                {showBrokerInquiry(companyName) && (
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>業者問合せ</InputLabel>
                      <Select
                        value={brokerInquiry}
                        label="業者問合せ"
                        onChange={(e) => setBrokerInquiry(e.target.value)}
                      >
                        <MenuItem value="">
                          <em>未選択</em>
                        </MenuItem>
                        <MenuItem value="業者問合せ">業者問合せ</MenuItem>
                        <MenuItem value="業者（両手）">業者（両手）</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                {/* 問合せ情報 */}"""

text = text.replace(old_email_field, new_email_field)

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! NewBuyerPage.tsx updated successfully.')

# BOMチェック
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])} (should NOT be b"\\xef\\xbb\\xbf")')
