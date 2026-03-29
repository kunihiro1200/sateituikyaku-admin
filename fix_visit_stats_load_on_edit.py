#!/usr/bin/env python3
# 訪問統計を訪問予約フォームを開いた時点で表示するよう修正
# 1. loadVisitStats を訪問日がなくても当月で呼べるよう変更
# 2. editingAppointment が true になった時に統計をロード

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: loadVisitStats を訪問日がなくても当月で呼べるよう変更
old_load = '''  // 訪問統計を取得
  const loadVisitStats = async () => {
    // visitDateまたはappointmentDateを使用
    const visitDateValue = (seller as any)?.visitDate || seller?.appointmentDate;
    if (!visitDateValue) {
      console.log('No visit date, skipping visit stats');
      return;
    }
    
    try {
      setLoadingVisitStats(true);
      
      // 訪問日から月を取得
      const visitDate = new Date(visitDateValue);
      const month = visitDate.toISOString().slice(0, 7); // YYYY-MM形式
      
      console.log('Loading visit stats for month:', month);
      const response = await api.get(`/api/sellers/visit-stats?month=${month}`);
      console.log('Visit stats loaded:', response.data);
      setVisitStats(response.data);
    } catch (err: any) {
      console.error('Failed to load visit stats:', err);
      console.error('Error details:', err.response?.data);
    } finally {
      setLoadingVisitStats(false);
    }
  };'''

new_load = '''  // 訪問統計を取得（訪問日がある場合はその月、なければ当月）
  const loadVisitStats = async () => {
    // visitDateまたはappointmentDateがあればその月、なければ当月を使用
    const visitDateValue = (seller as any)?.visitDate || seller?.appointmentDate;
    const month = visitDateValue
      ? new Date(visitDateValue).toISOString().slice(0, 7)
      : new Date().toISOString().slice(0, 7); // 当月（YYYY-MM形式）
    
    try {
      setLoadingVisitStats(true);
      
      console.log('Loading visit stats for month:', month);
      const response = await api.get(`/api/sellers/visit-stats?month=${month}`);
      console.log('Visit stats loaded:', response.data);
      setVisitStats(response.data);
    } catch (err: any) {
      console.error('Failed to load visit stats:', err);
      console.error('Error details:', err.response?.data);
    } finally {
      setLoadingVisitStats(false);
    }
  };'''

if old_load in text:
    text = text.replace(old_load, new_load)
    print('✅ loadVisitStats を修正しました')
else:
    print('❌ loadVisitStats の対象テキストが見つかりません')

# 修正2: useEffect を editingAppointment も監視するよう変更
old_effect = '''  // 訪問統計をロード（visitDateまたはappointmentDateがある場合）
  useEffect(() => {
    const visitDateValue = (seller as any)?.visitDate || seller?.appointmentDate;
    if (visitDateValue) {
      loadVisitStats();
    }
  }, [(seller as any)?.visitDate, seller?.appointmentDate]);'''

new_effect = '''  // 訪問統計をロード（訪問予約フォームを開いた時、またはvisitDate/appointmentDateがある場合）
  useEffect(() => {
    const visitDateValue = (seller as any)?.visitDate || seller?.appointmentDate;
    if (editingAppointment || visitDateValue) {
      loadVisitStats();
    }
  }, [editingAppointment, (seller as any)?.visitDate, seller?.appointmentDate]);'''

if old_effect in text:
    text = text.replace(old_effect, new_effect)
    print('✅ useEffect を修正しました')
else:
    print('❌ useEffect の対象テキストが見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
