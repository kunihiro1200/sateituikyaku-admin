// フィルター関数のテスト（AA13688）
// DBデータをそのままAPIレスポンス形式に変換してテスト

const seller = {
  sellerNumber: 'AA13688',
  status: '除外後追客中',
  nextCallDate: '2026-03-10',
  contactMethod: null,
  preferredContactTime: '林田',
  phoneContactPerson: null,
  visitAssignee: null,
  visitAssigneeInitials: null,
};

// フィルター関数を再現
const getTodayJSTString = (): string => {
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateString = (dateStr: any): string | null => {
  if (!dateStr) return null;
  try {
    let dateString = dateStr instanceof Date
      ? `${dateStr.getFullYear()}-${String(dateStr.getMonth()+1).padStart(2,'0')}-${String(dateStr.getDate()).padStart(2,'0')}`
      : String(dateStr);
    if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
    }
    if (dateString.includes('-')) {
      const datePart = dateString.split('T')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
    }
    return null;
  } catch { return null; }
};

const isTodayOrBefore = (dateStr: any): boolean => {
  const normalized = normalizeDateString(dateStr);
  if (!normalized) return false;
  return normalized <= getTodayJSTString();
};

const hasVisitAssignee = (s: any): boolean => {
  const va = s.visitAssigneeInitials || s.visit_assignee || s.visitAssignee || '';
  return !(!va || va.trim() === '' || va.trim() === '外す');
};

const hasContactInfo = (s: any): boolean => {
  const cm = s.contactMethod || s.contact_method || '';
  const pct = s.preferredContactTime || s.preferred_contact_time || '';
  const pcp = s.phoneContactPerson || s.phone_contact_person || '';
  return !!(
    (cm && cm.trim() !== '') ||
    (pct && pct.trim() !== '') ||
    (pcp && pcp.trim() !== '')
  );
};

const isTodayCallBase = (s: any): boolean => {
  const status = s.status || '';
  const isFollowingUp = typeof status === 'string' && status.includes('追客中');
  const nextCallDate = s.nextCallDate || s.next_call_date;
  return isFollowingUp && isTodayOrBefore(nextCallDate);
};

const isTodayCall = (s: any): boolean => {
  if (hasVisitAssignee(s)) return false;
  if (!isTodayCallBase(s)) return false;
  return !hasContactInfo(s);
};

const isTodayCallWithInfo = (s: any): boolean => {
  if (hasVisitAssignee(s)) return false;
  if (!isTodayCallBase(s)) return false;
  return hasContactInfo(s);
};

console.log('今日(JST):', getTodayJSTString());
console.log('next_call_date正規化:', normalizeDateString(seller.nextCallDate));
console.log('isTodayOrBefore(next_call_date):', isTodayOrBefore(seller.nextCallDate));
console.log('hasVisitAssignee:', hasVisitAssignee(seller));
console.log('hasContactInfo:', hasContactInfo(seller));
console.log('isTodayCallBase:', isTodayCallBase(seller));
console.log('isTodayCall:', isTodayCall(seller));
console.log('isTodayCallWithInfo:', isTodayCallWithInfo(seller));
