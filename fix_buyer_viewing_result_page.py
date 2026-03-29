# -*- coding: utf-8 -*-
"""
BuyerViewingResultPage.tsx に以下の変更を適用するスクリプト:
1. useAuthStore のインポートを追加
2. normalInitials ステートを追加
3. normalInitials を取得する useEffect を追加
4. 内覧情報行から「通知送信者」の InlineEditableField を削除
5. ヘッダーの内覧前日ボタン群を変更（onEmailSent追加 + 通知送信者ボタン群追加）
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 1. useAuthStore のインポートを追加
# ============================================================
old_import = "import PreDayEmailButton from '../components/PreDayEmailButton';\nimport SmsIcon from '@mui/icons-material/Sms';"
new_import = "import PreDayEmailButton from '../components/PreDayEmailButton';\nimport SmsIcon from '@mui/icons-material/Sms';\nimport { useAuthStore } from '../store/authStore';"

if old_import in text:
    text = text.replace(old_import, new_import)
    print('✅ 1. useAuthStore インポートを追加しました')
else:
    print('❌ 1. インポート箇所が見つかりませんでした')

# ============================================================
# 2. normalInitials ステートを追加
# ============================================================
old_state = "  const [isOfferFailedFlag, setIsOfferFailedFlag] = useState(false); // 買付外れましたフラグ"
new_state = "  const [isOfferFailedFlag, setIsOfferFailedFlag] = useState(false); // 買付外れましたフラグ\n  const [normalInitials, setNormalInitials] = useState<string[]>([]);"

if old_state in text:
    text = text.replace(old_state, new_state)
    print('✅ 2. normalInitials ステートを追加しました')
else:
    print('❌ 2. ステート追加箇所が見つかりませんでした')

# ============================================================
# 3. normalInitials を取得する useEffect を追加
# ============================================================
old_effect = "  const fetchBuyer = async () => {"
new_effect = """  useEffect(() => {
    api.get('/api/employees/normal-initials')
      .then(res => setNormalInitials(res.data.initials || []))
      .catch(err => console.error('Failed to fetch normal initials:', err));
  }, []);

  const fetchBuyer = async () => {"""

if old_effect in text:
    text = text.replace(old_effect, new_effect)
    print('✅ 3. normalInitials useEffect を追加しました')
else:
    print('❌ 3. useEffect 追加箇所が見つかりませんでした')

# ============================================================
# 4. useAuthStore から employee を取得する行を追加
#    （既存の const { buyer_number } = useParams の近くに）
# ============================================================
old_navigate = "  const { buyer_number } = useParams<{ buyer_number: string }>();\n  const navigate = useNavigate();"
new_navigate = "  const { buyer_number } = useParams<{ buyer_number: string }>();\n  const navigate = useNavigate();\n  const { employee } = useAuthStore();"

if old_navigate in text:
    text = text.replace(old_navigate, new_navigate)
    print('✅ 4. employee = useAuthStore() を追加しました')
else:
    print('❌ 4. useAuthStore 使用箇所が見つかりませんでした')

# ============================================================
# 5. 内覧情報行から「通知送信者」の InlineEditableField を削除
# ============================================================
old_notification_sender_field = """
            {/* 通知送信者 */}
            <Box sx={{ width: '200px', flexShrink: 0 }}>
              <InlineEditableField
                label="通知送信者"
                fieldName="notification_sender"
                value={buyer.notification_sender || ''}
                onSave={(newValue) => handleInlineFieldSave('notification_sender', newValue)}
                fieldType="text"
                placeholder="例: 山田"
              />
            </Box>

"""
new_notification_sender_field = "\n"

if old_notification_sender_field in text:
    text = text.replace(old_notification_sender_field, new_notification_sender_field)
    print('✅ 5. 通知送信者 InlineEditableField を削除しました')
else:
    print('❌ 5. 通知送信者フィールドが見つかりませんでした')

# ============================================================
# 6. ヘッダーの内覧前日ボタン群を変更
# ============================================================
old_preday_buttons = """        {/* 内覧前日ボタン群（内覧日前日の場合のみ表示） */}
        {isViewingPreDay(buyer) && (
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* メアドがある場合はEメールボタン */}
            {buyer.email && (
              <PreDayEmailButton
                buyerId={buyer_number || ''}
                buyerEmail={buyer.email || ''}
                buyerName={buyer.name || ''}
                buyerCompanyName={buyer.company_name || ''}
                buyerNumber={buyer_number || ''}
                preViewingNotes={buyer.pre_viewing_notes || ''}
                latestViewingDate={buyer.latest_viewing_date || ''}
                viewingTime={buyer.viewing_time || ''}
                inquiryHistory={[]}
                selectedPropertyIds={selectedPropertyIds}
                propertyNumbers={linkedProperties.map((p: any) => p.property_number).filter(Boolean)}
                size="medium"
              />
            )}
            {/* メアドがない場合（または電話番号がある場合）はSMSボタン */}
            {!buyer.email && buyer.phone_number && (() => {
              const property = linkedProperties.length > 0 ? linkedProperties[0] : null;
              const address = property?.property_address || property?.address || '';
              const googleMapUrl = property?.google_map_url || '';
              const smsBody = generatePreDaySmsBody(buyer, address, googleMapUrl);
              const smsLink = `sms:${buyer.phone_number}?body=${encodeURIComponent(smsBody)}`;
              return (
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={<SmsIcon />}
                  onClick={() => {
                    api.post(`/api/buyers/${buyer_number}/sms-history`, {
                      templateId: 'pre_day_viewing',
                      templateName: '内覧前日SMS',
                      phoneNumber: buyer.phone_number,
                      senderName: '',
                    }).catch(() => {});
                    window.open(smsLink, '_self');
                  }}
                  sx={{
                    backgroundColor: '#e65100',
                    color: '#fff',
                    fontWeight: 'bold',
                    '&:hover': { backgroundColor: '#bf360c' },
                    animation: 'preDayPulse 1.5s ease-in-out infinite',
                    '@keyframes preDayPulse': {
                      '0%': { boxShadow: '0 0 0 0 rgba(230, 81, 0, 0.6)' },
                      '70%': { boxShadow: '0 0 0 10px rgba(230, 81, 0, 0)' },
                      '100%': { boxShadow: '0 0 0 0 rgba(230, 81, 0, 0)' },
                    },
                  }}
                >
                  内覧前日SMS
                </Button>
              );
            })()}
            {/* 内覧日前日一覧ボタン */}
            <Button
              variant="outlined"
              color="success"
              size="medium"
              onClick={() => navigate('/buyers?status=内覧日前日')}
            >
              内覧日前日一覧
            </Button>
          </Box>
        )}"""

new_preday_buttons = """        {/* 内覧前日ボタン群（内覧日前日の場合のみ表示） */}
        {isViewingPreDay(buyer) && (
          <Box sx={{ ml: 'auto', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {/* メアドがある場合はEメールボタン */}
              {buyer.email && (
                <PreDayEmailButton
                  buyerId={buyer_number || ''}
                  buyerEmail={buyer.email || ''}
                  buyerName={buyer.name || ''}
                  buyerCompanyName={buyer.company_name || ''}
                  buyerNumber={buyer_number || ''}
                  preViewingNotes={buyer.pre_viewing_notes || ''}
                  latestViewingDate={buyer.latest_viewing_date || ''}
                  viewingTime={buyer.viewing_time || ''}
                  inquiryHistory={[]}
                  selectedPropertyIds={selectedPropertyIds}
                  propertyNumbers={linkedProperties.map((p: any) => p.property_number).filter(Boolean)}
                  size="medium"
                  onEmailSent={async () => {
                    // メール送信後、ログイン中のスタッフのイニシャルを通知送信者に自動設定
                    const senderInitial = employee?.initial || employee?.name || '';
                    if (senderInitial) {
                      await handleInlineFieldSave('notification_sender', senderInitial);
                    }
                  }}
                />
              )}
              {/* メアドがない場合（または電話番号がある場合）はSMSボタン */}
              {!buyer.email && buyer.phone_number && (() => {
                const property = linkedProperties.length > 0 ? linkedProperties[0] : null;
                const address = property?.property_address || property?.address || '';
                const googleMapUrl = property?.google_map_url || '';
                const smsBody = generatePreDaySmsBody(buyer, address, googleMapUrl);
                const smsLink = `sms:${buyer.phone_number}?body=${encodeURIComponent(smsBody)}`;
                return (
                  <Button
                    variant="contained"
                    size="medium"
                    startIcon={<SmsIcon />}
                    onClick={() => {
                      api.post(`/api/buyers/${buyer_number}/sms-history`, {
                        templateId: 'pre_day_viewing',
                        templateName: '内覧前日SMS',
                        phoneNumber: buyer.phone_number,
                        senderName: '',
                      }).catch(() => {});
                      window.open(smsLink, '_self');
                    }}
                    sx={{
                      backgroundColor: '#e65100',
                      color: '#fff',
                      fontWeight: 'bold',
                      '&:hover': { backgroundColor: '#bf360c' },
                      animation: 'preDayPulse 1.5s ease-in-out infinite',
                      '@keyframes preDayPulse': {
                        '0%': { boxShadow: '0 0 0 0 rgba(230, 81, 0, 0.6)' },
                        '70%': { boxShadow: '0 0 0 10px rgba(230, 81, 0, 0)' },
                        '100%': { boxShadow: '0 0 0 0 rgba(230, 81, 0, 0)' },
                      },
                    }}
                  >
                    内覧前日SMS
                  </Button>
                );
              })()}
              {/* 内覧日前日一覧ボタン */}
              <Button
                variant="outlined"
                color="success"
                size="medium"
                onClick={() => navigate('/buyers?status=内覧日前日')}
              >
                内覧日前日一覧
              </Button>
            </Box>
            {/* 通知送信者ボタン群（内覧前日ボタンの下に表示） */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                通知送信者:
              </Typography>
              {normalInitials.map((initial) => {
                const isSelected = buyer.notification_sender === initial;
                return (
                  <Button
                    key={initial}
                    size="small"
                    variant={isSelected ? 'contained' : 'outlined'}
                    color="primary"
                    onClick={async () => {
                      const newValue = isSelected ? '' : initial;
                      await handleInlineFieldSave('notification_sender', newValue);
                    }}
                    sx={{ minWidth: 36, px: 1, py: 0.3, fontSize: '0.75rem', fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                  >
                    {initial}
                  </Button>
                );
              })}
              {/* 現在の値がリストにない場合も表示 */}
              {buyer.notification_sender && !normalInitials.includes(buyer.notification_sender) && (
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  sx={{ minWidth: 36, px: 1, py: 0.3, fontSize: '0.75rem', fontWeight: 'bold', borderRadius: 1 }}
                >
                  {buyer.notification_sender}
                </Button>
              )}
            </Box>
          </Box>
        )}"""

if old_preday_buttons in text:
    text = text.replace(old_preday_buttons, new_preday_buttons)
    print('✅ 6. ヘッダーの内覧前日ボタン群を変更しました')
else:
    print('❌ 6. 内覧前日ボタン群が見つかりませんでした')

# UTF-8 で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n✅ ファイルを保存しました')

# BOM チェック
with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])} (b\'imp\' などであればOK)')
