# Language

* Always respond to the user in Japanese.
* Use Japanese for explanations and comments unless there is a specific reason to use another language.

# Code Comments

* 関数を作成する際は、その関数が何をするのか分かるように説明コメントを付けること。
* コメントは原則として日本語で記述すること。

# Tech Stack

* Vite(開発サーバーのみ。`npm run start` で `public/` を配信。ビルド設定・バンドル成果物は無し)。
* プレーンな JavaScript(TypeScript・フレームワーク不使用)。DOM操作は素のDOM API(`querySelector`/`createElement`)を直接使う。
* 動画配信の再生には `hls.js` を使用。
* コメント・アイテム機能のサーバー(REST + SSE)は `intern-comment-server.deno.net` など、このリポジトリ外にホストされた外部サービス。`docs/sse/server` はハンズオン用の学習教材であり、本番のサーバー実装ではない。

# Coding Standards

* 実装するファイルは `public/` 配下のみ(HTML/CSS/JS/画像)。
* クラスは使わず、関数とトップレベル変数で実装する(既存コードのスタイルに合わせる)。
* 状態は各JSファイルのトップレベルにモジュールスコープの変数として持たせる(状態管理ライブラリは使わない)。
* テストランナー・リンターは未導入。

# Project-Specific Rules

* サーバーとの通信は「受信はSSE(`EventSource`)、送信は普通のHTTP POST」という非対称な構成。新しい送受信を追加する際もこの形を踏襲する。
* コメント/アイテムのデータ形式はサーバー側で定義されており、このリポジトリ側では変更できない(`id`, `name`, `iconUrl`, `cost`, `group`, `animationUrl` など)。

## Agent skills

### Issue tracker

GitHub Issues(`gh` CLI使用)。See `docs/agents/issue-tracker.md`.

### Domain docs

single-context(ルートに `CONTEXT.md` + `docs/adr/`)。See `docs/agents/domain.md`.
