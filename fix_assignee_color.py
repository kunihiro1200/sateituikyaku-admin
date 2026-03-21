with open('frontend/frontend/src/components/AssigneeSection.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# SMS_TEMPLATE_ASSIGNEE_MAPの後にEMAIL_TEMPLATE_ASSIGNEE_MAPとACTIVITY_COLOR_LOGICを追加
old = """// SMSテンプレートID → 対応するsellerKeyのマッピング
export const SMS_TEMPLATE_ASSIGNEE_MAP: Partial<Record<string, keyof Seller>> = {
  initial_cancellation: 'unreachableSmsAssignee',
  cancellation:         'cancelNoticeAssignee',
  valuation:            'valuationSmsAssignee',
  long_term_customer:   'longTermEmailAssignee',
  call_reminder:        'callReminderEmailAssignee',
  visit_reminder:       'visitReminderAssignee',
};"""

new = """// SMSテンプレートID → 対応するsellerKeyのマッピング
export const SMS_TEMPLATE_ASSIGNEE_MAP: Partial<Record<string, keyof Seller>> = {
  initial_cancellation: 'unreachableSmsAssignee',
  cancellation:         'cancelNoticeAssignee',
  valuation:            'valuationSmsAssignee',
  long_term_customer:   'longTermEmailAssignee',
  call_reminder:        'callReminderEmailAssignee',
  visit_reminder:       'visitReminderAssignee',
};

// EmailテンプレートID → 対応するsellerKeyのマッピング
export const EMAIL_TEMPLATE_ASSIGNEE_MAP: Partial<Record<string, keyof Seller>> = {
  // キャンセル案内系
  ieul_call_cancel:            'cancelNoticeAssignee',
  ieul_cancel_only:            'cancelNoticeAssignee',
  lifull_yahoo_call_cancel:    'cancelNoticeAssignee',
  lifull_yahoo_cancel_only:    'cancelNoticeAssignee',
  sumai_step_call_cancel:      'cancelNoticeAssignee',
  sumai_step_cancel_only:      'cancelNoticeAssignee',
  home4u_call_cancel:          'cancelNoticeAssignee',
  // 査定理由別3日後メール系
  reason_relocation_3day:      'valuationReasonEmailAssignee',
  reason_inheritance_3day:     'valuationReasonEmailAssignee',
  reason_divorce_3day:         'valuationReasonEmailAssignee',
  reason_loan_3day:            'valuationReasonEmailAssignee',
  // 長期客メール
  exclusion_long_term:         'longTermEmailAssignee',
  // リマインドメール
  remind:                      'callReminderEmailAssignee',
  // 訪問前日通知メール
  visit_reminder:              'visitReminderAssignee',
};

// sellerKey → SMS送信済みかどうかを活動履歴から判定するためのラベルマッピング
// SMS_TEMPLATE_ASSIGNEE_MAPの逆引き用（label → sellerKey）
export const SMS_LABEL_TO_SELLER_KEY: Record<string, keyof Seller> = {
  '不通時Sメール':                   'unreachableSmsAssignee',
  'キャンセル案内':                   'cancelNoticeAssignee',
  '査定Sメール':                     'valuationSmsAssignee',
  '除外前・長期客Sメール':            'longTermEmailAssignee',
  '当社が電話したというリマインドメール': 'callReminderEmailAssignee',
  '訪問事前通知メール':               'visitReminderAssignee',
};

// sellerKey → Email送信済みかどうかを活動履歴から判定するためのラベルマッピング
export const EMAIL_LABEL_TO_SELLER_KEY: Record<string, keyof Seller> = {
  // キャンセル案内系
  '不通で電話時間確認＆キャンセル案内（イエウール）':       'cancelNoticeAssignee',
  'キャンセル案内のみ（イエウール）':                       'cancelNoticeAssignee',
  '不通で電話時間確認＆キャンセル案内（LIFULLとYahoo）':   'cancelNoticeAssignee',
  'キャンセル案内のみ（LIFULLとYahoo）':                   'cancelNoticeAssignee',
  '不通で電話時間確認＆キャンセル案内（すまいステップ）':   'cancelNoticeAssignee',
  'キャンセル案内のみ（すまいステップ）':                   'cancelNoticeAssignee',
  '不通で電話時間確認＆キャンセル案内（HOME4U）':           'cancelNoticeAssignee',
  // 査定理由別3日後メール系
  '（査定理由別）住替え先（３日後メール）':                 'valuationReasonEmailAssignee',
  '（査定理由別）相続（３日後メール）':                     'valuationReasonEmailAssignee',
  '（査定理由別）離婚（３日後メール）':                     'valuationReasonEmailAssignee',
  '（査定理由別）ローン厳しい（３日後メール）':             'valuationReasonEmailAssignee',
  // 長期客メール
  '除外前、長期客（お客様いるメール）':                     'longTermEmailAssignee',
  // リマインドメール
  'リマインド':                                             'callReminderEmailAssignee',
  // 訪問前日通知メール
  '☆訪問前日通知メール':                                   'visitReminderAssignee',
};

// 活動履歴からsellerKeyごとの送信状態を計算する関数
// 戻り値: { [sellerKey]: 'sms' | 'email' | 'both' | null }
export function calcSendStatus(
  activities: { type: string; content: string }[]
): Partial<Record<keyof Seller, 'sms' | 'email' | 'both'>> {
  const smsSent = new Set<keyof Seller>();
  const emailSent = new Set<keyof Seller>();

  for (const act of activities) {
    // contentから【ラベル】を抽出
    const match = act.content?.match(/^【(.+?)】/);
    if (!match) continue;
    const label = match[1];

    if (act.type === 'sms') {
      const key = SMS_LABEL_TO_SELLER_KEY[label];
      if (key) smsSent.add(key);
    } else if (act.type === 'email') {
      const key = EMAIL_LABEL_TO_SELLER_KEY[label];
      if (key) emailSent.add(key);
    }
  }

  const result: Partial<Record<keyof Seller, 'sms' | 'email' | 'both'>> = {};
  const allKeys = new Set([...smsSent, ...emailSent]);
  for (const key of allKeys) {
    const hasSms = smsSent.has(key);
    const hasEmail = emailSent.has(key);
    if (hasSms && hasEmail) result[key] = 'both';
    else if (hasSms) result[key] = 'sms';
    else result[key] = 'email';
  }
  return result;
}"""

if old in text:
    text = text.replace(old, new)
    print('✅ マッピング追加成功')
else:
    print('❌ 対象文字列が見つかりません')
    # デバッグ用
    idx = text.find('SMS_TEMPLATE_ASSIGNEE_MAP')
    print(f'SMS_TEMPLATE_ASSIGNEE_MAP位置: {idx}')

# AssigneeSectionPropsにactivitiesを追加
old2 = """interface AssigneeSectionProps {
  seller: Seller;
  onUpdate: (updatedFields: Partial<Seller>) => void;
  /** SMS送信後に呼び出す: templateId と送信者イニシャルを渡す */
  onSmsTemplateUsed?: (templateId: string, initial: string) => void;
}"""

new2 = """interface AssigneeSectionProps {
  seller: Seller;
  onUpdate: (updatedFields: Partial<Seller>) => void;
  /** 活動履歴（SMS/Email送信状態の色付けに使用） */
  activities?: { type: string; content: string }[];
  /** SMS送信後に呼び出す: templateId と送信者イニシャルを渡す */
  onSmsTemplateUsed?: (templateId: string, initial: string) => void;
}"""

if old2 in text:
    text = text.replace(old2, new2)
    print('✅ Props追加成功')
else:
    print('❌ Props対象文字列が見つかりません')

# コンポーネント本体でactivitiesを受け取り、sendStatusを計算
old3 = """export const AssigneeSection: React.FC<AssigneeSectionProps> = ({ seller, onUpdate, onSmsTemplateUsed }) => {
  const [initials, setInitials] = useState<string[]>([]);"""

new3 = """export const AssigneeSection: React.FC<AssigneeSectionProps> = ({ seller, onUpdate, activities = [], onSmsTemplateUsed }) => {
  const [initials, setInitials] = useState<string[]>([]);

  // 活動履歴からSMS/Email送信状態を計算
  const sendStatus = calcSendStatus(activities);"""

if old3 in text:
    text = text.replace(old3, new3)
    print('✅ sendStatus計算追加成功')
else:
    print('❌ コンポーネント本体対象文字列が見つかりません')

# ボタンの色付けロジックを変更
# currentValue === initial の場合の色をsendStatusに基づいて変更
old4 = """                {initials.map((initial) => (
                  <Button
                    key={initial}
                    size="small"
                    variant={currentValue === initial ? 'contained' : 'outlined'}
                    color={currentValue === initial ? 'primary' : 'inherit'}
                    onClick={() => handleButtonClick(field.sellerKey, initial)}
                    sx={{
                      py: 0.75,
                      fontSize: '0.85rem',
                      bgcolor: currentValue === initial ? undefined : 'grey.100',
                      borderColor: 'grey.300',
                    }}
                  >
                    {initial}
                  </Button>
                ))}"""

new4 = """                {initials.map((initial) => {
                  const isSelected = currentValue === initial;
                  const status = sendStatus[field.sellerKey];
                  // 選択中ボタンの色: SMS→赤、Email→青、両方→オレンジ、未送信→デフォルト青
                  let btnBgColor: string | undefined = undefined;
                  let btnColor: 'primary' | 'error' | 'inherit' = isSelected ? 'primary' : 'inherit';
                  if (isSelected && status) {
                    if (status === 'sms') {
                      btnBgColor = '#f44336';
                      btnColor = 'inherit';
                    } else if (status === 'email') {
                      btnBgColor = '#1976d2';
                      btnColor = 'inherit';
                    } else if (status === 'both') {
                      btnBgColor = '#ff9800';
                      btnColor = 'inherit';
                    }
                  }
                  return (
                    <Button
                      key={initial}
                      size="small"
                      variant={isSelected ? 'contained' : 'outlined'}
                      color={btnColor}
                      onClick={() => handleButtonClick(field.sellerKey, initial)}
                      sx={{
                        py: 0.75,
                        fontSize: '0.85rem',
                        bgcolor: isSelected ? (btnBgColor ?? undefined) : 'grey.100',
                        borderColor: 'grey.300',
                        '&:hover': isSelected && btnBgColor ? { bgcolor: btnBgColor, opacity: 0.85 } : {},
                        color: isSelected && btnBgColor ? '#fff' : undefined,
                      }}
                    >
                      {initial}
                    </Button>
                  );
                })}"""

if old4 in text:
    text = text.replace(old4, new4)
    print('✅ ボタン色付けロジック変更成功')
else:
    print('❌ ボタン色付け対象文字列が見つかりません')

with open('frontend/frontend/src/components/AssigneeSection.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
