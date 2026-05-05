# スクレイピングサーバー自動起動設定

## 方法1: バッチファイルで起動（最も簡単）

### 手順

1. **`start_scrape_server_background.bat`をダブルクリック**
   - スクレイピングサーバーがバックグラウンドで起動します
   - 最小化されたウィンドウで実行されます

2. **停止する場合**
   - `stop_scrape_server.bat`をダブルクリック

3. **Windows起動時に自動起動する場合**
   - `start_scrape_server_background.bat`のショートカットを作成
   - ショートカットを以下のフォルダに移動：
     ```
     C:\Users\kunih\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
     ```
   - または、`Win + R` → `shell:startup` → ショートカットを貼り付け

---

## 方法2: Windowsサービスとして登録（最も推奨）

### 利点
- Windows起動時に自動起動
- バックグラウンドで常時稼働
- ログオフしても動作し続ける

### 手順

1. **NSSMをダウンロード**
   - https://nssm.cc/download
   - `nssm.exe`をこのフォルダに配置

2. **管理者権限でコマンドプロンプトを開く**
   - `Win + X` → 「ターミナル（管理者）」

3. **サービスをインストール**
   ```cmd
   cd C:\Users\kunih\sateituikyaku-admin
   install_scrape_service.bat
   ```

4. **サービスを開始**
   ```cmd
   net start ScrapeServer
   ```

5. **サービスの状態を確認**
   ```cmd
   sc query ScrapeServer
   ```

### サービスの管理

- **開始**: `net start ScrapeServer`
- **停止**: `net stop ScrapeServer`
- **削除**: `nssm remove ScrapeServer confirm`

---

## 方法3: タスクスケジューラで自動起動

### 手順

1. **タスクスケジューラを開く**
   - `Win + R` → `taskschd.msc`

2. **新しいタスクを作成**
   - 「操作」→「基本タスクの作成」
   - 名前: `スクレイピングサーバー自動起動`

3. **トリガー**
   - 「コンピューターの起動時」を選択

4. **操作**
   - 「プログラムの開始」を選択
   - プログラム: `C:\Users\kunih\sateituikyaku-admin\start_scrape_server_background.bat`

5. **完了**

---

## 現在の状態を確認

### スクレイピングサーバーが起動しているか確認

```powershell
# PowerShellで確認
Invoke-WebRequest -Uri http://localhost:8765/health -UseBasicParsing
```

または

```cmd
# コマンドプロンプトで確認
curl http://localhost:8765/health
```

**期待される結果**: `{"status": "ok"}`

---

## トラブルシューティング

### ポート8765が既に使用されている

```powershell
# ポート8765を使用しているプロセスを確認
netstat -ano | findstr :8765

# プロセスを終了（PIDを確認してから）
taskkill /PID <PID> /F
```

### Pythonが見つからない

```powershell
# Pythonのパスを確認
where python
```

Pythonがインストールされていない場合は、https://www.python.org/ からインストールしてください。

---

## 推奨設定

**開発環境（ローカル）**:
- 方法1（バッチファイル）または方法3（タスクスケジューラ）

**本番環境（常時稼働が必要）**:
- 方法2（Windowsサービス）

---

**最終更新日**: 2026年5月6日
