-- Migration 139: 売主(買いたい側)×売主(売りたい側)のペアごとのマッチング連絡状況テーブルを追加
--
-- 背景:
--   売主が「買いたい」意図を持つ場合、マッチする相手は他の「売りたい」売主になる。
--   seller_buyer_match_contacts（売主×買主）と同様に、売主×売主のペアごとに
--   連絡状況（連絡済み/連絡不要/連絡未）を個別に記録する必要がある。
--
-- 用途:
--   つうわモードページの「買いたいマッチング」セクションで、マッチした売却中の売主候補を
--   一覧テーブルで表示し、各行に連絡状況ボタンを設置して記録する。

CREATE TABLE IF NOT EXISTS seller_seller_match_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, -- 「買いたい」側の売主
    seller_seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, -- 「売りたい」側の売主（マッチした相手）
    contact_status TEXT NOT NULL DEFAULT '連絡未', -- '連絡済み' | '連絡不要' | '連絡未'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT,

    UNIQUE(buyer_seller_id, seller_seller_id)
);

CREATE INDEX IF NOT EXISTS idx_seller_seller_match_contacts_buyer_seller_id ON seller_seller_match_contacts(buyer_seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_seller_match_contacts_seller_seller_id ON seller_seller_match_contacts(seller_seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_seller_match_contacts_status ON seller_seller_match_contacts(contact_status);

COMMENT ON TABLE seller_seller_match_contacts IS 'マッチング機能: 売主(買いたい側)×売主(売りたい側)ペアごとの連絡状況';
COMMENT ON COLUMN seller_seller_match_contacts.buyer_seller_id IS 'sellers.id への参照（買いたい意図を持つ売主）';
COMMENT ON COLUMN seller_seller_match_contacts.seller_seller_id IS 'sellers.id への参照（マッチした売却中の売主）';
COMMENT ON COLUMN seller_seller_match_contacts.contact_status IS '連絡済み/連絡不要/連絡未';
