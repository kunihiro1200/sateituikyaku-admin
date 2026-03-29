#!/usr/bin/env python3
# 統計を常に表示するよう修正
# 1. useEffectの条件を削除して常にロード
# 2. loadVisitStatsを条件なしで当月の統計を取得
# 3. 表示モードの「訪問日」行を削除

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: useEffectを常にロードするよう変更（sellerロード後）
old_effect = """  // 訪問統計をロード（visitDate/appointmentDateがある場合）
  useEffect(() => {
    const visitDateValue = (seller as any)?.visitDate || seller?.appointmentDate;
    if (visitDateValue) {
      loadVisitStats();
    }
  }, [(seller as any)?.visitDate, seller?.appointmentDate]);"""

new_effect = """  // 訪問統計をロード（sellerがロードされたら常に当月の統計を表示）
  useEffect(() => {
    if (seller) {
      loadVisitStats();
    }
  }, [seller?.id]);"""

if old_effect in text:
    text = text.replace(old_effect, new_effect)
    print('✅ useEffectを修正しました')
else:
    print('❌ useEffectの対象テキストが見つかりません')

# 修正2: loadVisitStatsを常に当月の統計を取得するよう変更
old_load = """  // 訪問統計を取得（訪問日がある場合はその月、なければ当月）
  const loadVisitStats = async () => {
    // visitDateまたはappointmentDateがあればその月、なければ当月を使用
    const visitDateValue = (seller as any)?.visitDate || seller?.appointmentDate;
    const month = visitDateValue
      ? new Date(visitDateValue).toISOString().slice(0, 7)
      : new Date().toISOString().slice(0, 7); // 当月（YYYY-MM形式）"""

new_load = """  // 訪問統計を取得（常に当月の統計を表示）
  const loadVisitStats = async () => {
    // 常に当月の統計を表示（JSTで当月を計算）
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    const month = jstNow.toISOString().slice(0, 7); // YYYY-MM形式（JST）"""

if old_load in text:
    text = text.replace(old_load, new_load)
    print('✅ loadVisitStatsを修正しました')
else:
    print('❌ loadVisitStatsの対象テキストが見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
