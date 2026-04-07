#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
スプレッドシートでAA13224とAA13932の状況（当社）を確認するスクリプト
"""

import os
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# Google Sheets設定
SPREADSHEET_ID = "1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY"
SHEET_NAME = "売主リスト"

# 認証情報（環境変数から取得）
# Note: サービスアカウントキーが必要
# 今回は直接スプレッドシートAPIを使わず、バックエンドのSpreadsheetSyncServiceを確認する方が良い

print("=" * 80)
print("スプレッドシート確認")
print("=" * 80)
print()
print("注意: Google Sheets APIの認証情報が必要です。")
print("代わりに、バックエンドのSpreadsheetSyncServiceのマッピングを確認します。")
print()
