#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NewBuyerPage.tsx の修正（第2弾）:
- 「持家ヒアリング」関連を削除
- 「担当への確認事項」を削除
- 「担当への伝言/質問事項」にチャット送信ボタンを追加
- chatSending, chatSent stateを追加
"""

filepath = "frontend/frontend/src/pages/NewBuyerPage.tsx"

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. 持家ヒアリング関連を削除（next_call_dateの後から希望条件の前まで）
# 「次電日」の後に「持家ヒアリング」が来ている
old_section = """                {/* next_call_date: date input */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="次電日"
                    type="date"
                    value={nextCallDate}
                    onChange={(e) => setNextCallDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {/* owned_home_hearing_inquiry: normalInitials からのボックス選択 */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      問合時持家ヒアリング
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {normalInitials.map((initial) => {
                        const isSelected = ownedHomeHearingInquiry === initial;
                        return (
                          <Button
                            key={initial}
                            size="small"
                            variant={isSelected ? 'contained' : 'outlined'}
                            color="primary"
                            onClick={() => setOwnedHomeHearingInquiry(isSelected ? '' : initial)}
                            sx={{ minWidth: 40, px: 1.5, py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                          >
                            {initial}
                          </Button>
                        );
                      })}
                    </Box>
                  </Box>
                </Grid>

                {/* owned_home_hearing_result: owned_home_hearing_inquiryに値がない場合は非表示 */}
                {ownedHomeHearingInquiry && (
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        持家ヒアリング結果
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {['持家（マンション）', '持家（戸建）', '購貸', '他不明'].map((option) => {
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
                )}

                {/* valuation_required: 持家（マンション）または持家（戸建）の場合のみ表示 */}
                {['持家（マンション）', '持家（戸建）'].includes(ownedHomeHearingResult) && (
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        要査定
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
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
                )}

                {/* 希望条件 */}"""

new_section = """                {/* next_call_date: date input */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="次電日"
                    type="date"
                    value={nextCallDate}
                    onChange={(e) => setNextCallDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {/* 希望条件 */}"""

if old_section in text:
    text = text.replace(old_section, new_section)
    print("✅ 持家ヒアリング削除 OK")
else:
    print("❌ 持家ヒアリング削除 FAILED - 文字列が見つかりません")

# 2. 「担当への確認事項」フィールドを削除
old_confirmation = """                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="担当への確認事項"
                    multiline
                    rows={2}
                    value={confirmationToAssignee}
                    onChange={(e) => setConfirmationToAssignee(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="家族構成\""""

new_confirmation = """                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="家族構成\""""

if old_confirmation in text:
    text = text.replace(old_confirmation, new_confirmation)
    print("✅ 担当への確認事項削除 OK")
else:
    print("❌ 担当への確認事項削除 FAILED - 文字列が見つかりません")
    # デバッグ: 周辺を確認
    idx = text.find("担当への確認事項")
    if idx >= 0:
        print(f"  → '担当への確認事項' は {idx} 行目付近に存在")
        print(repr(text[idx-200:idx+300]))

# 3. 「担当への伝言/質問事項」にチャット送信ボタンを追加
old_message = """                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="担当への伝言/質問事項"
                    multiline
                    rows={2}
                    value={messageToAssignee}
                    onChange={(e) => setMessageToAssignee(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="家族構成\""""

new_message = """                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="担当への伝言/質問事項"
                    multiline
                    rows={2}
                    value={messageToAssignee}
                    onChange={(e) => setMessageToAssignee(e.target.value)}
                  />
                  {/* 入力があれば担当へCHAT送信ボタンを表示 */}
                  {messageToAssignee.trim() && propertyNumberField && (
                    <Button
                      variant="contained"
                      size="small"
                      disabled={chatSending}
                      onClick={async () => {
                        setChatSending(true);
                        try {
                          await api.post(`/api/property-listings/${propertyNumberField}/send-chat-to-assignee`, {
                            message: messageToAssignee,
                            senderName: '新規登録',
                          });
                          setChatSent(true);
                          setTimeout(() => setChatSent(false), 3000);
                        } catch (err) {
                          console.error('チャット送信失敗:', err);
                        } finally {
                          setChatSending(false);
                        }
                      }}
                      sx={{ mt: 1, bgcolor: '#7b1fa2', '&:hover': { bgcolor: '#4a148c' } }}
                    >
                      {chatSending ? '送信中...' : chatSent ? '✅ 送信済み' : '担当へCHAT送信'}
                    </Button>
                  )}
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="家族構成\""""

if old_message in text:
    text = text.replace(old_message, new_message)
    print("✅ チャット送信ボタン追加 OK")
else:
    print("❌ チャット送信ボタン追加 FAILED - 文字列が見つかりません")
    idx = text.find("担当への伝言/質問事項")
    if idx >= 0:
        print(f"  → '担当への伝言/質問事項' は {idx} 付近に存在")
        print(repr(text[idx-100:idx+500]))

# 4. chatSending, chatSent の state を追加（まだなければ）
if 'chatSending' not in text:
    old_state = """  // その他
  const [specialNotes, setSpecialNotes] = useState('');
  const [messageToAssignee, setMessageToAssignee] = useState('');"""

    new_state = """  // チャット送信状態
  const [chatSending, setChatSending] = useState(false);
  const [chatSent, setChatSent] = useState(false);

  // その他
  const [specialNotes, setSpecialNotes] = useState('');
  const [messageToAssignee, setMessageToAssignee] = useState('');"""

    if old_state in text:
        text = text.replace(old_state, new_state)
        print("✅ chatSending/chatSent state追加 OK")
    else:
        print("❌ state追加 FAILED")
else:
    print("ℹ️ chatSending は既に存在")

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print("\nDone!")
