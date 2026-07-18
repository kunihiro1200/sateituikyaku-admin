//HOME4U
function transferHOME4U(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName) {
   // 改行をスペースに置き換える
  //var cleanedBody = body.replace(/\r?\n|\r/g, ' ');


  // スペースを改行に置き換える
//var cleanedBody = body?.replace(/ /g, '\n') || '';
var cleanedBody = body.replace(/\r\n|\n\r|\n|\r/g, "\n");


// メモ（K留守電不可など）を抽出
var memo = extractData(cleanedBody, "HOME4Uログアウト", "査定依頼").trim();
var assessmentNumber = extractData2(cleanedBody, "■査定ナンバー", ":");
//var inquiryDateTime = extractData2(cleanedBody, "■ご依頼日", ":");
var inquiryDateTime = "";

var inquiryMatch = String(cleanedBody).match(/■ご依頼日\s*[:：]\s*([^\n\r]+)/);

if (inquiryMatch) {
  inquiryDateTime = inquiryMatch[1].trim();
}

Logger.log("inquiryDateTime = " + inquiryDateTime);
var assessmentMethod = extractData2(cleanedBody, "■査定方法", ":");
var propertyType = extractData2(cleanedBody, "■物件種別", ":");
//var propertyType = extractData(cleanedBody, "物件種別", "物件住所");
// propertyTypeの値に基づいて表示を変更
var displayPropertyType;
if (propertyType.includes("一戸建て")) {
  displayPropertyType = "戸";
} else if (propertyType.includes("分譲マンション（区分所有）") || propertyType.includes("マンション")) {
  displayPropertyType = "マ";
} else if (propertyType.includes("土地")) {
  displayPropertyType = "土";
} else {
  displayPropertyType = propertyType; // その他の場合は元の値をそのまま使用
}


var propertyName = extractData2(cleanedBody, "■物件名称", ":");
var floorNumber = extractData2(cleanedBody, "■階数（棟物の場合記載）", ":");
var unitCount = extractData2(cleanedBody, "■戸数（棟物の場合記載）:", ":");
var landArea = extractData2(cleanedBody, "■土地面積", ":");
var buildingArea = extractData2(cleanedBody, "■建物（専有）面積", ":");
var layout = extractData2(cleanedBody, "■間取り", ":");
var propertyAddress = extractData2(cleanedBody, "■物件所在地", ":");




propertyAddress = removeOitaPrefecture(propertyAddress);


Logger.log("Original property address: " + propertyAddress);
propertyAddress = removeOitaPrefecture(propertyAddress);
Logger.log("Property address after removing Oita prefecture: " + propertyAddress);


// 物件所在地から「大分県」を省く関数
function removeOitaPrefecture(str) {
  if (!str) return "";
  return str.replace(/^大分県/, '').trim();
}


var builtYear = extractData2(cleanedBody, "■築年（西暦）", ":");
var currentStatus = extractData2(cleanedBody, "■現況", ":");
var convertedStatus = convertCurrentStatus(currentStatus);
// 物件の状況を変換する関数
function convertCurrentStatus(status) {
  if (!status) return "";
  if (status.includes("居住中")) return "居";
  if (status.includes("空き")) return "空";
  if (status.includes("賃貸")) return "賃";
  return "他";
}




var ownership = extractData2(cleanedBody, "■名義", ":");
var furigana = extractData2(cleanedBody, "■フリガナ", ":");
var name = extractData2(cleanedBody, "■お名前", ":");
var age = extractData2(cleanedBody, "■年齢", ":");
// 郵便番号と住所を分割して主おt九
var address = extractData(cleanedBody, "■ご住所", "■電話番号").trim();
let tempAddress = address.split(":");
if (tempAddress.length===3) {
  if (tempAddress[1].trim() === "") {
      address = tempAddress[2].trim();
    } else {
      address = tempAddress[1].trim() + "　" + tempAddress[2].trim();
    }
} else if (tempAddress.length===2) {
  address = tempAddress[1].trim();
} else {
  address = "";
}

//住所において、郵便番号と住所の２行を取得したい
function extractAddress(text) {
  var addressStart = text.indexOf("■ご住所 :");
  if (addressStart === -1) return "";
 
  addressStart += "■ご住所 :".length;
  var addressEnd = text.indexOf("■電話番号", addressStart);
  if (addressEnd === -1) addressEnd = text.length;
 
  var address = text.substring(addressStart, addressEnd).trim();
  return address.replace(/\s+/g, ' ').replace(/\n/g, ' ');
}


var userAddress = extractAddress(cleanedBody);
Logger.log("Extracted user address: " + userAddress);





//先頭にシングルコーテーションを入れて数字型への変換を防ぎ、先頭の0が消える問題を解決する
var phoneNumber = "'" + extractData2(cleanedBody,  "■電話番号", ":");


var secondPhoneNumber = extractData2(cleanedBody, "■第二電話番号（任意）", ":");
var email = extractData2(cleanedBody, "■E-mail", ":");
var assessmentReason = extractData2(cleanedBody, "■査定の理由", ":");
var desiredSaleTime = extractData2(cleanedBody, "■売却の希望時期", ":");
var requests = extractData(cleanedBody, "■要望・質問（自由記入）:", "-----------------------------------------------------------------");


  // 新しい ID を生成
  var id = generateId();


  // 売主番号が新規発行
  var urinushiNum = generateUrinushiNum(propertyAddress);
  function generateUrinushiNum(fullPropertyAddress) {

  SpreadsheetApp.flush();

  // 福岡判定
  var isFukuoka = fullPropertyAddress && fullPropertyAddress.indexOf("福岡") !== -1;

  var newNum;

  if (isFukuoka) {
    // I2（9列目）
    var currentNum = sheetSerialNum.getRange(2, 9).getValue();
    Logger.log(["Fukuoka currentNum", currentNum]);

    newNum = "FI" + (currentNum + 1);
    Logger.log(["Fukuoka newNum", newNum]);

    sheetSerialNum.getRange(2, 9).setValue(currentNum + 1);

  } else {
    // C2（3列目）
    var currentNum = sheetSerialNum.getRange(2, 3).getValue();
    Logger.log(["Default currentNum", currentNum]);

    newNum = "AA" + (currentNum + 1);
    Logger.log(["Default newNum", newNum]);

    sheetSerialNum.getRange(2, 3).setValue(currentNum + 1);
  }

  SpreadsheetApp.flush();

  return newNum;
}



  // 今日の日付を取得
  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth() + 1;
  var day = today.getDate();
  var formattedDate = Utilities.formatDate(today, "Asia/Tokyo", "MM/dd");


  // スプレッドシートにデータを追加
  var ss = SpreadsheetApp.openById(destinationSsId);
  var sheet = ss.getSheetByName(destinationSheetName);


  // コメントを作成
  var commentParts = [];
 
  if (furigana) commentParts.push(`フリガナ: ${furigana}`);
  if (age) commentParts.push(`年齢: ${age}`);
  if (assessmentReason) commentParts.push(`査定理由: ${assessmentReason}`);
  if (requests) commentParts.push(`要望: ${requests}`);
  if (assessmentMethod) commentParts.push(`査定方法: ${assessmentMethod}`);
  if (secondPhoneNumber) commentParts.push(`第２電話: ${secondPhoneNumber}`);
 
  var comments = commentParts.join('\n');


  sheet.appendRow([
    "", // フォームURL
    urinushiNum, // 売主番号
    "", // S/担
    "不可", // 質問メール
    "", // E/担
    "", // 郵/担
    month + "/" + day, // 次電日
    "", // 確度
    "", // 査定額
    "", // 架電記録
    "H", // サイト (HOME4Uの場合は"H"とする)
    new Date().getFullYear(), // 反響年
    formattedDate, // 反響日付
    displayPropertyType, // 種別
    extractNumericValue(landArea), // 土（㎡）
    extractNumericValue(buildingArea), // 建（㎡）
    layout, // 間取り
    propertyAddress, // 物件所在地
    address, // 依頼者住所
    extractNumericValue(builtYear), // 築年
    convertPropertyStatus(currentStatus), // 状況（売主）
    name, // 名前(漢字のみ）
    phoneNumber.replace(/-/g, ""), // 電話番号（ハイフン除去）
    email, // メールアドレス
    "", // 一番TEL
    "", // 訪問取得日
    "", // 訪問日
    "", // 営担
    "追客中", // 状況（当社）
    memo+"\n"+"【以下自動転記（HOME4U)】"+"\n"+comments, // コメント
    "", // 質問メール回答
    "", // キャンセル案内担当
    "", // 送信社数
    "配信中", // Pinrich
    "", // 競合名、理由
    "", // 乗換DM
    "", // 訪問査定取得者
    inquiryDateTime, // 反響日時
    "", // 契約年月
    "", // 1
    assessmentReason, // 査定理由
    "", // サイトURL
    "", // 並び替え用
    "", // 訪問時間
    "", // 曜日
    "", // ローン残
    "", // 下回っても売る
    "", // リフォーム
    "", // ★査定理由★
    "", // 名義人
    "", // 名義人の名前と関係性
    "", // 相続人
    "", // 相続登記
    "", // 司法書士の紹介
    "", // 面積の確認
    "", // 前面道路
    "", // 間口
    "", // インフラ
    "", // 構造
    "", // P台数
    "", // その他特徴
    "", // 離婚後住み続ける
    "", // 財産分与の為
    "", // 住替先は？
    "", // 売却前に引っ越し？
    "", // いつ転勤？
    "", // 過去に査定したことある？
    desiredSaleTime, // いつまでに売りたいか？
    "", // 希望の価格はあるか？
    "", // 連絡取りやすい日、時間帯
    "", // 査定価格の感想
    "", // 土地（当社調べ）
    "", // 建物（当社調べ）
    "", // 査定方法
    "", // 連絡方法
    "", // 通知送信者
    "", // 通知送信日時
    "", // 査定担当
    "", // 電話担当（任意）
    "", // 査定額1
    "", // 査定額2
    "", // 査定額3
    "", // メール種別
    "", // 訪問時注意点
  ]);
}


function extractData(text, startMarker, endMarker) {
  var start = text.indexOf(startMarker);
  if (start === -1) return "";


  start += startMarker.length;
  var end = text.indexOf(endMarker, start);
  if (end === -1) end = text.length;


  return text.substring(start, end).trim();
}


function extractNumericValue(str) {
  var match = str.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : "";
}


function generateId() {
  return Utilities.getUuid();
}

//すまいステップ
//【すまいステップ 反響通知メール】

function transferSumai(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName) {

  // 改行をスペースに置き換える
  var cleanedBody = body.replace(/\r?\n|\r/g, ' ');

  // 各項目を抽出する
  var memo = extractData(cleanedBody, "メモ", "最終更新日時：");
  var lastUpdated = extractData(cleanedBody, "最終更新日時：", "物件情報");
  var managementNumber = extractData(cleanedBody, "管理番号", "反響日時");
  //var inquiryDateTime = extractData(cleanedBody, "反響日時", "反響送信日時");
  var inquiryDateTime = "";

var inquiryMatch = String(cleanedBody).match(/反響日時\s*[:：]?\s*([0-9]{4}[\/\-年][0-9]{1,2}[\/\-月][0-9]{1,2}[日]?\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/);

if (inquiryMatch) {
  inquiryDateTime = inquiryMatch[1]
    .replace("年", "/")
    .replace("月", "/")
    .replace("日", "")
    .trim();
}

Logger.log("inquiryDateTime = " + inquiryDateTime);
  var sendDateTime = extractData(cleanedBody, "反響送信日時", "物件種別");
  var propertyType = extractData(cleanedBody, "物件種別", "物件住所");
  // propertyTypeの値に基づいて表示を変更
  var displayPropertyType;
  if (propertyType.includes("一戸建て")) {
    displayPropertyType = "戸";
  } else if (propertyType.includes("マンション一室") || propertyType.includes("マンション")) {
    displayPropertyType = "マ";
  } else if (propertyType.includes("土地")) {
    displayPropertyType = "土";
  } else {
    displayPropertyType = propertyType; // その他の場合は元の値をそのまま使用
  }


  var propertyAddress = extractData(cleanedBody, "物件住所", "物件にお住まい");

  propertyAddress = removeOitaPrefecture(propertyAddress);

  Logger.log("Original property address: " + propertyAddress);
  propertyAddress = removeOitaPrefecture(propertyAddress);
  Logger.log("Property address after removing Oita prefecture: " + propertyAddress);

  // 物件所在地から「大分県」を省く関数
  function removeOitaPrefecture(str) {
    if (!str) return "";
    return str.replace(/^大分県/, '').trim();
  }
  var livingInProperty = extractData(cleanedBody, "物件にお住まい", "延べ床面積");

  var totalFloorArea = extractData(cleanedBody, " 延べ床面積 ", " 土地面積 ");
  //・・・・建物面積
  var totalFloorArea = "";
  if (displayPropertyType == "戸") {
    totalFloorArea = extractData(cleanedBody, " 延べ床面積 ", " 土地面積 ");
  } else if (displayPropertyType == "マ") {
    totalFloorArea = extractData(cleanedBody, "専有面積", "築年");
  }

  // 坪→㎡ or 数値抽出の分岐
  if (String(totalFloorArea).match("坪")) {
    totalFloorArea = convertTsuboToHeibei(totalFloorArea);
    Logger.log("[totalFloorArea after convertTsuboToHeibei] %s", totalFloorArea);  // ★坪→㎡後
  } else if (String(totalFloorArea).match("m2|㎡")) { // ㎡表記の揺れに対応
    var _before = totalFloorArea;
    totalFloorArea = extractNumericValue(totalFloorArea);
    Logger.log("[totalFloorArea extractNumericValue] before=%s  after=%s", _before, totalFloorArea); // ★数値抽出後
  } else {
    Logger.log("[totalFloorArea no-unit branch] %s", totalFloorArea);  // 単位が付いてない/判定外
  }


  Logger.log(cleanedBody);

  var landArea = extractData(cleanedBody, " 土地面積 ", " 築年 ");
  Logger.log("[landArea raw(before convert)] %s", landArea);  // ★抽出直後

  // 坪→㎡ or 数値抽出の分岐
  if (String(landArea).match("坪")) {
    landArea = convertTsuboToHeibei(landArea);
    Logger.log("[landArea after convertTsuboToHeibei] %s", landArea);  // ★坪→㎡後
  } else if (String(landArea).match("m2|㎡")) { // ㎡表記の揺れに対応
    var _before = landArea;
    landArea = extractNumericValue(landArea);
    Logger.log("[landArea extractNumericValue] before=%s  after=%s", _before, landArea); // ★数値抽出後
  } else {
    Logger.log("[landArea no-unit branch] %s", landArea);  // 単位が付いてない/判定外
  }




  var builtYear = extractData(cleanedBody, "築年", "間取り");
  var layout = extractData(cleanedBody, "間取り", "現在の状況");


  var currentStatus = extractData(cleanedBody, "現在の状況", "物件の関係");
  var convertedStatus = convertCurrentStatus(currentStatus);
  // 物件の状況を変換する関数
  function convertCurrentStatus(status) {
    if (!status) return "";
    if (status.includes("居住中")) return "居";
    if (status.includes("空き")) return "空";
    if (status.includes("賃貸")) return "賃";
    return "他";
  }




  var relationToProperty = extractData(cleanedBody, "物件の関係", "査定の理由");
  var assessmentReason = extractData(cleanedBody, "査定の理由", "査定の方法");
  var assessmentMethod = extractData(cleanedBody, "査定の方法", "売却の希望時期");
  var desiredSaleTime = extractData(cleanedBody, "売却の希望時期", "ご要望・ご質問");
  var requests = extractData(cleanedBody, "ご要望・ご質問", "連絡先");
  var name = extractData(cleanedBody, "氏名", "フリガナ");
  var furigana = extractData(cleanedBody, "フリガナ", "年齢");
  var age = extractData(cleanedBody, "年齢", "電話番号");
  //先頭にシングルコーテーションを入れて数字型への変換を防ぎ、先頭の0が消える問題を解決する
  var phoneNumber = "'" + extractData(cleanedBody, "電話番号", "メールアドレス");



  //var phoneNumber = extractData(cleanedBody, "電話番号", "メールアドレス");
  var email = extractData(cleanedBody, "メールアドレス", "郵便番号");
  var postalCode = extractData(cleanedBody, "郵便番号", "お住まいの住所");
  var currentAddress = extractData(cleanedBody, "お住まいの住所", "アンケート結果");
  var preferredContactTime = extractData(cleanedBody, "連絡が取れやすい時間帯", "売却希望価格");
  var desiredSalePrice = extractData(cleanedBody, "売却希望価格", "売却活動に関する要望");
  var saleActivityRequests = extractData(cleanedBody, "売却活動に関する要望", "");

  function extractData(text, startMarker, endMarker) {
    var start = text.indexOf(startMarker);
    if (start === -1) return "";

    start += startMarker.length;
    var end = text.indexOf(endMarker, start);
    if (end === -1) end = text.length;

    return text.substring(start, end).trim();
  }


  // 新しい ID を生成
  var id = generateId();

  // 売主番号が新規発行
  var urinushiNum = generateUrinushiNum(propertyAddress);
  function generateUrinushiNum(fullPropertyAddress) {

  SpreadsheetApp.flush();

  // 福岡判定
  var isFukuoka = fullPropertyAddress && fullPropertyAddress.indexOf("福岡") !== -1;

  var newNum;

  if (isFukuoka) {
    // I2（9列目）
    var currentNum = sheetSerialNum.getRange(2, 9).getValue();
    Logger.log(["Fukuoka currentNum", currentNum]);

    newNum = "FI" + (currentNum + 1);
    Logger.log(["Fukuoka newNum", newNum]);

    sheetSerialNum.getRange(2, 9).setValue(currentNum + 1);

  } else {
    // C2（3列目）
    var currentNum = sheetSerialNum.getRange(2, 3).getValue();
    Logger.log(["Default currentNum", currentNum]);

    newNum = "AA" + (currentNum + 1);
    Logger.log(["Default newNum", newNum]);

    sheetSerialNum.getRange(2, 3).setValue(currentNum + 1);
  }

  SpreadsheetApp.flush();

  return newNum;
}


  // スプレッドシートにデータを追加
  var ss = SpreadsheetApp.openById(destinationSsId);
  var sheet = ss.getSheetByName(destinationSheetName);
  // 今日の日付を取得
  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth() + 1;
  var day = today.getDate();
  var formattedDate = Utilities.formatDate(today, "Asia/Tokyo", "MM/dd");

  Logger.log("転記実施");

  var array = [[
    "", // フォームURL1
    urinushiNum, // 売主番号2
    "", // S/担3
    managementNumber, // ID4
    "", // E/担5
    "", // 郵/担6
    formattedDate, // 次電日7
    "", // 確度8
    "", // 査定額9
    "", // 架電記録10
    "す", // サイト11
    new Date().getFullYear(), // 反響年12
    formattedDate, // 反響日付13
    displayPropertyType, // 種別14
    landArea, // 土（㎡）15
    totalFloorArea, // 建（㎡）16
    layout, // 間取り17
    propertyAddress, // 物件所在地18
    currentAddress, // 依頼者住所19
    builtYear.replace(/年/g, ""), // 築年（年排除）20
    convertedStatus, // 状況（売主）21
    name, // 名前(漢字のみ）22
    phoneNumber.replace(/-/g, ""), // 電話番号（ハイフン除去）23
    email, // メールアドレス24
    "", // 一番TEL25
    "", // 訪問取得日26
    "", // 訪問日27
    "", // 営担28
    "追客中", // 状況（当社）29
    memo+"\n"+"【以下自動転記（すまいステップ）】"+"\n"+"★読み方:" + furigana + '\n' + "★要望:" + requests + '\n' + "★査定方法:" + assessmentMethod +  '\n' +"★希望連絡時間："+preferredContactTime+'\n' + "★売却活動に対する要望:" + saleActivityRequests + '\n' + "★年齢" + age, // コメント30
    "", // 質問メール回答31
    "", // キャンセル案内担当32
    "", // 送信社数33
    "配信中", // Pinrich34
    "", // 競合名、理由35
    "", // 乗換DM36
    "", // 訪問査定取得者37
    inquiryDateTime, // 反響日時38
    "", // 契約年月39
    "", // 1 40
    assessmentReason, // 査定理由42
    "", // サイトURL41
    "", // 並び替え用43
    "", // 訪問時間44
    "", // 曜日45
    "", // ローン残46
    "", // 下回っても売る47
    "", // リフォーム48
    "", // ★査定理由★49
    "", // 名義人50
    "", // 名義人の名前と関係性51
    "", // 相続人52
    "", // 相続登記53
    "", // 司法書士の紹介54
    "", // 面積の確認55
    "", // 前面道路56
    "", // 間口57
    "", // インフラ58
    "", // 構造59
    "", // P台数60
    "", // その他特徴61
    "", // 離婚後住み続ける62
    "", // 財産分与の為63
    "", // 住替先は？64
    "", // 売却前に引っ越し？65
    "", // いつ転勤？66
    "", // 過去に査定したことある？67
    desiredSaleTime, // いつまでに売りたいか？68
    desiredSalePrice, // 希望の価格はあるか？69
    "", // 連絡取りやすい日、時間帯70
    "", // 査定価格の感想71
    "", // 土地（当社調べ）72
    "", // 建物（当社調べ）73
    "", // 査定方法74
    "", // 連絡方法
    "", // 通知送信者
    "", // 通知送信日時
    "", // 査定担当
    "", // 電話担当（任意）
    "", // 査定額1
    "", // 査定額2
    "", // 査定額3
    "", // メール種別
    "", // 訪問時注意点
    // ... 残りの列は空欄または必要に応じて追加
  ]];


  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, array[0].length).setValues(array);
  SpreadsheetApp.flush();


}
//らいふる
function transferRELIFULL(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName) {
  // 改行をスペースに置き換える
  //var cleanedBody = body.replace(/\r?\n|\r/g, ' ');
  var cleanedBody = body;

  // 各項目を抽出する
  var memo = extractData(cleanedBody, "らいふる", "********");

  var detailUrl = removeInline(extractData(cleanedBody, "▼Managerで、依頼内容と連絡先をご確認いただけます。", "（受信日時："));

  //var receivedDate = getMailBodyItem(cleanedBody, "（受信日時：").replace("）","");
  var receivedDate = "";

var receivedMatch = String(cleanedBody).match(/[（(]\s*受信日時\s*[:：]\s*([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2}\s+[0-9]{1,2}:[0-9]{2}:[0-9]{2})\s*[）)]/);

if (receivedMatch) {
  receivedDate = receivedMatch[1];
}

Logger.log("receivedDate = " + receivedDate);

  var dateObj = new Date(receivedDate);
  var formattedDate = (dateObj.getMonth() + 1) + '/' + dateObj.getDate();
  var assessmentId = getMailBodyItem(cleanedBody, "査定ID（問合せ番号\）：");

  var propertyType = getMailBodyItem(cleanedBody, "物件種別：");

  // propertyTypeの値に基づいて表示を変更
  var displayPropertyType;
  if (propertyType == "一戸建て") {
    displayPropertyType = "戸";
  } else if (String(propertyType).match("マンション")) {
    displayPropertyType = "マ";
  } else if (propertyType == "土地") {
    displayPropertyType = "土";
  } else {
    displayPropertyType = propertyType; // その他の場合は元の値をそのまま使用
  }

  // マンション名を取得
  var apartmentName = "";
  if (displayPropertyType == "マ") {
    apartmentName = getMailBodyItem(cleanedBody, "マンション名：");
  }

  // 土地面積
  var landArea = "";
  if (displayPropertyType == "戸") {
    landArea = getMailBodyItem(cleanedBody, "土地面積：");
  } else if (displayPropertyType == "土") {
    landArea = getMailBodyItem(cleanedBody, "土地面積：");
  }

  // 間取り
  var layout = "";
  if (displayPropertyType == "戸") {
    layout = getMailBodyItem(cleanedBody, "間取り：");
  } else if (displayPropertyType == "マ") {
    layout = getMailBodyItem(cleanedBody, "間取り：");
  }

  // 坪⇒平米換算
  if (String(landArea).match("坪")) {
    landArea = convertTsuboToHeibei(landArea);
  } else if (String(landArea).match("m2")) {
    landArea = extractNumericValue(landArea);
  }

  // 建物面積
  var buildingArea = "";
  if (displayPropertyType == "戸") {
    buildingArea = getMailBodyItem(cleanedBody, "建物面積：");
  } else if (displayPropertyType == "マ") {
    buildingArea = getMailBodyItem(cleanedBody, "専有面積：");
  }

  // 坪⇒平米換算
  if (String(buildingArea).match("坪")) {
    buildingArea = convertTsuboToHeibei(buildingArea);
  } else if (String(buildingArea).match("m2")) {
    buildingArea = extractNumericValue(buildingArea);
  }

  // 物件所在地
  var address = "";
  if (displayPropertyType == "戸" || displayPropertyType == "マ") {
    address = getMailBodyItem(cleanedBody, "所在地：");
  } else if (displayPropertyType == "土") {
    address = getMailBodyItem(cleanedBody, "所在地：");
  }
  address = address.replace("大分県", ""); // "大分県"を削除

  // 電話番号
  var tel = "'" + getMailBodyItem(cleanedBody, "電話番号：");

  // 築年、現況、名義等を抽出
  var builtYear = extractYearValue(getMailBodyItem(cleanedBody, "築年："));
  var currentStatus = getMailBodyItem(cleanedBody, "現況：");
  //var ownership = getMailBodyItem(cleanedBody, "名義：");
  var ownership;
  if (String(cleanedBody).match("残債")) {
    ownership = getMailBodyItem(cleanedBody, "名義：");
  } else {
    ownership = getMailBodyItem(cleanedBody, "名義：");
  }
  var remainingDebt = getMailBodyItem(cleanedBody, "残債：");
  var saleReason = getMailBodyItem(cleanedBody, "売却理由：");

  // 売却希望時期
  //var desiredSaleTime;
  //if (String(cleanedBody).match("売却希望価格")) {
  //  desiredSaleTime = getMailBodyItem(cleanedBody, "売却希望時期：");
  //} else {
  //  desiredSaleTime = getMailBodyItem(cleanedBody, "売却希望時期：");
  //}

  var desiredSaleTime = getMailBodyItem(cleanedBody, "売却希望時期：");
var desiredSalePrice = getMailBodyItem(cleanedBody, "売却希望価格：");

  // 状況（売主）を変換
  var convertedStatus = convertStatus(currentStatus);
  //↑ここまで
  var requests = removeInline(extractData(cleanedBody, "ご要望：", "お名前："));
  var name = getMailBodyItem(cleanedBody, "お名前：");
  var furigana = getMailBodyItem(cleanedBody, "フリガナ：");
  var userAddress = getMailBodyItem(cleanedBody, "ご住所：");
  var email = getMailBodyItem(cleanedBody, "メールアドレス：");
  //var preferredContactTime = getMailBodyItem(cleanedBody, "希望の連絡時間：");
  var preferredContactMethod = getMailBodyItem(cleanedBody, "希望の連絡方法：");
  var numberofrecipients = removeInline(extractData(cleanedBody, "同時送信社数：", "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"));

  // 状況（売主）を変換する関数
  function convertStatus(status) {
    if (status.includes("賃貸中")) return "賃";
    if (status.includes("ご自身またはご家族・親族が居住中")) return "居";
    if (status.includes("空き家")) return "空";
    if (status.includes("古屋あり")) return "古有";
    return "他";
  }



  // スプレッドシートにデータを追加
  var ss = SpreadsheetApp.openById(destinationSsId);
  var sheet = ss.getSheetByName(destinationSheetName);

  //var preferredContactInfo = extractPreferredContactInfo(cleanedBody);

  // 売主番号が新規発行
  //var urinushiNum = generateUrinushiNum();
   var urinushiNum = generateUrinushiNum(address);

  // 今日の日付を取得
  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth() + 1;
  var day = today.getDate();

  // 今日の日付を取得（次電日用）
  //var today = new Date();
  //var nextCallDate = Utilities.formatDate(today, "Asia/Tokyo", "MM/dd");

   var formattedDate = Utilities.formatDate(today, "Asia/Tokyo", "MM/dd");

  var arrayResult = [
    "", // フォームURL
    urinushiNum, // 売主番号
    "", // S/担
    "不可", // 質問メール
    "", // E/担
    "", // 郵/担
    formattedDate, // 次電日（受信日時を使用）
    "", // 確度
    "", // 査定額
    "", // 架電記録
    "L", // サイト
    year, // 反響年
    formattedDate, // 反響日付
    displayPropertyType, // 種別
    landArea, // 土（㎡）
    buildingArea, // 建（㎡）
    layout, // 間取り（土地のみの場合は空欄）
    address, // 物件所在地
    userAddress, // 依頼者住所
    builtYear, // 築年（西暦4桁のみ）
    convertedStatus, // 状況（売主）
    name, // 名前(漢字のみ）
    tel.replace(/-/g, ""), // 電話番号（ハイフン除去）
    email, // メールアドレス
    "", // 一番TEL
    "", // 訪問取得日
    "", // 訪問日
    "", // 営担
    "追客中", // 状況（当社）
    memo+"\n"+"【以下自動転記（LIFULLHOMES)】" + "\n" + requests + "\n" + numberofrecipients+"\n"+"売却希望価格:"+desiredSalePrice +"\n"+"売却希望時期:"+desiredSaleTime+"\n"+"希望連絡方法:"+preferredContactMethod+"\n"+"残債："+remainingDebt,// コメント
    "", // 質問メール回答
    "", // キャンセル案内担当
    preferredContactMethod, // 送信社数
    "配信中", // Pinrich
    "", // 競合名、理由
    "", // 乗換DM
    "", // 訪問査定取得者
    receivedDate, // 反響日時
    "", // 契約年月
    "", // 1
    saleReason, // 査定理由
    detailUrl, // サイトURL
    "", // 並び替え用
    "", // 訪問時間
    "", // 曜日
    remainingDebt, // ローン残
    "", // 下回っても売る
    "", // リフォーム
    "", // ★査定理由★
    "", // 名義人
    "", // 名義人の名前と関係性
    "", // 相続人
    "", // 相続登記
    "", // 司法書士の紹介
    "", // 面積の確認
    "", // 前面道路
    "", // 間口
    "", // インフラ
    "", // 構造
    "", // P台数
    "", // その他特徴
    "", // 離婚後住み続ける
    "", // 財産分与の為
    "", // 住替先は？
    "", // 売却前に引っ越し？
    "", // いつ転勤？
    "", // 過去に査定したことある？
    "", // いつまでに売りたいか？
    "", // 希望の価格はあるか？
    "", // 連絡取りやすい日、時間帯
    "", // 査定価格の感想
    "", // 土地（当社調べ）
    "", // 建物（当社調べ）
    "", // 査定方法
    "", // 連絡方法
    "", // 通知送信者
    "", // 通知送信日時
    "", // 査定担当
    "", // 電話担当（任意）
    "", // 査定額1
    "", // 査定額2
    "", // 査定額3
    "", // メール種別
    "", // 訪問時注意点（ご要望を使用）
  ];


  SpreadsheetApp.flush();
  var row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, arrayResult.length).setValues([arrayResult]);





  // 数値のみを抽出する関数
  function extractNumericValue(str) {
    if (!str) return "";
    var match = str.match(/(\d+(?:\.\d+)?)/);
    return match ? match[1] : "";
  }

  // 年号のみを抽出する関数
  function extractYearValue(str) {
    if (!str) return "";
    var match = str.match(/(\d{4})/);
    return match ? match[1] : "";
  }



  // 新しい ID を生成
  var id = generateId();

}


//YAHOO


//function transferYahoo(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName) {
  function transferYahoo(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName) {
  if (!body) {
    Logger.log("body が undefined / 空です");
    return;
  }
  // 改行をスペースに置き換える
  var cleanedBody = body.replace(/\r?\n|\r/g, ' ');


  // 各項目を抽出する
  var acquiredStatus = extractData(cleanedBody, "取得済み", "本ページのテキストのコピーはパソコン版のみ可能です");

  var propertyType = extractData(cleanedBody, "物件種別", "名義");
  var ownership = extractData(cleanedBody, "名義", "郵便番号");
  var postalCode = extractData(cleanedBody, "郵便番号", "物件所在地");
  var propertyAddress= extractData(cleanedBody, "物件所在地", "現況");
  var currentStatus = extractData(cleanedBody, "現況", "間取り");
  var layout = extractData(cleanedBody, "間取り", "築後年数");
  
　var buildingFloors = extractData(cleanedBody, "建物階数", "主要採光面");
　var mainLightingDirection = extractData(cleanedBody, "主要採光面", "売却希望時期 ");

  if (cleanedBody.match("土地面積")) {
    var builtAfterYears = extractData(cleanedBody, "築後年数", "土地面積");
  } else if (cleanedBody.match("専有面積")) {
    var builtAfterYears = extractData(cleanedBody, "築後年数", "専有面積");
  }
  builtAfterYears = builtAfterYears.replace("年", ""); //”23年”と取得されるので年を抜く
  builtAfterYears = Number(builtAfterYears);//文字型の数字⇒数字型に変換

  var currentYear = new Date().getFullYear(); // 現在の西暦年を取得
  var builtYear = currentYear - builtAfterYears; // 現在の年から築後年数を引いて築年を計算
  Logger.log(["currentYear", currentYear, "builtAfterYears", builtAfterYears, "builtYear", builtYear]);
 // propertyTypeの値に基づいて表示を変更
  var displayPropertyType;
  if (propertyType.includes("一戸建て")) {
    displayPropertyType = "戸";
  } else if (propertyType.includes("マンション")) {
    displayPropertyType = "マ";
  } else if (propertyType.includes("土地")) {
    displayPropertyType = "土";
  } else {
    displayPropertyType = propertyType;
  }

  //var landArea = extractData(cleanedBody, "土地面積", "建物延べ面積");

// 土地面積	
var landArea = "";	
if (displayPropertyType == "戸") {	
landArea = extractData(cleanedBody, "土地面積", "建物延べ面積：");	
} else if (displayPropertyType == "土") {	
landArea = extractData(cleanedBody, "土地面積", "土地権利：");	
}	

  //var buildingArea = extractData(cleanedBody, "建物延べ面積", "土地権利");

  //建物面積
  var buildingArea="";
  if (displayPropertyType == "戸") {
   buildingArea = extractData(cleanedBody, "建物延べ面積", "土地権利");
  }else if (displayPropertyType == "マ") {
  var buildingArea = extractData(cleanedBody, "専有面積", "建物階数");
  }
  

  var desiredSaleTime = extractData(cleanedBody, "売却希望時期", "売却希望価格");
  var desiredSalePrice = extractData(cleanedBody, "売却希望価格", "買い替え有無");
  var buyingReplacement = extractData(cleanedBody, "買い替え有無", "売却理由");
  var saleReason = extractData(cleanedBody, "売却理由", "お客様情報");
  var name = extractData(cleanedBody, "氏名（漢字）", "氏名（カナ）");
  var furigana = extractData(cleanedBody, "氏名（カナ）", "郵便番号");
  var userPostalCode = extractData(cleanedBody, "郵便番号", "現住所");
  var currentAddress = extractData(cleanedBody, "現住所", "希望する連絡方法");
  var preferredContactMethod = extractData(cleanedBody, "希望する連絡方法", "Ｅメール");
  var email = extractData(cleanedBody, "Ｅメール", "電話番号");
  var phoneNumber = "'" +extractData(cleanedBody, "電話番号", "ファックス番号");
  var preferredContactTime = extractData(cleanedBody, "ご希望時間帯", "年齢");
  var age = extractData(cleanedBody, "年齢", "問い合わせ情報");
  var inquiryId = extractData(cleanedBody, "問い合わせID", "種別");
  var inquiryDateTime = extractData(cleanedBody, "依頼日時", "会社名");
  var inquiryContent = extractData(cleanedBody, "問い合わせ内容", "対応状況");
 

 

  // 物件所在地から「大分県」を省く
  propertyAddress= removeOitaPrefecture(propertyAddress);

  Logger.log("Original property address: " + propertyAddress);
propertyAddress = removeOitaPrefecture(propertyAddress);
Logger.log("Property address after removing Oita prefecture: " + propertyAddress);
  // 物件所在地から「大分県」を省く関数
function removeOitaPrefecture(str) {
  if (!str) return "";
  return str.replace(/^大分県/, '').trim();
}

  // 新しい ID を生成
  var id = generateId();

  // 売主番号が新規発行
  var urinushiNum = generateUrinushiNum(propertyAddress);

  // スプレッドシートにデータを追加
  var ss = SpreadsheetApp.openById(destinationSsId);
  var sheet = ss.getSheetByName(destinationSheetName);

  // 今日の日付を取得
  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth() + 1;
  var day = today.getDate();
  var formattedDate = Utilities.formatDate(today, "Asia/Tokyo", "MM/dd");

  sheet.appendRow([
    "", // フォームURL
    urinushiNum, // 売主番号
    "", // S/担
    inquiryId, // お客様ID（YAHOOのみ）
    "", // E/担
    "", // 郵/担
    formattedDate, // 次電日
    "", // 確度
    "", // 査定額
    "", // 架電記録
    "Y", // サイト (Yahoo!不動産の場合は"Y"とする)
    year, // 反響年
    formattedDate, // 反響日付
    displayPropertyType, // 種別
    extractNumericValue(landArea), // 土（㎡）
    extractNumericValue(buildingArea), // 建（㎡）
    layout, // 間取り
    propertyAddress, // 物件所在地 
    currentAddress, // 依頼者住所
    builtYear, // 築年　
    convertCurrentStatus(currentStatus), // 状況（売主）
    name, // 名前(漢字のみ）
    phoneNumber.replace(/-/g, ""), // 電話番号（ハイフン除去）
    email, // メールアドレス
    "", // 一番TEL
    "", // 訪問取得日
    "", // 訪問日
    "", // 営担
    "追客中", // 状況（当社）
    acquiredStatus+"\n"+"【以下自動転記（Yahoo)】" + "\n" + `★読み方：${furigana}\n★要望：${inquiryContent}\n★年齢：${age}`+"\n" + `★階数：${buildingFloors}`+"\n"+`★主要採光面：${mainLightingDirection}`+"\n"+`★希望連絡時間：${preferredContactTime}`, // コメント
    "", // 質問メール回答
    "", // キャンセル案内担当
    "", // 送信社数
    "", // Pinrich
    "", // 競合名、理由
    "", // 乗換DM
    "", // 訪問査定取得者
    inquiryDateTime, // 反響日時
    "", // 契約年月
    "", // 1
    saleReason, // 査定理由
    "", // サイトURL
    "", // 並び替え用
    "", // 訪問時間
    "", // 曜日
    "", // ローン残
    "", // 下回っても売る
    "", // リフォーム
    "", // ★査定理由★
    "", // 名義人
    "", // 名義人の名前と関係性
    "", // 相続人
    "", // 相続登記
    "", // 司法書士の紹介
    "", // 面積の確認
    "", // 前面道路
    "", // 間口
    "", // インフラ
    "", // 構造
    "", // P台数
    "", // その他特徴
    "", // 離婚後住み続ける
    "", // 財産分与の為
    "", // 住替先は？
    "", // 売却前に引っ越し？
    "", // いつ転勤？
    "", // 過去に査定したことある？
    desiredSaleTime, // いつまでに売りたいか？
    desiredSalePrice, // 希望の価格はあるか？
    "", // 連絡取りやすい日、時間帯
    "", // 査定価格の感想
    "", // 土地（当社調べ）
    "", // 建物（当社調べ）
    "", // 査定方法
    "", // 連絡方法
    "", // 通知送信者
    "", // 通知送信日時
    "", // 査定担当
    "", // 電話担当（任意）
    "", // 査定額1
    "", // 査定額2
    "", // 査定額3
    "", // メール種別
    "", // 訪問時注意点
  ]);
}

function extractData(text, startMarker, endMarker) {
  var start = text.indexOf(startMarker);
  if (start === -1) return "";

  start += startMarker.length;
  var end = text.indexOf(endMarker, start);
  if (end === -1) end = text.length;

  return text.substring(start, end).trim();
}

function removeOitaPrefecture(str) {
  if (!str) return "";
  return str.replace(/^大分県/, '').trim();
}

function convertCurrentStatus(status) {
  if (!status) return "";
  if (status.includes("居住中")) return "居";
  if (status.includes("空室")) return "空";
  if (status.includes("賃貸")) return "賃";
  return "他";
}

function extractNumericValue(str) {
  var match = str.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : "";
}

// generateId と generateUrinushiNum 関数は別途定義が必要です


//athome

function transferAthomeSATEI(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName) {
  var cleanedBody = body?.replace(/\r?\n|\r/g, ' ') || '';

  // データ抽出用関数
  function extractData(text, startLabel, endLabel) {
    var pattern = new RegExp(startLabel + "\\s*：\\s*(.*?)\\s*" + endLabel);
    var match = text.match(pattern);
    return match ? match[1].trim() : "";
  }

  function extractNumericValue(str) {
    if (!str) return "";
    var match = str.match(/(\d+(?:\.\d+)?)/);
    return match ? match[1] : "";
  }

  function extractYearValue(str) {
    if (!str) return "";
    var match = str.match(/(\d{4})/);
    return match ? match[1] : "";
  }

  function convertPropertyStatus(status) {
    if (!status) return "";
    if (status.includes("居住中")) return "居";
    if (status.includes("空き")) return "空";
    if (status.includes("賃貸")) return "賃";
    return "他";
  }

  function extractPropertyAddress(str) {
    if (!str) return "";
    return str.replace(/^大分県/, '').trim();
  }

  function generateId() {
    return Utilities.getUuid();
  }

 

  // 各項目を抽出
  var receptionDate = extractData(cleanedBody, "受付完了日時", "-----");
  var name = extractData(cleanedBody, "お名前", "フリガナ");
  var furigana = extractData(cleanedBody, "フリガナ", "メールアドレス");
  var email = extractData(cleanedBody, "メールアドレス", "ご住所");
  var address = extractData(cleanedBody, "ご住所", "電話番号");
  var tel = "'" + extractData(cleanedBody, "電話番号", "ご希望時間帯");
  var contactTime = extractData(cleanedBody, "ご希望時間帯", "物件種目");
  var propertyType = extractData(cleanedBody, "物件種目", "所在地");
  var fullPropertyAddress = extractPropertyAddress(extractData(cleanedBody, "所在地", "建物名"));
  var buildingName = extractData(cleanedBody, "建物名", "専有面積");
  var exclusiveArea = extractData(cleanedBody, "専有面積", "建物面積");
  var buildingArea = extractData(cleanedBody, "建物面積", "土地面積");
  var landArea = extractData(cleanedBody, "土地面積", "間取り");
  var layout = extractData(cleanedBody, "間取り", "築年");
  var yearBuilt = extractYearValue(extractData(cleanedBody, "築年", "総戸数"));
  var totalUnits = extractData(cleanedBody, "総戸数", "現況");
  var propertyStatus = convertPropertyStatus(extractData(cleanedBody, "現況", "物件との関係"));
  var relation = extractData(cleanedBody, "物件との関係", "添付画像");
  var imageAttached = extractData(cleanedBody, "添付画像", "査定方法");
  var estimationMethod = extractData(cleanedBody, "査定方法", "査定理由");
  var reasonForEstimate = extractData(cleanedBody, "査定理由", "取引希望");
  var transactionPreferences = extractData(cleanedBody, "取引希望", "希望相談内容");
  var consultationDetails = extractData(cleanedBody, "希望相談内容", "売却希望時期");
  var sellingPeriod = extractData(cleanedBody, "売却希望時期", "買い替えについて");
  var replacementDetails = extractData(cleanedBody, "買い替えについて", "");

  // 日付処理
  var receptionDateObj = new Date(receptionDate);
  var responseYear = receptionDateObj.getFullYear();
  var responseDate = Utilities.formatDate(receptionDateObj, "Asia/Tokyo", "MM/dd");
  var today = new Date();
  var formattedDate = Utilities.formatDate(today, "Asia/Tokyo", "MM/dd");

  // 種別変換
  var displayPropertyType;
  if (propertyType.includes("一戸建て")) {
    displayPropertyType = "戸";
  } else if (propertyType.includes("分譲マンション") || propertyType.includes("マンション")) {
    displayPropertyType = "マ";
  } else if (propertyType.includes("土地")) {
    displayPropertyType = "土";
  } else {
    displayPropertyType = propertyType;
  }

  // 面積選定
  var areaValue = propertyType.includes("マンション")
    ? extractNumericValue(exclusiveArea)
    : extractNumericValue(buildingArea);

     // 今日の日付を取得
  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth() + 1;
  var day = today.getDate();
  var formattedDate = Utilities.formatDate(today, "Asia/Tokyo", "MM/dd");

  // コメント整形
  var commentParts = [];
  if (furigana) commentParts.push(`フリガナ: ${furigana}`);
  if (contactTime) commentParts.push(`希望連絡時間: ${contactTime}`);
  if (reasonForEstimate) commentParts.push(`査定理由: ${reasonForEstimate}`);
  if (sellingPeriod) commentParts.push(`売却希望時期: ${sellingPeriod}`);
  if (replacementDetails) commentParts.push(`買い替えについて: ${replacementDetails}`);
  if (transactionPreferences) commentParts.push(`取引希望: ${transactionPreferences}`);
  if (consultationDetails) commentParts.push(`希望相談内容: ${consultationDetails}`);

  var comments = commentParts.join('\n');

  // ID生成
  var id = generateId();
  var urinushiNum = generateUrinushiNum(address);

  // スプレッドシートに転記
  var ss = SpreadsheetApp.openById(destinationSsId);
  var sheet = ss.getSheetByName(destinationSheetName);
  var arrayResult = [
  "", // フォームURL
  urinushiNum, // 売主番号
  "", // S/担
  "不可", // 質問メール
  "", // E/担
  "", // 郵/担
  formattedDate, // 次電日
  "", // 確度
  "", // 査定額
  "", // 架電記録
  "ア", // サイト
  year, // 反響年
  formattedDate, // 反響日付
  displayPropertyType, // 種別
  extractNumericValue(landArea), // 土（㎡）
  areaValue, // 建（㎡）
  layout, // 間取り
  fullPropertyAddress + buildingName, // 物件所在地（まとめたもの）
  address, // 依頼者住所
  yearBuilt, // 築年
  propertyStatus, // 状況（売主）
  name, // 名前(漢字のみ）
  tel.replace(/-/g, ""), // 電話番号（ハイフン除去）
  email, // メールアドレス
  "", // 一番TEL
  "", // 訪問取得日
  "", // 訪問日
  "", // 営担
  "追客中", // 状況（当社）
  "【以下自動転記（アットホーム）】"+"\n" + comments, // コメント
  "", // 質問メール回答
  "", // キャンセル案内担当
  "", // 送信社数（※必要なら estimateCount に変更）
  "配信中", // Pinrich
  "", // 競合名、理由
  fullPropertyAddress, // 物件所在地（マンション名とは切り離したもの）
  "", // 訪問査定取得者
  receptionDate, // 反響詳細日時
  "", // 契約年月
  "", // 1（不明なカラム）
  "", // サイトURL
  reasonForEstimate, // 査定理由
  "", // 並び替え用
  "", // 訪問時間
  "", // 曜日
  "", // ローン残
  "", // 下回っても売る
  "", // リフォーム
  "", // ★査定理由★
  "", // 名義人
  "", // 名義人の名前と関係性
  "", // 相続人
  "", // 相続登記
  "", // 司法書士の紹介
  "", // 面積の確認
  "", // 前面道路
  "", // 間口
  "", // インフラ
  "", // 構造
  "", // P台数
  "", // その他特徴
  "", // 離婚後住み続ける
  "", // 財産分与の為
  "", // 住替先は？
  "", // 売却前に引っ越し？
  "", // いつ転勤？
  "", // 過去に査定したことある？
  "", // いつまでに売りたいか？
  "", // 希望の価格はあるか？
  "", // 連絡取りやすい日、時間帯
  "", // 査定価格の感想
  "", // 土地（当社調べ）
  "", // 建物（当社調べ）
  "", // 査定方法
  "", // 連絡方法
  "", // 通知送信者
  "", // 通知送信日時
  "", // 査定担当
  "", // 電話担当（任意）
  "", // 査定額1
  "", // 査定額2
  "", // 査定額3
  "", // メール種別
  "", // 訪問時注意点（ご要望を使用）
];

  // 転記
  SpreadsheetApp.flush();
  var row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, arrayResult.length).setValues([arrayResult]);
}

//上記全ての査定サイト共通のGAS
//一括でメールを取得を実行する

function getMailBatch() {

  //・・・メールを取得する
  for (var i = 1; i < valuesExecutionManagement.length; i++) {

    var valid = valuesExecutionManagement[i][columnExecutionManagement.indexOf("有効")];
    var id = valuesExecutionManagement[i][columnExecutionManagement.indexOf("ID")];
    var query = valuesExecutionManagement[i][columnExecutionManagement.indexOf("クエリ")];
    var searchCondition = valuesExecutionManagement[i][columnExecutionManagement.indexOf("検索条件")];
    var destinationSsId = valuesExecutionManagement[i][columnExecutionManagement.indexOf("転記先SS_ID")];
    var destinationSsUrl = valuesExecutionManagement[i][columnExecutionManagement.indexOf("転記先SS_URL")];
    var destinationSheetName = valuesExecutionManagement[i][columnExecutionManagement.indexOf("転記先シート名")];

    if (query == "") continue;
    if (valid == false) continue;

    Logger.log(["■", id, query]);

    //メールを取得する
    getMail(id, query,searchCondition, destinationSsId, destinationSsUrl, destinationSheetName);

    //最終実行日時をセットする
    sheetExecutionManagement.getRange(i + 1, columnExecutionManagement.indexOf("最終実行日時") + 1).setValue(new Date());

  }//for



  //・・・転送処理を実行する
  transferSheets();


}//function


//共通項目



//実際に特定のキーワード、上限でメールを取得する

function getMail(id, query, searchCondition, destinationSsId, destinationSsUrl, destinationSheetName) {
  Logger.log("★getEmail実行");

  Logger.log([query, searchCondition]);

  // メール検索の設定
  var start = 0;
  var max = 10;



  // 検索箇所に応じてクエリを作成
  if (searchCondition == '件名') {
    var threads = GmailApp.search('subject:"' + query + '"', start, max);

  } else if (searchCondition == '本文') {
    Logger.log("本文検索");
    var threads = GmailApp.search('in:body "' + query + '"', start, max);

  } else {
    var threads = GmailApp.search(query, start, max);
  }


  // そのままqueryを使用する


  Logger.log("スレッド数: " + threads.length);

  if (threads.length === 0) {
    Logger.log("指定したクエリに一致するメールが見つかりませんでした。");
    return;
  }

  var messagesForThreads = GmailApp.getMessagesForThreads(threads);

  // 各スレッドに含まれるメールを全てループで取得する
  for (const messages of messagesForThreads) {
    for (const message of messages) {
      var messageId = message.getId();
      var messageDate = message.getDate();
      var messageSubject = message.getSubject();
      var messageBody = message.getPlainBody(); // プレーンテキストとして本文を取得

      // messageId が数字のみの場合は先頭に STR_ を付与
      if (/^\d+$/.test(messageId)) {
        messageId = "STR_" + messageId;
      }

      // 現在シートに入っているデータと重複があるかをチェックする。二F度同じメールを取得することを防ぐ条件式
      if (valuesMailFlat.includes(messageId)) {
        //Logger.log("重複あり、スキップ");
        continue;
      }

      Logger.log("ID: " + messageId);
      Logger.log("受信日時: " + messageDate);//K11/24追加（受信日時が空欄になっているため）
      Logger.log("件名: " + messageSubject);
      Logger.log("本文: " + messageBody);

      //messageBody = text.replace(/=/g, '');
      messageBody = "'" + messageBody;


      //不要な文字が含まれている件名をスキップ
      if (String(messageSubject).match("Fwd")) {
        Logger.log("🔴Fwdスキップ");
        continue;

        //HOME4UとすまいステップとYahoo不動産、LIFULLはログイン形式なのでReは許可する
      } else if (String(messageSubject).match("Re") && query != "HOME4Uログアウト" && query != "らいふる" && query != "Re: 【イエウール】不動産査定依頼のお知らせ" && query != "【すまいステップ 反響通知メール】" && !String(messageSubject).match("Yahoo!不動産")) {
        Logger.log("🔴Reスキップ");
        continue;

        //HOME4Uログアウトという文字がはいっていない場合はスキップする
      } else if (query == "HOME4Uログアウト" && !String(messageBody).match("HOME4Uログアウト")) {
        Logger.log("🔴HOME4Uログアウトがありません");
        continue;

        //LIFULLHOMESの場合、”らいふる”という文字がはいっていない場合はスキップする
      } else if (query == "らいふる" && !String(messageBody).match("らいふる")) {
        Logger.log("🔴LIFULLHOMESのらいふるがありません");
        continue;

        // 【反響】アットホームのクエリの場合、LINE反響をスキップする
      } else if (query == "【反響】 アットホーム" && String(messageSubject).includes("LINE反響")) {
        Logger.log("🔴アットホームLINE反響スキップ");
        continue;


      } else if (String(messageSubject).match("電話反響")) {
        Logger.log("🔴電話反響スキップ");
        continue;

      } else if (String(messageSubject).match("インフォメ～ル")) {
        Logger.log("🔴インフォメ～ルスキップ");
        continue;

        //すまいステップで、1年以内の反響のみ閲覧できるという文言がない場合はスキップする
      } else if (query == "【すまいステップ 反響通知メール】" && !String(messageBody).match("1年以内の反響のみ閲覧できます")) {
        Logger.log("🔴【すまいステップ 反響通知メール、1年以内の反響のみ閲覧できますスキップ");
        continue;

        //Yahoo不動産で、本ページのテキストのコピーはパソコン版のみ可能ですという文言がない場合はスキップする
      } else if (String(messageSubject).match("Yahoo!不動産") && !String(messageBody).match("本ページのテキストのコピーはパソコン版のみ可能です")) {
        Logger.log("🔴Yahoo!不動産、本ページのテキストのコピーは、スキップ");
        continue;

      } else if (String(messageSubject).match("Yahoo!不動産") && !String(messageSubject).match("お客様から売却査定依頼がありました")) {
        Logger.log("🔴Yahoo!不動産、売却査定依頼がありましたスキップ");
        continue;
      }

      Logger.log("🟢スキップなし、メールに追加しました")


      // SpreadsheetApp.flush();//これ大事
      var row = sheetMail.getLastRow() + 1;
      var array = [messageId, messageDate, messageSubject, messageBody, id, query, destinationSsId, destinationSsUrl, destinationSheetName, false];
      sheetMail.getRange(row, 1, 1, array.length).setValues([array]);
      SpreadsheetApp.flush();//これ大事

      // 同一メッセージを転記しないように、処理済みのメッセージIDを追加する
      valuesMailFlat.push(messageId);

      //sheetMail.appendRow([messageId, messageDate, messageSubject, messageBody, id, query, destinationSsId, destinationSsUrl, destinationSheetName, false]);

    }//for
  }//for
}





//テスト用
function testGetMail() {


  // メール検索の設定
  var start = 0;
  var max = 10;

  var query = "Yahoo!不動産";

  // そのままqueryを使用する
  var threads = GmailApp.search(query, start, max);

  Logger.log("スレッド数: " + threads.length);

  if (threads.length === 0) {
    Logger.log("指定したクエリに一致するメールが見つかりませんでした。");
    return;
  }

  var messagesForThreads = GmailApp.getMessagesForThreads(threads);


  for (const messages of messagesForThreads) {
    for (const message of messages) {
      var messageId = message.getId();
      var messageDate = message.getDate();
      var messageSubject = message.getSubject();
      var messageBody = message.getPlainBody(); // プレーンテキストとして本文を取得

      Logger.log("ID: " + messageId);
      Logger.log("件名: " + messageSubject);
      Logger.log("本文: " + messageBody);

    }
  }


}





//共通項目
function transferSheets() {

  Logger.log("★transferSheets実行");
  SpreadsheetApp.flush();
  var valuesMail = sheetMail.getDataRange().getValues();

  for (var i = 0; i < valuesMail.length; i++) {
    var messageId = valuesMail[i][columnMail.indexOf("messageId")];
    var subject = valuesMail[i][columnMail.indexOf("件名")];
    var body = valuesMail[i][columnMail.indexOf("本文")];
    var id = valuesMail[i][columnMail.indexOf("ID")];
    var query = valuesMail[i][columnMail.indexOf("クエリ")];
    var destinationSsId = valuesMail[i][columnMail.indexOf("転記先SS_ID")];
    var destinationSsUrl = valuesMail[i][columnMail.indexOf("転記先SS_URL")];
    var destinationSheetName = valuesMail[i][columnMail.indexOf("転記先シート名")];
    var done = valuesMail[i][columnMail.indexOf("処理")];

    if (done != false) continue;

    Logger.log(["■", messageId, query]);

    //if (query == "【イエウール】不動産査定依頼のお知らせ") {
      //transferIeuru(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      //sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

      if (query == "【イエウール】不動産査定依頼のお知らせ") {
  // Pythonが処理するためスキップ（2026年5月変更）
  sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);


    } else if (query == "Re: 【イエウール】不動産査定依頼のお知らせ") {
     // transferIeuruRE(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "【LIFULL HOME'S】＜実名＞査定依頼がありました") {
      transferLIFULL(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "【SUUMO】仮予約のお申し込みがありました ") {
      transferSUUMOYOYAKU(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "らいふる") {
      transferRELIFULL(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "【反響】 アットホーム") {
      transferAthome(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "[リクルートＪＤＳ]反響お知らせメール") {
      transferJDS(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "【スタッフ指名のお問合せ】アットホーム") {
      transferAthomeNominate(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "【LINE反響】 アットホーム") {
      transferAthomeLine(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "反響 Yahoo!不動産 売買ツール") {
      transferYahoo(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "HOME4Uログアウト") {
      transferHOME4U(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "【すまいステップ 反響通知メール】") {
      transferSumai(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "物件に関する質問") {
      transferPRbukken(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "契約照会") {
      transferPRcontract(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "空室照会") {
      transferPRaki(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "フォーム回答") {
      transferPinRichform(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "PinRich 見学予約") {
      transferPRkengau(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "貴店ホームページからの売買") {
      transferAthp(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "「アットホーム売却査定受付サービス」の反響を受け付けました") {
      transferAthomeSATEI(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "査定書作成URLを発行しました") {
      transferSatei(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);
    }

    SpreadsheetApp.flush();
  }
}
function doGet(e) {
  try {
    transferSheets();
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'メール転記が完了しました'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
//共通


function generateUrinushiNum(fullPropertyAddress) {

  SpreadsheetApp.flush();

  // 福岡判定
  var isFukuoka = fullPropertyAddress && fullPropertyAddress.indexOf("福岡") !== -1;

  var newNum;

  if (isFukuoka) {
    // I2（9列目）
    var currentNum = sheetSerialNum.getRange(2, 9).getValue();
    Logger.log(["Fukuoka currentNum", currentNum]);

    newNum = "FI" + (currentNum + 1);
    Logger.log(["Fukuoka newNum", newNum]);

    sheetSerialNum.getRange(2, 9).setValue(currentNum + 1);

  } else {
    // C2（3列目）
    var currentNum = sheetSerialNum.getRange(2, 3).getValue();
    Logger.log(["Default currentNum", currentNum]);

    newNum = "AA" + (currentNum + 1);
    Logger.log(["Default newNum", newNum]);

    sheetSerialNum.getRange(2, 3).setValue(currentNum + 1);
  }

  SpreadsheetApp.flush();

  return newNum;
}




function generateKainushiNum() {

  SpreadsheetApp.flush();

  var currentNum = sheetSerialNum.getRange(2, 2).getValue();
  Logger.log(["currentNum", currentNum]);

  var newNum = currentNum + 1;
  Logger.log(["newNum", newNum])

  sheetSerialNum.getRange(2, 2).setValue(currentNum + 1);
  SpreadsheetApp.flush();

  return newNum;

}



function generateId() {
  //稀にID0が発生することがあるので0が発生したら再生成する仕組みを３回まで繰り返す。３回実施すれば実質的に０が発生する可能性は天文学的な確率になるので０％に等しい

  var id = Utilities.getUuid().slice(1, 13);
  if (id == 0) {
    var id = Utilities.getUuid().slice(1, 13);
  }
  if (id == 0) {
    var id = Utilities.getUuid().slice(1, 13);
  }
  if (id == 0) {
    var id = Utilities.getUuid().slice(1, 13);
  }

  id = id.replace("-", ""); //ハイフンが含まれるとスプレッドシート上でダブルクリックで一発でＩＤの取得ができないのでハイフンを除く

  // アルファベットの小文字
  const alphabet = "abcdefghijklmnopqrstuvwxyz";

  // ランダムなインデックスを生成
  const randomIndex = Math.floor(Math.random() * alphabet.length);

  // ランダムな文字を取得
  const randomLetter = alphabet[randomIndex];

  //idの最後尾につける。稀に数字のみのＩＤが発行され数字型になってしまうので末尾にアルファベットを１つ付け加えて確実に文字列にする
  id = id + randomLetter;

  return id;
}





// データ抽出用のヘルパー関数
function extractData(text, from, to) {
  var fromIndex = text.indexOf(from);
  if (fromIndex === -1) return '';
  fromIndex += from.length;
  var toIndex = text.indexOf(to, fromIndex);
  if (toIndex === -1) toIndex = text.length;
  return text.substring(fromIndex, toIndex).trim();
}




//坪⇒平米換算
function convertTsuboToHeibei(tsubo) {

  // "坪"を取り除く
  var numericValue = parseFloat(tsubo.replace("坪", ""));

  // 坪を平方メートルに変換（1坪 = 3.3平方メートル）
  var heibei = numericValue * 3.3;

  Logger.log([tsubo, heibei])

  // 結果を返す
  return heibei;

}

// -------------------------------------------------------------------------------
// メール本文から正規表現で指定キーワードの項目値を抽出する
// ※キーワード＆セパレーターから改行まで取得
// (i) body      : メール本文
// (i) keyword   : キーワード（項目名）
// (i) separator : 項目値の取得開始となるセパレーター
// (o) 抽出した項目値
// -------------------------------------------------------------------------------
function extractData2(body, keyword, separator) {
  
  let regex = new RegExp(keyword + "\\s*" + separator + "\s*(.*?)\n");

  let match = body.match(regex);
  if (match === null) return "";
  return match[1].trim();
}

// ----------------------------------------------------------
// インラインマークを取り除く
// ----------------------------------------------------------
function removeInline(text) {
  // インラインマーク「>」を削除する
  var cleanedText = text.replace(/>/g, '');

  // 空行を削除
  cleanedText = cleanedText.split('\n').filter(function(line) {
    return line.trim() !== '';
  }).join('\n');

  // そのまま返す
  return cleanedText.trim();
}

// -------------------------------------------------------------------------------
// メール本文から1行ずつキーワードチェックを行い、該当行の項目値を取得する
// (i) body      : メール本文
// (i) keyword   : キーワード（項目名）
// (o) 抽出した項目値
// -------------------------------------------------------------------------------
function getMailBodyItem(body, keyword) {
  var lines = body.split(/\r?\n/);

  // 分割結果をログに出力
  for (let line of lines) {
    if (line.indexOf(keyword) !== -1) {
      // キーワードの後ろから取得
      return line.substring(line.indexOf(keyword) + keyword.length);
    }
  }
  return "";
}















