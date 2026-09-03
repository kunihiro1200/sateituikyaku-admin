import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { decrypt } from '../utils/encryption';
import { TokiExtractService } from './TokiExtractService';

/**
 * 不動産相談チャットアプリ（Consult App）のサービス層。
 *
 * 売主管理システム（backend/src/、ポート3000）に属する。
 * sellers テーブルへの参照は既存の SellerService と同じテーブル・暗号化方式に準拠する
 * （seller-search-and-hash-integrity-rules / seller-table-column-definition ルール準拠）。
 */

export interface VerifyResult {
  sellerId: string;
  sellerNumber: string;
  propertyAddress: string | null;
  maskedName: string | null;
  sessionToken: string;
}

export interface KnownFact {
  value: any;
  confirmedAt: string;
  source: 'chat' | 'toki';
}

export interface ConsultProfile {
  sellerId: string;
  sellerNumber: string;
  ownerName: string | null;
  ownerAddress: string | null;
  acquisitionDate: string | null;
  coOwners: any[];
  hasMortgage: boolean | null;
  knownFacts: Record<string, KnownFact>;
}

export class ConsultService {
  private supabase: SupabaseClient;
  private tokiExtractService: TokiExtractService;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    this.tokiExtractService = new TokiExtractService();
  }

  // ============================================================
  // 本人確認
  // ============================================================

  /**
   * 氏名の一部マスク（表示用）。姓のみ表示し、以降は「様」のみとする。
   * 例: 「山田太郎」→「山田 様」
   */
  private maskName(name: string | null): string | null {
    if (!name) return null;
    const trimmed = name.trim();
    if (trimmed.length <= 1) return `${trimmed} 様`;
    // 姓と名の区切り（スペース）がある場合は姓のみ
    const parts = trimmed.split(/[\s　]+/);
    if (parts.length > 1) return `${parts[0]} 様`;
    // 区切りがない場合は先頭1文字のみ表示
    return `${trimmed.charAt(0)}** 様`;
  }

  /**
   * 売主番号または電話番号で本人確認を行い、セッショントークンを発行する。
   */
  async verify(params: { sellerNumber?: string; phoneNumber?: string }): Promise<VerifyResult | null> {
    const { sellerNumber, phoneNumber } = params;

    let sellerRow: any = null;

    if (sellerNumber) {
      const { data } = await this.supabase
        .from('sellers')
        .select('id, seller_number, name, property_address, deleted_at')
        .eq('seller_number', sellerNumber.trim())
        .is('deleted_at', null)
        .single();
      sellerRow = data ?? null;
    } else if (phoneNumber) {
      const normalized = phoneNumber.replace(/[-\s\u3000]/g, '');
      if (!/^\d{7,}$/.test(normalized)) {
        return null; // 電話番号として扱えない入力
      }
      const phoneHash = crypto.createHash('sha256').update(normalized).digest('hex');
      const { data } = await this.supabase
        .from('sellers')
        .select('id, seller_number, name, property_address, deleted_at')
        .eq('phone_number_hash', phoneHash)
        .is('deleted_at', null)
        .single();
      sellerRow = data ?? null;
    } else {
      return null;
    }

    if (!sellerRow) return null;

    const decryptedName = sellerRow.name ? decrypt(sellerRow.name) : null;

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const verifiedBy = sellerNumber ? 'seller_number' : 'phone_number';

    const { error: insertError } = await this.supabase
      .from('consult_sessions')
      .insert({
        seller_id: sellerRow.id,
        seller_number: sellerRow.seller_number,
        session_token: sessionToken,
        verified_by: verifiedBy,
      });

    if (insertError) {
      throw new Error(`セッション作成に失敗しました: ${insertError.message}`);
    }

    return {
      sellerId: sellerRow.id,
      sellerNumber: sellerRow.seller_number,
      propertyAddress: sellerRow.property_address ?? null,
      maskedName: this.maskName(decryptedName),
      sessionToken,
    };
  }

  /**
   * セッショントークンから売主を特定する（端末保存トークンでの自動ログイン用）。
   */
  async resolveSession(sessionToken: string): Promise<{ sellerId: string; sellerNumber: string } | null> {
    const { data, error } = await this.supabase
      .from('consult_sessions')
      .select('seller_id, seller_number, revoked_at, expires_at')
      .eq('session_token', sessionToken)
      .single();

    if (error || !data) return null;
    if (data.revoked_at) return null;
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

    // 最終利用日時を更新（失敗しても致命的ではないので待たない）
    this.supabase
      .from('consult_sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('session_token', sessionToken)
      .then(() => {});

    return { sellerId: data.seller_id, sellerNumber: data.seller_number };
  }

  // ============================================================
  // ユーザープロフィール（謄本情報・既知の事実の蓄積）
  // ============================================================

  async getOrCreateProfile(sellerId: string, sellerNumber: string): Promise<ConsultProfile> {
    const { data } = await this.supabase
      .from('consult_user_profile')
      .select('*')
      .eq('seller_id', sellerId)
      .single();

    if (data) {
      return {
        sellerId: data.seller_id,
        sellerNumber: data.seller_number,
        ownerName: data.owner_name,
        ownerAddress: data.owner_address,
        acquisitionDate: data.acquisition_date,
        coOwners: data.co_owners ?? [],
        hasMortgage: data.has_mortgage,
        knownFacts: data.known_facts ?? {},
      };
    }

    // 存在しない場合は空のプロフィールを作成
    const { data: created, error } = await this.supabase
      .from('consult_user_profile')
      .insert({ seller_id: sellerId, seller_number: sellerNumber })
      .select('*')
      .single();

    if (error) throw new Error(`プロフィール作成に失敗しました: ${error.message}`);

    return {
      sellerId: created.seller_id,
      sellerNumber: created.seller_number,
      ownerName: created.owner_name,
      ownerAddress: created.owner_address,
      acquisitionDate: created.acquisition_date,
      coOwners: created.co_owners ?? [],
      hasMortgage: created.has_mortgage,
      knownFacts: created.known_facts ?? {},
    };
  }

  /**
   * 謄本写メ（複数枚）を読み取り、プロフィールに反映する。
   * 抽出ロジックは既存の TokiExtractService.extractFromImages をそのまま利用し、
   * sanitizeOwnerInfo によるサニタイズも既存実装のまま適用される。
   */
  async extractAndSaveToki(
    sellerId: string,
    sellerNumber: string,
    files: Array<{ name: string; mimeType: string; base64: string }>
  ): Promise<ConsultProfile> {
    const extractResult = await this.tokiExtractService.extractFromImages(files);

    const acquisitionDate = this.parseAcquisitionDate(extractResult.constructionDate);

    const updatePayload: Record<string, any> = {
      seller_id: sellerId,
      seller_number: sellerNumber,
      owner_name: extractResult.ownerName,
      owner_address: extractResult.ownerAddress,
      co_owners: extractResult.coOwners ? [extractResult.coOwners] : [],
      toki_raw_extract: extractResult,
      toki_extracted_at: new Date().toISOString(),
    };
    if (acquisitionDate) updatePayload.acquisition_date = acquisitionDate;

    const { data, error } = await this.supabase
      .from('consult_user_profile')
      .upsert(updatePayload, { onConflict: 'seller_id' })
      .select('*')
      .single();

    if (error) throw new Error(`謄本情報の保存に失敗しました: ${error.message}`);

    return {
      sellerId: data.seller_id,
      sellerNumber: data.seller_number,
      ownerName: data.owner_name,
      ownerAddress: data.owner_address,
      acquisitionDate: data.acquisition_date,
      coOwners: data.co_owners ?? [],
      hasMortgage: data.has_mortgage,
      knownFacts: data.known_facts ?? {},
    };
  }

  private parseAcquisitionDate(dateStr: string | null): string | null {
    if (!dateStr) return null;
    // "2009-02-26" 形式を想定（既存プロンプトが西暦YYYY-MM-DDへ変換済み）
    const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
  }

  /**
   * チャットで判明した事実を known_facts に追加保存する（二度聞き防止）。
   */
  async updateKnownFacts(sellerId: string, facts: Record<string, any>): Promise<void> {
    const { data } = await this.supabase
      .from('consult_user_profile')
      .select('known_facts')
      .eq('seller_id', sellerId)
      .single();

    const existing = data?.known_facts ?? {};
    const now = new Date().toISOString();
    const merged = { ...existing };
    for (const [key, value] of Object.entries(facts)) {
      merged[key] = { value, confirmedAt: now, source: 'chat' };
    }

    const { error } = await this.supabase
      .from('consult_user_profile')
      .update({ known_facts: merged })
      .eq('seller_id', sellerId);

    if (error) throw new Error(`既知情報の更新に失敗しました: ${error.message}`);
  }

  // ============================================================
  // 会話・メッセージログ
  // ============================================================

  async startConversation(sellerId: string, sellerNumber: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('consult_conversations')
      .insert({ seller_id: sellerId, seller_number: sellerNumber })
      .select('id')
      .single();

    if (error) throw new Error(`会話の作成に失敗しました: ${error.message}`);
    return data.id;
  }

  async saveMessage(params: {
    conversationId: string;
    sellerNumber: string;
    role: 'user' | 'assistant';
    content: string;
    themeTag?: string | null;
    answerSource?: 'knowledge_base' | 'llm_general' | 'unanswered' | null;
    llmConfidence?: 'high' | 'low' | null;
  }): Promise<void> {
    const { error } = await this.supabase.from('consult_messages').insert({
      conversation_id: params.conversationId,
      seller_number: params.sellerNumber,
      role: params.role,
      content: params.content,
      theme_tag: params.themeTag ?? null,
      answer_source: params.answerSource ?? null,
      llm_confidence: params.llmConfidence ?? null,
    });

    if (error) throw new Error(`メッセージの保存に失敗しました: ${error.message}`);
  }

  async getConversationHistory(conversationId: string): Promise<Array<{ role: string; content: string }>> {
    const { data, error } = await this.supabase
      .from('consult_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`会話履歴の取得に失敗しました: ${error.message}`);
    return data ?? [];
  }

  // ============================================================
  // LLM呼び出し（回答生成＋テーマ分類をまとめて行う）
  // ============================================================

  /**
   * ユーザーの質問に対して、既知プロフィールをコンテキストとして回答を生成する。
   * ナレッジベース（層1）は今後 knowledge/ 配下のJSONを読み込んで拡張する想定。
   * 現状は最初のテーマ未実装のため、LLM一般知識＋免責を返す設計（暫定）。
   */
  async generateReply(params: {
    profile: ConsultProfile;
    userMessage: string;
    history: Array<{ role: string; content: string }>;
  }): Promise<{ reply: string; themeTag: string | null; answerSource: 'knowledge_base' | 'llm_general' | 'unanswered'; confidence: 'high' | 'low' }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません');

    const client = new Anthropic({ apiKey });

    const knownFactsText = Object.entries(params.profile.knownFacts)
      .map(([key, fact]) => `- ${key}: ${JSON.stringify(fact.value)}（確認日: ${fact.confirmedAt}）`)
      .join('\n') || '（まだ確認済みの情報はありません）';

    const systemPrompt = `あなたは不動産の相談に答えるアシスタントです。売主本人からの質問に、選択肢を用いた分岐会話または自由回答で答えます。

【このユーザーの既知情報（再度質問しないこと）】
- 所有者名: ${params.profile.ownerName ?? '不明'}
- 所有者住所: ${params.profile.ownerAddress ?? '不明'}
- 取得日（謄本より）: ${params.profile.acquisitionDate ?? '不明'}
- 共有者: ${JSON.stringify(params.profile.coOwners)}
${knownFactsText}

【回答方針】
- 上記の既知情報は前提として使い、再度質問しないこと
- 断定的な数字や制度の要件を答える場合、根拠法令や条件を明示すること
- 自信を持って正確に答えられない内容の場合は、その旨を明示し、専門家への確認を促すこと
- 出力は必ず次のJSON形式のみで返すこと（説明文・コードブロック記号は不要）:
{
  "reply": "ユーザーへの回答文",
  "theme_tag": "該当する制度テーマの識別子（例: juuto_3000man_kojo, chuukai_tesuryou）。該当なしなら null",
  "answer_source": "knowledge_base または llm_general または unanswered",
  "confidence": "high または low"
}`;

    const messages: Anthropic.MessageParam[] = [
      ...params.history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: params.userMessage },
    ];

    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      // 拡張思考（thinking）を明示的に無効化する。
      // 有効時は content[0] が thinking ブロックになり、実テキストは content[1] 以降に入るため
      // 「content[0] が text か」だけを見るコードでは空文字が返ってしまう。応答時間も長くなるため無効化する。
      thinking: { type: 'disabled' },
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const text = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { reply: text || '回答を生成できませんでした。', themeTag: null, answerSource: 'unanswered', confidence: 'low' };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        reply: parsed.reply ?? '回答を生成できませんでした。',
        themeTag: parsed.theme_tag ?? null,
        answerSource: (parsed.answer_source ?? 'llm_general') as any,
        confidence: (parsed.confidence ?? 'low') as any,
      };
    } catch {
      return { reply: text, themeTag: null, answerSource: 'unanswered', confidence: 'low' };
    }
  }

  // ============================================================
  // 統計・管理画面向け集計
  // ============================================================

  async getThemeStats(days: number = 30): Promise<Array<{ themeTag: string | null; count: number }>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await this.supabase
      .from('consult_messages')
      .select('theme_tag')
      .eq('role', 'user')
      .gte('created_at', since.toISOString());

    if (error) throw new Error(`統計取得に失敗しました: ${error.message}`);

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const key = row.theme_tag ?? '未分類';
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return Object.entries(counts)
      .map(([themeTag, count]) => ({ themeTag, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getUnansweredQuestions(limit: number = 100): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('consult_messages')
      .select('id, seller_number, content, created_at')
      .eq('role', 'user')
      .eq('answer_source', 'unanswered')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`未回答質問の取得に失敗しました: ${error.message}`);
    return data ?? [];
  }

  async getConversationsBySellerNumber(sellerNumber: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('consult_messages')
      .select('id, role, content, theme_tag, answer_source, created_at, conversation_id')
      .eq('seller_number', sellerNumber)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`会話履歴の取得に失敗しました: ${error.message}`);
    return data ?? [];
  }
}
