# -*- coding: utf-8 -*-
"""
Pinrich条件付き必須バリデーションを一括で実装するスクリプト
"""

# ファイルをUTF-8で読み込む
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

print('=== Pinrich条件付き必須バリデーション実装開始 ===\n')

# ステップ1: isPinrichRequired 関数を追加
print('ステップ1: isPinrichRequired 関数を追加')
insert_marker_1 = '  // owned_home_hearing_result が必須かどうかを判定するヘルパー'
if insert_marker_1 not in text:
    print('❌ エラー: 挿入位置が見つかりません (isPinrichRequired)')
    exit(1)

is_pinrich_required_function = '''  // Pinrich が必須かどうかを判定するヘルパー
  // AND(ISNOTBLANK([メールアドレス]), ISBLANK([業者問合せ]))
  const isPinrichRequired = (data: any): boolean => {
    if (!data) return false;
    
    // 条件1: メールアドレスが空白でないこと
    if (!data.email) return false;
    const emailTrimmed = String(data.email).trim();
    if (emailTrimmed.length === 0) return false;

    // 条件2: 業者問合せが空白であること
    if (data.broker_inquiry) {
      const brokerTrimmed = String(data.broker_inquiry).trim();
      if (brokerTrimmed.length > 0) return false;
    }

    return true;
  };

'''

text = text.replace(insert_marker_1, is_pinrich_required_function + insert_marker_1)
print('✅ isPinrichRequired 関数を追加しました\n')

# ステップ2: REQUIRED_FIELD_LABEL_MAP に pinrich を追加
print('ステップ2: REQUIRED_FIELD_LABEL_MAP に pinrich を追加')
old_label_map = '''  const REQUIRED_FIELD_LABEL_MAP: Record<string, string> = {
    initial_assignee: '初動担当',
    inquiry_source: '問合せ元',
    latest_status: '★最新状況',
    distribution_type: '配信メール',
    inquiry_email_phone: '【問合メール】電話対応',
    inquiry_email_reply: '【問合メール】メール返信',
    three_calls_confirmed: '3回架電確認済み',
    desired_area: 'エリア（希望条件）',
    desired_property_type: '希望種別（希望条件）',
    price_range_house: '価格帯（戸建）',
    price_range_apartment: '価格帯（マンション）',
    price_range_land: '価格帯（土地）',
    price_range_any: '価格帯（いずれか）',
    owned_home_hearing_result: '持家ヒアリング結果',
  };'''

if old_label_map not in text:
    print('❌ エラー: REQUIRED_FIELD_LABEL_MAP が見つかりません')
    exit(1)

new_label_map = '''  const REQUIRED_FIELD_LABEL_MAP: Record<string, string> = {
    initial_assignee: '初動担当',
    inquiry_source: '問合せ元',
    latest_status: '★最新状況',
    distribution_type: '配信メール',
    inquiry_email_phone: '【問合メール】電話対応',
    inquiry_email_reply: '【問合メール】メール返信',
    three_calls_confirmed: '3回架電確認済み',
    desired_area: 'エリア（希望条件）',
    desired_property_type: '希望種別（希望条件）',
    price_range_house: '価格帯（戸建）',
    price_range_apartment: '価格帯（マンション）',
    price_range_land: '価格帯（土地）',
    price_range_any: '価格帯（いずれか）',
    owned_home_hearing_result: '持家ヒアリング結果',
    pinrich: 'Pinrich',
  };'''

text = text.replace(old_label_map, new_label_map)
print('✅ REQUIRED_FIELD_LABEL_MAP に pinrich を追加しました\n')

# ステップ3: checkMissingFields 関数に Pinrich の条件付き必須チェックを追加
print('ステップ3: checkMissingFields 関数に Pinrich の条件付き必須チェックを追加')
insert_marker_3 = '''    // 持家ヒアリング結果：条件付き必須
    if (isHomeHearingResultRequired(buyer) && (!buyer.owned_home_hearing_result || !String(buyer.owned_home_hearing_result).trim())) {
      missingKeys.push('owned_home_hearing_result');
    }'''

if insert_marker_3 not in text:
    print('❌ エラー: 挿入位置が見つかりません (checkMissingFields)')
    exit(1)

pinrich_check = '''

    // Pinrich：条件付き必須
    if (isPinrichRequired(buyer) && 
        (!buyer.pinrich || !String(buyer.pinrich).trim() || buyer.pinrich === '未選択')) {
      missingKeys.push('pinrich');
    }'''

text = text.replace(insert_marker_3, insert_marker_3 + pinrich_check)
print('✅ checkMissingFields 関数に Pinrich の条件付き必須チェックを追加しました\n')

# ステップ4: fetchBuyer 関数内に Pinrich の初期チェックを追加
print('ステップ4: fetchBuyer 関数内に Pinrich の初期チェックを追加')
insert_marker_4 = '''      // 持家ヒアリング結果：条件付き必須
      if (isHomeHearingResultRequired(res.data) && (!res.data.owned_home_hearing_result || !String(res.data.owned_home_hearing_result).trim())) {
        initialMissing.push('owned_home_hearing_result');
      }'''

if insert_marker_4 not in text:
    print('❌ エラー: 挿入位置が見つかりません (fetchBuyer)')
    exit(1)

pinrich_initial_check = '''
      // Pinrich：条件付き必須
      if (isPinrichRequired(res.data) && 
          (!res.data.pinrich || !String(res.data.pinrich).trim() || res.data.pinrich === '未選択')) {
        initialMissing.push('pinrich');
      }'''

text = text.replace(insert_marker_4, insert_marker_4 + pinrich_initial_check)
print('✅ fetchBuyer 関数内に Pinrich の初期チェックを追加しました\n')

# ステップ5: 動的バリデーション用の useEffect を追加
print('ステップ5: 動的バリデーション用の useEffect を追加')
insert_marker_5 = '''  useEffect(() => {
    if (buyer_number && isValidBuyerNumber) {
      fetchBuyer();
      fetchLinkedProperties();
      fetchInquiryHistory();
      fetchInquiryHistoryTable();
      fetchRelatedBuyersCount();
      fetchActivities();
    }
  }, [buyer_number, isValidBuyerNumber]);'''

if insert_marker_5 not in text:
    print('❌ エラー: 挿入位置が見つかりません (useEffect)')
    exit(1)

dynamic_validation_useeffect = '''

  // Pinrich の動的バリデーション
  useEffect(() => {
    if (buyer) {
      checkMissingFields();
    }
  }, [buyer?.email, buyer?.broker_inquiry, buyer?.pinrich]);'''

text = text.replace(insert_marker_5, insert_marker_5 + dynamic_validation_useeffect)
print('✅ 動的バリデーション用の useEffect を追加しました\n')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('=== 全ての変更を適用しました ===')
print('\n次のステップ:')
print('1. getDiagnostics でエラーがないか確認')
print('2. ブラウザで動作確認')
