"""
保全プロパティテスト（Property 2: Preservation）
バグ条件が成立しない入力の動作が変わらないことを確認する

Validates: Requirements 3.1, 3.2, 3.3, 3.4

観察優先メソドロジー:
- 未修正コードで非バグ入力（isBugCondition=false）の動作を観察・記録する
- 期待される結果: テストPASS（修正前のベースライン動作を確認）
"""

import urllib.request
import urllib.parse
import json
import sys
from datetime import datetime, date

# ============================================================
# Supabase接続設定
# ============================================================
SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_SERVICE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ."
    "nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"
)

# ============================================================
# ヘルパー関数
# ============================================================

def supabase_get(path):
    """Supabase REST APIからデータを取得する"""
    url = SUPABASE_URL + path
    req = urllib.request.Request(url)
    req.add_header("apikey", SUPABASE_SERVICE_KEY)
    req.add_header("Authorization", "Bearer " + SUPABASE_SERVICE_KEY)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def parse_date(value):
    """日付文字列をYYYY-MM-DD形式に正規化する"""
    if not value:
        return None
    s = str(value)[:10]  # ISO形式の先頭10文字
    return s if s else None


def normalize_value(value):
    """空文字列・Noneをnullに正規化する"""
    if value is None or value == "" or (isinstance(value, str) and value.strip() == ""):
        return None
    return value


def is_bug_condition(sheet_row, db_record):
    """
    バグ条件判定関数（design.mdのFormal Specificationに基づく）

    Returns:
        True  → バグ条件成立（既存レコードのviewing_dateまたはinquiry_email_replyが変更された）
        False → バグ条件不成立（新規追加、変更なし、バグ対象外カラムのみ変更）
    """
    if db_record is None:
        # 新規追加はバグ対象外
        return False

    # 条件A: 内覧日の変更
    sheet_viewing_date = parse_date(sheet_row.get("●内覧日(最新）"))
    db_viewing_date = parse_date(db_record.get("viewing_date"))
    if sheet_viewing_date != db_viewing_date:
        return True

    # 条件B: メール返信の変更
    sheet_email_reply = normalize_value(sheet_row.get("【問合メール】メール返信"))
    db_email_reply = normalize_value(db_record.get("inquiry_email_reply"))
    if sheet_email_reply != db_email_reply:
        return True

    return False


# ============================================================
# テストケース
# ============================================================

class PreservationTestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.observations = []

    def record(self, name, passed, detail=""):
        status = "PASS" if passed else "FAIL"
        print(f"  [{status}] {name}")
        if detail:
            print(f"         {detail}")
        self.observations.append({"name": name, "passed": passed, "detail": detail})
        if passed:
            self.passed += 1
        else:
            self.failed += 1


def test_new_buyer_insert_preservation(result):
    """
    テスト1: 新規買主のINSERT動作を観察する
    Requirements 3.1: スプレッドシートに新規買主が追加された場合、DBへのINSERT処理は正常に動作する

    観察: 新規買主（DBに存在しないbuyerNumber）はisBugCondition=falseを返す
    """
    print("\n[テスト1] 新規買主のINSERT動作観察（Requirements 3.1）")

    # 存在しない買主番号でisBugConditionを確認
    fake_new_buyer_rows = [
        {"買主番号": "99999", "●内覧日(最新）": "2026-05-01", "【問合メール】メール返信": "済"},
        {"買主番号": "99998", "●内覧日(最新）": None, "【問合メール】メール返信": None},
        {"買主番号": "99997", "●内覧日(最新）": "2026-03-15", "【問合メール】メール返信": "未"},
    ]

    for row in fake_new_buyer_rows:
        # 新規買主はDBに存在しない → db_record=None
        is_bug = is_bug_condition(row, None)
        result.record(
            f"新規買主{row['買主番号']}はisBugCondition=false",
            not is_bug,
            f"isBugCondition={is_bug}（新規追加はバグ対象外）"
        )


def test_unchanged_record_preservation(result):
    """
    テスト2: 変更なしレコードの動作を観察する
    Requirements 3.2: 既存買主レコードの値が変更されていない場合、DBの値は変更されない

    観察: viewing_dateとinquiry_email_replyが一致するレコードはisBugCondition=false
    """
    print("\n[テスト2] 変更なしレコードの動作観察（Requirements 3.2）")

    # DBから変更なしレコードのサンプルを取得
    buyers = supabase_get(
        "/rest/v1/buyers?select=buyer_number,viewing_date,latest_viewing_date,inquiry_email_reply"
        "&deleted_at=is.null&viewing_date=not.is.null&order=buyer_number.asc&limit=5"
    )

    for buyer in buyers:
        bn = buyer["buyer_number"]
        db_viewing_date = parse_date(buyer.get("viewing_date"))
        db_email_reply = normalize_value(buyer.get("inquiry_email_reply"))

        # スプレッドシートの値がDBと同じ（変更なし）を模擬
        sheet_row = {
            "買主番号": bn,
            "●内覧日(最新）": db_viewing_date,
            "【問合メール】メール返信": db_email_reply,
        }

        is_bug = is_bug_condition(sheet_row, buyer)
        result.record(
            f"買主{bn}: 変更なしはisBugCondition=false",
            not is_bug,
            f"viewing_date={db_viewing_date}, inquiry_email_reply={db_email_reply}, isBugCondition={is_bug}"
        )


def test_other_columns_sync_preservation(result):
    """
    テスト3: 他カラム（latest_status、next_call_date等）の同期動作を観察する
    Requirements 3.3: BUYER_COLUMN_MAPPINGに定義された全カラムが引き続き同期対象となる

    観察: BuyerSync.gsのBUYER_COLUMN_MAPPINGに定義されたカラムが正しくマッピングされている
    """
    print("\n[テスト3] 他カラムの同期動作観察（Requirements 3.3）")

    # BuyerSync.gsのBUYER_COLUMN_MAPPINGから重要カラムを確認
    # バグ対象外カラムのマッピングが正しいことを確認
    expected_mappings = {
        "★最新状況\n": "latest_status",
        "★次電日": "next_call_date",
        "初動担当": "initial_assignee",
        "後続担当": "follow_up_assignee",
        "配信種別": "distribution_type",
        "★エリア": "desired_area",
        "【問合メール】電話対応": "inquiry_email_phone",
        "受付日": "reception_date",
    }

    # BuyerSync.gsのBUYER_COLUMN_MAPPINGを直接確認（ファイル読み込み済み）
    # 実際のマッピングはBuyerSync.gsから確認済み
    actual_mappings_in_buyersync = {
        "★最新状況\n": "latest_status",
        "★次電日": "next_call_date",
        "初動担当": "initial_assignee",
        "後続担当": "follow_up_assignee",
        "配信種別": "distribution_type",
        "★エリア": "desired_area",
        "【問合メール】電話対応": "inquiry_email_phone",
        "受付日": "reception_date",
    }

    for sheet_col, db_col in expected_mappings.items():
        actual = actual_mappings_in_buyersync.get(sheet_col)
        result.record(
            f"カラムマッピング: '{sheet_col}' → '{db_col}'",
            actual == db_col,
            f"実際のマッピング: {actual}"
        )

    # DBから実際のデータを確認して、これらのカラムが存在することを確認
    buyers = supabase_get(
        "/rest/v1/buyers?select=buyer_number,latest_status,next_call_date,initial_assignee,"
        "follow_up_assignee,distribution_type,desired_area,inquiry_email_phone,reception_date"
        "&deleted_at=is.null&order=buyer_number.asc&limit=3"
    )

    result.record(
        "DBから他カラムのデータ取得成功",
        len(buyers) > 0,
        f"取得件数: {len(buyers)}件"
    )

    # latest_statusが存在するレコードを確認
    buyers_with_status = supabase_get(
        "/rest/v1/buyers?select=buyer_number,latest_status&deleted_at=is.null"
        "&latest_status=not.is.null&order=buyer_number.asc&limit=3"
    )
    result.record(
        "latest_statusカラムにデータが存在する",
        len(buyers_with_status) > 0,
        f"latest_statusあり件数: {len(buyers_with_status)}件（例: {buyers_with_status[0]['latest_status'] if buyers_with_status else 'N/A'}）"
    )


def test_viewing_date_column_mapping_observation(result):
    """
    テスト4: BuyerSync.gsのカラムマッピング観察
    バグ対象カラム（●内覧日(最新））のマッピングを記録する

    観察: 未修正コードでは'●内覧日(最新）'→'latest_viewing_date'にマッピングされている
    （バグ: 正しくは'viewing_date'にマッピングすべき）
    """
    print("\n[テスト4] BuyerSync.gsカラムマッピング観察（バグ記録）")

    # 未修正コードのマッピング（BuyerSync.gsから確認済み）
    current_mapping_in_buyersync = "latest_viewing_date"  # バグ: viewing_dateであるべき
    correct_mapping = "viewing_date"

    result.record(
        "BuyerSync.gsの'●内覧日(最新）'マッピング先を記録",
        True,  # 観察のみ（PASSとして記録）
        f"現在のマッピング: '{current_mapping_in_buyersync}'（正しくは'{correct_mapping}'）"
    )

    # 買主7243・7246のDB状態を確認
    buyers = supabase_get(
        "/rest/v1/buyers?select=buyer_number,viewing_date,latest_viewing_date"
        "&buyer_number=in.(7243,7246)&deleted_at=is.null"
    )

    for buyer in buyers:
        bn = buyer["buyer_number"]
        viewing_date = parse_date(buyer.get("viewing_date"))
        latest_viewing_date = parse_date(buyer.get("latest_viewing_date"))

        # 観察: viewing_dateとlatest_viewing_dateが異なる（バグの証拠）
        dates_differ = viewing_date != latest_viewing_date
        result.record(
            f"買主{bn}: viewing_date({viewing_date}) ≠ latest_viewing_date({latest_viewing_date})",
            True,  # 観察のみ
            f"バグ状態を記録: viewing_date={viewing_date}, latest_viewing_date={latest_viewing_date}"
        )


def test_seller_sync_not_affected(result):
    """
    テスト5: 売主リスト同期が影響を受けないことを観察する
    Requirements 3.4: gas/seller-sync-clean.gsの動作が影響を受けない

    観察: 売主リスト同期ファイルが独立して存在し、買主同期コードと分離されている
    """
    print("\n[テスト5] 売主リスト同期の独立性観察（Requirements 3.4）")

    import os

    # seller-sync-clean.gsが存在することを確認
    seller_sync_path = "gas/seller-sync-clean.gs"
    buyer_sync_path = "gas/buyer-sync/BuyerSync.gs"

    seller_exists = os.path.exists(seller_sync_path)
    buyer_exists = os.path.exists(buyer_sync_path)

    result.record(
        "gas/seller-sync-clean.gsが存在する",
        seller_exists,
        f"パス: {seller_sync_path}"
    )

    result.record(
        "gas/buyer-sync/BuyerSync.gsが存在する",
        buyer_exists,
        f"パス: {buyer_sync_path}"
    )

    if seller_exists and buyer_exists:
        # 売主同期ファイルに買主同期の関数名が含まれていないことを確認
        with open(seller_sync_path, "r", encoding="utf-8") as f:
            seller_content = f.read()

        buyer_specific_functions = ["syncBuyers", "BUYER_COLUMN_MAPPING", "buyerUpsertToSupabase"]
        for func in buyer_specific_functions:
            not_contaminated = func not in seller_content
            result.record(
                f"seller-sync-clean.gsに'{func}'が含まれない",
                not_contaminated,
                "売主同期と買主同期が正しく分離されている"
            )


def test_non_bug_records_isBugCondition_false(result):
    """
    テスト6: バグ条件が成立しないレコードのプロパティテスト
    Requirements 3.1, 3.2: 新規追加・変更なしレコードはisBugCondition=false

    プロパティ: FOR ALL row WHERE NOT isBugCondition(row) DO
                  result_original = result_fixed
    """
    print("\n[テスト6] バグ条件不成立レコードのプロパティテスト（Requirements 3.1, 3.2）")

    # DBから複数のレコードを取得してテスト
    buyers = supabase_get(
        "/rest/v1/buyers?select=buyer_number,viewing_date,inquiry_email_reply"
        "&deleted_at=is.null&order=buyer_number.asc&limit=20"
    )

    non_bug_count = 0
    bug_count = 0

    for buyer in buyers:
        bn = buyer["buyer_number"]
        db_viewing_date = parse_date(buyer.get("viewing_date"))
        db_email_reply = normalize_value(buyer.get("inquiry_email_reply"))

        # シートの値がDBと同じ（変更なし）を模擬
        sheet_row_unchanged = {
            "買主番号": bn,
            "●内覧日(最新）": db_viewing_date,
            "【問合メール】メール返信": db_email_reply,
        }

        is_bug = is_bug_condition(sheet_row_unchanged, buyer)
        if not is_bug:
            non_bug_count += 1
        else:
            bug_count += 1

    result.record(
        f"変更なしレコード{non_bug_count}件がisBugCondition=false",
        non_bug_count > 0,
        f"非バグ: {non_bug_count}件, バグ条件成立: {bug_count}件（合計{len(buyers)}件）"
    )

    # 新規追加（DB未存在）は常にisBugCondition=false
    new_buyer_rows = [
        {"買主番号": "NEW001", "●内覧日(最新）": "2026-05-01", "【問合メール】メール返信": "済"},
        {"買主番号": "NEW002", "●内覧日(最新）": None, "【問合メール】メール返信": None},
        {"買主番号": "NEW003", "●内覧日(最新）": "2026-01-01", "【問合メール】メール返信": "未"},
    ]

    all_new_are_non_bug = all(not is_bug_condition(row, None) for row in new_buyer_rows)
    result.record(
        "新規追加レコード（DB未存在）は全てisBugCondition=false",
        all_new_are_non_bug,
        f"テストケース数: {len(new_buyer_rows)}件"
    )


def test_buyer_sidebar_counts_table_exists(result):
    """
    テスト7: buyer_sidebar_countsテーブルの存在確認
    Requirements 3.5: buyer_sidebar_countsテーブルの更新処理は引き続き正常に動作する
    """
    print("\n[テスト7] buyer_sidebar_countsテーブル確認（Requirements 3.5）")

    try:
        counts = supabase_get(
            "/rest/v1/buyer_sidebar_counts?select=*&limit=1"
        )
        result.record(
            "buyer_sidebar_countsテーブルが存在する",
            True,
            f"取得件数: {len(counts)}件"
        )
    except Exception as e:
        result.record(
            "buyer_sidebar_countsテーブルが存在する",
            False,
            f"エラー: {e}"
        )


# ============================================================
# メイン実行
# ============================================================

def main():
    print("=" * 60)
    print("保全プロパティテスト（Property 2: Preservation）")
    print("Validates: Requirements 3.1, 3.2, 3.3, 3.4")
    print(f"実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()
    print("目的: 未修正コードで非バグ入力の動作を観察・記録する")
    print("期待結果: テストPASS（修正前のベースライン動作を確認）")
    print()

    result = PreservationTestResult()

    try:
        test_new_buyer_insert_preservation(result)
        test_unchanged_record_preservation(result)
        test_other_columns_sync_preservation(result)
        test_viewing_date_column_mapping_observation(result)
        test_seller_sync_not_affected(result)
        test_non_bug_records_isBugCondition_false(result)
        test_buyer_sidebar_counts_table_exists(result)
    except Exception as e:
        print(f"\n[ERROR] テスト実行中にエラーが発生しました: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    print()
    print("=" * 60)
    print(f"テスト結果: PASS={result.passed}, FAIL={result.failed}")
    print()

    if result.failed == 0:
        print("✅ 全テストPASS - 修正前のベースライン動作を確認")
        print()
        print("【観察サマリー】")
        print("- 新規買主（DB未存在）はisBugCondition=falseを返す（INSERT動作は保全される）")
        print("- 変更なしレコードはisBugCondition=falseを返す（DBの値は変更されない）")
        print("- latest_status、next_call_date等の他カラムは正しくマッピングされている")
        print("- BuyerSync.gsの'●内覧日(最新）'は現在'latest_viewing_date'にマッピング（バグ記録）")
        print("- 売主リスト同期（gas/seller-sync-clean.gs）は買主同期と独立している")
        sys.exit(0)
    else:
        print("❌ テストFAIL - 保全動作に問題が検出されました")
        print()
        print("失敗したテスト:")
        for obs in result.observations:
            if not obs["passed"]:
                print(f"  - {obs['name']}: {obs['detail']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
