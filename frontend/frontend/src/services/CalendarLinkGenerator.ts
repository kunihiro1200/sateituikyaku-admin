/**
 * CalendarLinkGenerator
 * 
 * Google繧ｫ繝ｬ繝ｳ繝繝ｼ繝ｪ繝ｳ繧ｯ繧堤函謌舌☆繧九し繝ｼ繝薙せ
 */

interface Buyer {
  buyer_number: string;
  name?: string;
  phone_number?: string;
  email?: string;
  latest_viewing_date: string;
  viewing_time: string;
  follow_up_assignee: string;
  pre_viewing_notes?: string;
  [key: string]: any;
}

interface Employee {
  name: string;
  initials: string;
  email: string;
  [key: string]: any;
}

export class CalendarLinkGenerator {
  /**
   * Google繧ｫ繝ｬ繝ｳ繝繝ｼ繝ｪ繝ｳ繧ｯ繧堤函謌・   * @param buyer - 雋ｷ荳ｻ繝・・繧ｿ
   * @param employees - 蠕捺･ｭ蜩｡繝・・繧ｿ
   * @returns Google繧ｫ繝ｬ繝ｳ繝繝ｼ縺ｮ繧､繝吶Φ繝井ｽ懈・URL
   */
  static generateCalendarLink(buyer: Buyer, employees: Employee[]): string {
    // 蜀・ｦｧ譌･譎ゅｒ蜿門ｾ・    const viewingDate = new Date(buyer.latest_viewing_date);
    const viewingTime = buyer.viewing_time || '14:00';
    
    // 譎る俣繧偵ヱ繝ｼ繧ｹ
    const [hours, minutes] = viewingTime.split(':').map(Number);
    viewingDate.setHours(hours, minutes, 0, 0);
    
    // 邨ゆｺ・凾蛻ｻ・・譎る俣蠕鯉ｼ・    const endDate = new Date(viewingDate);
    endDate.setHours(viewingDate.getHours() + 1);
    
    // 譌･譎ゅヵ繧ｩ繝ｼ繝槭ャ繝・    const startDateStr = this.formatDateForCalendar(viewingDate);
    const endDateStr = this.formatDateForCalendar(endDate);
    
    // 繧､繝吶Φ繝医ち繧､繝医Ν
    const title = encodeURIComponent(`蜀・ｦｧ: ${buyer.name || buyer.buyer_number}`);
    
    // 蠕檎ｶ壽球蠖薙・繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ繧貞叙蠕・    const assignedEmployee = employees.find(e => 
      e.name === buyer.follow_up_assignee || 
      e.initials === buyer.follow_up_assignee || 
      e.email === buyer.follow_up_assignee
    );
    const assignedEmail = assignedEmployee?.email || '';
    
    // 隧ｳ邏ｰ諠・ｱ・亥ｾ檎ｶ壽球蠖薙・諠・ｱ繧貞性繧・・    let detailsText = `雋ｷ荳ｻ蜷・ ${buyer.name || buyer.buyer_number}\n` +
      `雋ｷ荳ｻ逡ｪ蜿ｷ: ${buyer.buyer_number}\n` +
      `髮ｻ隧ｱ: ${buyer.phone_number || '縺ｪ縺・}\n` +
      `繝｡繝ｼ繝ｫ: ${buyer.email || '縺ｪ縺・}\n`;
    
    if (assignedEmployee) {
      detailsText += `\n蠕檎ｶ壽球蠖・ ${assignedEmployee.name} (${assignedEmployee.email})\n`;
    }
    
    detailsText += `\n雋ｷ荳ｻ隧ｳ邏ｰ繝壹・繧ｸ:\n${window.location.origin}/buyers/${buyer.buyer_number}\n` +
      `\n蜀・ｦｧ蜑堺ｼ晞＃莠矩・ ${buyer.pre_viewing_notes || '縺ｪ縺・}`;
    
    const details = encodeURIComponent(detailsText);
    
    // 蠕檎ｶ壽球蠖薙ｒ繧ｲ繧ｹ繝医→縺励※霑ｽ蜉・・dd繝代Λ繝｡繝ｼ繧ｿ繧剃ｽｿ逕ｨ・・    // 縺薙ｌ縺ｫ繧医ｊ縲∝ｾ檎ｶ壽球蠖薙・繧ｫ繝ｬ繝ｳ繝繝ｼ縺ｫ繧ゅう繝吶Φ繝医′陦ｨ遉ｺ縺輔ｌ繧・    const addParam = assignedEmail ? `&add=${encodeURIComponent(assignedEmail)}` : '';
    
    // 繧ｿ繧､繝繧ｾ繝ｼ繝ｳ繧呈欠螳夲ｼ域律譛ｬ譎る俣・・    const ctz = '&ctz=Asia/Tokyo';
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateStr}/${endDateStr}&details=${details}${addParam}${ctz}`;
  }

  /**
   * Google繧ｫ繝ｬ繝ｳ繝繝ｼ逕ｨ縺ｮ譌･譎ゅヵ繧ｩ繝ｼ繝槭ャ繝茨ｼ・YYYMMDDTHHmmss・・   * @param date - 繝輔か繝ｼ繝槭ャ繝医☆繧区律譎・   * @returns 繝輔か繝ｼ繝槭ャ繝医＆繧後◆譌･譎よ枚蟄怜・
   */
  private static formatDateForCalendar(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hour}${minute}${second}`;
  }
}
