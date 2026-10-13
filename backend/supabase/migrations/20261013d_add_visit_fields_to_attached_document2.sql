-- Migration: 添付資料２に訪問時記入フィールドを追加
ALTER TABLE seller_attached_document2
  ADD COLUMN IF NOT EXISTS exterior_reform TEXT,   -- 外観リフォーム
  ADD COLUMN IF NOT EXISTS interior_reform TEXT,   -- 内装リフォーム
  ADD COLUMN IF NOT EXISTS defects         TEXT,   -- 雨漏れ、シロアリ等の不具合
  ADD COLUMN IF NOT EXISTS solar_panel     TEXT,   -- 太陽光（Kw 買取保証期間 年 月）
  ADD COLUMN IF NOT EXISTS incident_info   TEXT,   -- 事件、事故
  ADD COLUMN IF NOT EXISTS minpaku         TEXT;   -- 民泊

COMMENT ON COLUMN seller_attached_document2.exterior_reform IS '外観リフォーム';
COMMENT ON COLUMN seller_attached_document2.interior_reform IS '内装リフォーム';
COMMENT ON COLUMN seller_attached_document2.defects         IS '雨漏れ、シロアリ等の不具合';
COMMENT ON COLUMN seller_attached_document2.solar_panel     IS '太陽光（Kw 買取保証期間 年 月）';
COMMENT ON COLUMN seller_attached_document2.incident_info   IS '事件、事故';
COMMENT ON COLUMN seller_attached_document2.minpaku         IS '民泊';

NOTIFY pgrst, 'reload schema';
