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



//1-2 getMail.gs


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




//transferSheets.gs
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

    if (query == "【イエウール】不動産査定依頼のお知らせ") {
      transferIeuru(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
      sheetMail.getRange(i + 1, columnMail.indexOf("処理") + 1).setValue(true);

    } else if (query == "Re: 【イエウール】不動産査定依頼のお知らせ") {
      transferIeuruRE(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName);
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

//イエウール　メール通知

function transferIeuru(messageId, subject, body, destinationSsId, destinationSsUrl, destinationSheetName) {
  // 改行をスペースに置き換える
  var cleanedBody = body?.replace(/\r?\n|\r/g, ' ') || '';

  // 各項目を抽出
  var detailUrl = extractData(cleanedBody, "詳細は下記URLでご確認ください。", "============================================================");
  //var requestDate = extractData(cleanedBody, "依頼日時　　　　: ", "同時査定社数");
  var requestDate = "";

var bodyText = String(body || "");
var cleanedText = bodyText.replace(/\r?\n|\r/g, " ");

// 依頼日時　　　　: 2026-05-15 12:06:34 を取得
var requestDateMatch = cleanedText.match(
  /依頼日時[\s　]*[:：][\s　]*([0-9]{4}[-\/][0-9]{1,2}[-\/][0-9]{1,2}[\s　]+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/
);

if (requestDateMatch) {
  requestDate = requestDateMatch[1].trim();
}

Logger.log("反響詳細日時 requestDate = [" + requestDate + "]");
Logger.log("requestDate = " + requestDate);
  var estimateCount = extractData(cleanedBody, "同時査定社数　　: ", "■ 不動産情報");

  // requestDateから日付オブジェクトを作成
  var requestDateObj = new Date(requestDate);

  // 反響年と反響日付を取得
  var responseYear = requestDateObj.getFullYear();
  var responseDate = Utilities.formatDate(requestDateObj, "Asia/Tokyo", "MM/dd");

  // 今日の日付を取得（次電日用）
  var today = new Date();
  var nextCallDate = Utilities.formatDate(today, "Asia/Tokyo", "MM/dd");

  // 不動産情報
  var propertyType = extractData(cleanedBody, "物件種別　　　　: ", "物件住所");

  // propertyTypeの値に基づいて表示を変更
  var displayPropertyType;
  if (propertyType.includes("一戸建て")) {
    displayPropertyType = "戸";
  } else if (propertyType.includes("分譲マンション") || propertyType.includes("マンション")) {
    displayPropertyType = "マ";
  } else if (propertyType.includes("土地")) {
    displayPropertyType = "土";
  } else {
    displayPropertyType = propertyType; // その他の場合は元の値をそのまま使用
  }

  // ★ここを修正：cleanedBodyではなくbodyから直接取得
  var fullPropertyAddress = extractPropertyAddressFromBody(body);

  var mansionName = extractData(cleanedBody, "マンション名　　: ", "部屋番号");
  var roomNumber = extractData(cleanedBody, "部屋番号　　　　: ", "建物名");
  var buildingName = extractData(cleanedBody, "建物名　　　　　: ", "専有面積");
  var exclusiveArea = extractData(cleanedBody, "専有面積　　　　: ", "建物面積");
  var buildingArea = extractData(cleanedBody, "建物面積　　　　: ", "土地面積");
  var landArea = extractData(cleanedBody, "土地面積　　　　: ", "延べ床面積");
  var layout = extractData(cleanedBody, "間取り　　　　　: ", "築年数");
  var builtYear = extractYearValue(extractData(cleanedBody, "築年数　　　　　: ", "物件の状況"));
  var propertyStatus = convertPropertyStatus(extractData(cleanedBody, "物件の状況　　　: ", "物件との関係"));

  var areaValue;
  if (propertyType.indexOf("マンション") !== -1) {
    areaValue = extractNumericValue(exclusiveArea); // マンションの場合は専有面積
  } else {
    areaValue = extractNumericValue(buildingArea); // 戸建ての場合は建物面積
  }

  // ユーザ情報
  var name = extractData(cleanedBody, "氏名　　　　　　: ", "フリガナ");
  var furigana = extractData(cleanedBody, "フリガナ　　　　: ", "年齢");
  var age = extractData(cleanedBody, "年齢　　　　　　: ", "住所");
  var address = extractData(cleanedBody, "住所　　　　　　: ", "電話番号");

  // 先頭にシングルコーテーションを入れて数字型への変換を防ぐ
  var tel = "'" + extractData(cleanedBody, "電話番号　　　　: ", "Email");
  tel = tel.trim();
  tel = tel.toString();

  var email = extractData(cleanedBody, "Email 　　　　　: ", "希望連絡時間");
  var contactTime = extractData(cleanedBody, "希望連絡時間　　: ", "査定理由");
  var reasonForEstimate = extractData(cleanedBody, "査定理由　　　　: ", "査定会社への要望");
  var requestToCompany = extractData(cleanedBody, "査定会社への要望: ", "買い替え有無");

  var commentToAdd = extractComment(cleanedBody);

  // コメントに必要な情報をまとめる
  var commentParts = [];

  if (furigana) commentParts.push("フリガナ: " + furigana);
  if (age) commentParts.push("年齢: " + age);
  if (contactTime) commentParts.push("希望連絡時間: " + contactTime);
  if (requestToCompany) commentParts.push("査定会社への要望: " + requestToCompany);
  if (estimateCount) commentParts.push("同時送信社数: " + estimateCount);
  if (commentToAdd) commentParts.push("コメント: " + commentToAdd);

  var comments = commentParts.join('\n');

  // 新しい ID を生成
  var id = generateId();

  // ★ここを修正：addressではなくfullPropertyAddressを渡す
  var urinushiNum = generateUrinushiNum(fullPropertyAddress);

  // 今日の日付を取得
  var year = today.getFullYear();
  var month = today.getMonth() + 1;
  var day = today.getDate();
  var formattedDate = Utilities.formatDate(today, "Asia/Tokyo", "MM/dd");

  // ログ確認用
  Logger.log("fullPropertyAddress = " + fullPropertyAddress);
  Logger.log("address = " + address);
  Logger.log("urinushiNum source = " + fullPropertyAddress);

  // スプレッドシートにデータを追加
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
    "ウ", // サイト
    year, // 反響年
    responseDate, // 反響日付
    displayPropertyType, // 種別
    extractNumericValue(landArea), // 土（㎡）
    areaValue, // 建（㎡）
    layout, // 間取り
    fullPropertyAddress + mansionName + roomNumber, // 物件所在地（まとめたもの）
    address, // 依頼者住所
    builtYear, // 築年
    propertyStatus, // 状況（売主）
    name, // 名前(漢字のみ）
    tel.replace(/-/g, ""), // 電話番号（ハイフン除去）
    email, // メールアドレス
    "", // 一番TEL
    "", // 訪問取得日
    "", // 訪問日
    "", // 営担
    "追客中", // 状況（当社）
    "【以下自動転記（イエウール）】" + "\n" + comments, // コメント
    "", // 質問メール回答
    "", // キャンセル案内担当
    estimateCount, // 送信社数
    "配信中", // Pinrich
    "", // 競合名、理由
    fullPropertyAddress, // 物件所在地（マンション名とは切り離したもの）
    "", // 訪問査定取得者
    requestDate, // 反響詳細日時
    "", // 契約年月
    "", // 1
    reasonForEstimate, // 査定理由
    detailUrl, // サイトURL
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

  SpreadsheetApp.flush();
  var row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, arrayResult.length).setValues([arrayResult]);
}

// ------------------------------
// 補助関数
// ------------------------------

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

// 物件の状況を変換する関数
function convertPropertyStatus(status) {
  if (!status) return "";
  if (status.includes("居住中")) return "居";
  if (status.includes("空き")) return "空";
  if (status.includes("賃貸")) return "賃";
  return "他";
}

// コメント抽出
function extractComment(cleanedBody) {
  var startMarker = "コメント";
  var endMarkers = ["追加の問い合わせ", "============================================================"];

  var startIndex = cleanedBody.indexOf(startMarker);
  if (startIndex === -1) return "";

  var substring = cleanedBody.slice(startIndex + startMarker.length);

  var endIndex = -1;
  for (var i = 0; i < endMarkers.length; i++) {
    var idx = substring.indexOf(endMarkers[i]);
    if (idx !== -1 && (endIndex === -1 || idx < endIndex)) {
      endIndex = idx;
    }
  }

  if (endIndex !== -1) {
    substring = substring.slice(0, endIndex);
  }

  return substring.trim();
}

// ★物件住所を本文から直接抜く
function extractPropertyAddressFromBody(body) {
  if (!body) return "";

  var match = body.match(/物件住所[^\S\r\n]*:[^\S\r\n]*(.*?)(?:\r?\n)マンション名/);
  if (!match) return "";

  return match[1].replace(/^大分県/, "").trim();
}




//共通実行



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











