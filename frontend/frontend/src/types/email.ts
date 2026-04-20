/**
 * メール添付ファイルのペイロード型
 * APIに送信する添付ファイルの形式
 */
export type AttachmentPayload =
  | { id: string; name: string }                                          // Google Drive
  | { id: string; name: string; base64Data: string; mimeType: string }   // ローカルファイル
  | { id: string; name: string; url: string };                           // URL
