#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""システムの現在日時を確認（Python版）"""

from datetime import datetime, timedelta

# システムの現在日時
now = datetime.now()
today = now.replace(hour=0, minute=0, second=0, microsecond=0)

print('=== システムの現在日時（Python） ===')
print()
print(f'📅 日付: {today.strftime("%Y-%m-%d")}')
print(f'📅 曜日: {["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"][today.weekday()]}')
print(f'🕐 時刻: {now.strftime("%H:%M:%S")}')
print()

# AA13729の訪問日
visit_date = datetime(2026, 4, 4, 0, 0, 0)
visit_day = visit_date.weekday()  # 0=月曜, 6=日曜

print(f'📅 訪問日: {visit_date.strftime("%Y-%m-%d")}')
print(f'📅 訪問日の曜日: {["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"][visit_day]}')
print()

# 前営業日の計算（木曜日=3の場合は2日前、それ以外は1日前）
days_before_visit = 2 if visit_day == 3 else 1
notify_date = visit_date - timedelta(days=days_before_visit)

print(f'📅 前営業日の日数: {days_before_visit}日前')
print(f'📅 通知日: {notify_date.strftime("%Y-%m-%d")} ({["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"][notify_date.weekday()]})')
print()

# 判定
is_match = today == notify_date
print(f'🎯 今日 === 通知日: {is_match}')
print()

if is_match:
    print('✅ 結果: AA13729は訪問日前日カテゴリに含まれる')
else:
    print('❌ 結果: AA13729は訪問日前日カテゴリに含まれない')
    print()
    print('理由:')
    print(f'  今日: {today.strftime("%Y-%m-%d")}')
    print(f'  通知日: {notify_date.strftime("%Y-%m-%d")}')
    diff_days = (today - notify_date).days
    print(f'  差: {diff_days}日')
