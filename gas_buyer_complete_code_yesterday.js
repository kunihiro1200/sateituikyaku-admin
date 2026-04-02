// ============================================================
// 險ｭ螳・// ============================================================
var BUYER_SYNC_CONFIG = {
  BACKEND_URL: 'https://sateituikyaku-admin-backend.vercel.app',
  CRON_SECRET: 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=',
  SYNC_INTERVAL_MINUTES: 10
};

var SUPABASE_CONFIG = {
  URL: 'https://krxhrbtlgfjzsseegaqq.supabase.co',
  SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8'
};

// ============================================================
// 繝ｦ繝ｼ繝・ぅ繝ｪ繝・ぅ
// ============================================================
function rowToObject(headers, rowData) {
  var obj = {};
  for (var j = 0; j < headers.length; j++) {
    var headerName = String(headers[j]).trim();
    if (headerName === '') continue;
    var val = rowData[j];
    if (val instanceof Date) {
      if (val.getTime() === 0) {
        obj[headerName] = '';
      } else {
        obj[headerName] = val.getFullYear() + '/' +
          String(val.getMonth() + 1).padStart(2, '0') + '/' +
          String(val.getDate()).padStart(2, '0');
      }
    } else {
      // 雋ｷ荳ｻ逡ｪ蜿ｷ縺ｯ蠢・★譁・ｭ怜・蝙九↓螟画鋤
      if (headerName === '雋ｷ荳ｻ逡ｪ蜿ｷ' && val !== null && val !== undefined && val !== '') {
        obj[headerName] = String(val);
      } else {
        obj[headerName] = val;
      }
    }
  }
  return obj;
}

function formatDateToISO_(value) {
  if (!value || value === '') return null;
  
  // 謨ｰ蛟､・・xcel繧ｷ繝ｪ繧｢繝ｫ蛟､・峨・蝣ｴ蜷・  if (typeof value === 'number') {
    var excelEpoch = new Date(1899, 11, 30);
    var days = value > 60 ? value - 1 : value;
    var date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
  
  var str = String(value).trim();
  if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
    var parts = str.split('/');
    return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
  }
  if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
    var parts2 = str.split('-');
    return parts2[0] + '-' + parts2[1].padStart(2, '0') + '-' + parts2[2].padStart(2, '0');
  }
  return null;
}

function isTodayOrBefore(dateStr) {
  if (!dateStr) return false;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
  return dateStr <= todayStr;
}

function isValidContactValue(v) {
  if (!v) return false;
  var s = String(v).trim();
  return s !== '' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined';
}

function hasContactInfo(row) {
  return isValidContactValue(row['騾｣邨｡譁ｹ豕・]) ||
    isValidContactValue(row['騾｣邨｡蜿悶ｊ繧・☆縺・律縲∵凾髢灘ｸｯ']) ||
    isValidContactValue(row['髮ｻ隧ｱ諡・ｽ難ｼ井ｻｻ諢擾ｼ・]);
}

function getContactLabel(row) {
  var parts = [];
  if (isValidContactValue(row['髮ｻ隧ｱ諡・ｽ難ｼ井ｻｻ諢擾ｼ・])) parts.push(String(row['髮ｻ隧ｱ諡・ｽ難ｼ井ｻｻ諢擾ｼ・]).trim());
  if (isValidContactValue(row['騾｣邨｡蜿悶ｊ繧・☆縺・律縲∵凾髢灘ｸｯ'])) parts.push(String(row['騾｣邨｡蜿悶ｊ繧・☆縺・律縲∵凾髢灘ｸｯ']).trim());
  if (isValidContactValue(row['騾｣邨｡譁ｹ豕・])) parts.push(String(row['騾｣邨｡譁ｹ豕・]).trim());
  return parts.join('繝ｻ');
}

// ============================================================
// 繧ｵ繧､繝峨ヰ繝ｼ繧ｫ繧ｦ繝ｳ繝域峩譁ｰ・・uyer_sidebar_counts 繝・・繝悶Ν縺ｸ譖ｸ縺崎ｾｼ縺ｿ・・// ============================================================
function updateBuyerSidebarCounts_() {
  Logger.log('投 雋ｷ荳ｻ繧ｵ繧､繝峨ヰ繝ｼ繧ｫ繧ｦ繝ｳ繝域峩譁ｰ髢句ｧ・..');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('雋ｷ荳ｻ繝ｪ繧ｹ繝・);
  if (!sheet) {
    Logger.log('笶・繧ｷ繝ｼ繝医瑚ｲｷ荳ｻ繝ｪ繧ｹ繝医阪′隕九▽縺九ｊ縺ｾ縺帙ｓ');
    return;
  }
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var sheetRows = [];
  for (var i = 0; i < allData.length; i++) {
    sheetRows.push(rowToObject(headers, allData[i]));
  }
  
  Logger.log('投 繧ｹ繝励Ξ繝・ラ繧ｷ繝ｼ繝郁｡梧焚: ' + sheetRows.length);
  
  var counts = {
    todayCall: 0,
    todayCallWithInfo: {},
    todayCallAssigned: {},
    assigned: {}
  };
  
  for (var i = 0; i < sheetRows.length; i++) {
    var row = sheetRows[i];
    var buyerNumber = row['雋ｷ荳ｻ逡ｪ蜿ｷ'];
    if (!buyerNumber || typeof buyerNumber !== 'string' || !buyerNumber.match(/^BB\d+$/)) continue;
    
    var status = String(row['迥ｶ豕・] || '');
    var nextCallDate = formatDateToISO_(row['谺｡髮ｻ譌･']);
    var assignee = row['諡・ｽ・];
    var isAssigneeValid = assignee && assignee !== '螟悶☆';
    
    // 諡・ｽ難ｼ域球蠖灘挨・峨き繝・ざ繝ｪ
    if (isAssigneeValid) {
      var assigneeKey = String(assignee);
      counts.assigned[assigneeKey] = (counts.assigned[assigneeKey] || 0) + 1;
    }
    
    // 蠖捺律TEL蛻・き繝・ざ繝ｪ
    if (status.indexOf('霑ｽ螳｢荳ｭ') !== -1 && nextCallDate && isTodayOrBefore(nextCallDate)) {
      if (isAssigneeValid) {
        // 蠖捺律TEL・域球蠖灘挨・・        var aKey = String(assignee);
        counts.todayCallAssigned[aKey] = (counts.todayCallAssigned[aKey] || 0) + 1;
      } else if (hasContactInfo(row)) {
        // 蠖捺律TEL・亥・螳ｹ・・        var label = getContactLabel(row);
        if (label) {
          counts.todayCallWithInfo[label] = (counts.todayCallWithInfo[label] || 0) + 1;
        }
      } else {
        // 蠖捺律TEL蛻・ｼ域球蠖薙↑縺暦ｼ・        counts.todayCall++;
      }
    }
  }
  
  // Supabase縺ｫ菫晏ｭ・  // 圷 驥崎ｦ・ label 縺ｨ assignee 縺・null 縺ｮ蝣ｴ蜷医・遨ｺ譁・ｭ怜・ '' 縺ｫ螟画鋤
  // ・・uyer_sidebar_counts 繝・・繝悶Ν縺ｮ荳ｻ繧ｭ繝ｼ縺・(category, label, assignee) 縺ｧ NOT NULL 縺ｮ縺溘ａ・・  var upsertRows = [];
  var now = new Date().toISOString();
  
  // 蠖捺律TEL蛻・ｼ域球蠖薙↑縺暦ｼ・  upsertRows.push({
    category: 'todayCall',
    count: counts.todayCall,
    label: '',  // null 竊・'' 縺ｫ螟画鋤
    assignee: '',  // null 竊・'' 縺ｫ螟画鋤
    updated_at: now
  });
  
  // 蠖捺律TEL・域球蠖灘挨・・  for (var assignee in counts.todayCallAssigned) {
    upsertRows.push({
      category: 'todayCallAssigned',
      count: counts.todayCallAssigned[assignee],
      label: '',  // null 竊・'' 縺ｫ螟画鋤
      assignee: assignee,
      updated_at: now
    });
  }
  
  // 蠖捺律TEL・亥・螳ｹ・・  for (var infoLabel in counts.todayCallWithInfo) {
    upsertRows.push({
      category: 'todayCallWithInfo',
      count: counts.todayCallWithInfo[infoLabel],
      label: infoLabel,
      assignee: '',  // null 竊・'' 縺ｫ螟画鋤
      updated_at: now
    });
  }
  
  // 諡・ｽ難ｼ域球蠖灘挨・・  for (var assignedKey in counts.assigned) {
    upsertRows.push({
      category: 'assigned',
      count: counts.assigned[assignedKey],
      label: '',  // null 竊・'' 縺ｫ螟画鋤
      assignee: assignedKey,
      updated_at: now
    });
  }
  
  // 譌｢蟄倥ョ繝ｼ繧ｿ繧貞炎髯､
  var delUrl = SUPABASE_CONFIG.URL + '/rest/v1/buyer_sidebar_counts?category=neq.___never___';
  UrlFetchApp.fetch(delUrl, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_CONFIG.SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
      'Prefer': 'return=minimal'
    },
    muteHttpExceptions: true
  });
  
  // 譁ｰ縺励＞繝・・繧ｿ繧呈諺蜈･
  var batchSize = 500;
  for (var b = 0; b < upsertRows.length; b += batchSize) {
    var batch = upsertRows.slice(b, b + batchSize);
    var insRes = UrlFetchApp.fetch(SUPABASE_CONFIG.URL + '/rest/v1/buyer_sidebar_counts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_CONFIG.SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify(batch),
      muteHttpExceptions: true
    });
    var insCode = insRes.getResponseCode();
    if (insCode >= 200 && insCode < 300) {
      Logger.log('笨・buyer_sidebar_counts INSERT謌仙粥: ' + batch.length + '莉ｶ');
    } else {
      Logger.log('笶・buyer_sidebar_counts INSERT螟ｱ謨・ HTTP ' + insCode + ' / ' + insRes.getContentText().substring(0, 200));
    }
  }
  
  Logger.log('投 雋ｷ荳ｻ繧ｵ繧､繝峨ヰ繝ｼ繧ｫ繧ｦ繝ｳ繝域峩譁ｰ螳御ｺ・ 蜷郁ｨ・' + upsertRows.length + '陦・);
}

// ============================================================
// 繝｡繧､繝ｳ蜷梧悄・・0蛻・ヨ繝ｪ繧ｬ繝ｼ・・// ============================================================
function syncBuyerList() {
  var startTime = new Date();
  Logger.log('=== 雋ｷ荳ｻ繝ｪ繧ｹ繝亥酔譛滄幕蟋・ ' + startTime.toISOString() + ' ===');
  
  // TODO: 雋ｷ荳ｻ繝・・繧ｿ縺ｮ蜷梧悄蜃ｦ逅・ｒ螳溯｣・  // 迴ｾ蝨ｨ縺ｯ譛ｪ螳溯｣・・縺溘ａ縲√し繧､繝峨ヰ繝ｼ繧ｫ繧ｦ繝ｳ繝域峩譁ｰ縺ｮ縺ｿ螳溯｡・  
  // 繧ｵ繧､繝峨ヰ繝ｼ繧ｫ繧ｦ繝ｳ繝域峩譁ｰ
  updateBuyerSidebarCounts_();
  
  var duration = (new Date() - startTime) / 1000;
  Logger.log('  謇隕∵凾髢・ ' + duration + '遘・);
  Logger.log('=== 蜷梧悄螳御ｺ・===');
}

// ============================================================
// 繝医Μ繧ｬ繝ｼ險ｭ螳夲ｼ亥・蝗槭・縺ｿ謇句虚螳溯｡鯉ｼ・// ============================================================
function setupBuyerSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncBuyerList') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('譌｢蟄倥ヨ繝ｪ繧ｬ繝ｼ繧貞炎髯､縺励∪縺励◆');
    }
  }
  ScriptApp.newTrigger('syncBuyerList')
    .timeBased()
    .everyMinutes(BUYER_SYNC_CONFIG.SYNC_INTERVAL_MINUTES)
    .create();
  Logger.log('笨・繝医Μ繧ｬ繝ｼ繧定ｨｭ螳壹＠縺ｾ縺励◆: ' + BUYER_SYNC_CONFIG.SYNC_INTERVAL_MINUTES + '蛻・＃縺ｨ');
}

// ============================================================
// 繝・せ繝医・繝・ヰ繝・げ逕ｨ
// ============================================================
function testBuyerSync() {
  Logger.log('=== 繝・せ繝亥酔譛滄幕蟋・===');
  syncBuyerList();
  Logger.log('=== 繝・せ繝亥酔譛溷ｮ御ｺ・===');
}
