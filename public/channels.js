// チャンネル一覧画面のロジック。/channels.json を取得し、廃止済みでないチャンネルを一覧表示する。

const CHANNELS_URL = "https://intern-hls-server.tomaton.workers.dev/channels.json";

// 取得したチャンネル一覧(廃止済みを除く)をモジュールスコープの変数として保持する
let channels = [];

const listElement = document.querySelector("#channel-list");
const errorElement = document.querySelector("#channel-error");

// チャンネル一覧を取得し、廃止済み(retired: true)のチャンネルを除外して保持する
async function fetchChannels() {
  const res = await fetch(CHANNELS_URL);
  if (!res.ok) {
    throw new Error(`チャンネル一覧の取得に失敗しました (status: ${res.status})`);
  }
  const data = await res.json();
  channels = data.filter((channel) => !channel.retired);
}

// 1件分のチャンネルを、四角いサムネイル風のカード(li要素)として組み立てる
function createChannelItem(channel) {
  const item = document.createElement("li");
  item.className = "channel-item";

  const link = document.createElement("a");
  link.className = "channel-link";
  link.href = `/index.html?ch=${encodeURIComponent(channel.id)}`;

  // 配信画面のプレビューを表示する予定の四角い枠(現状は灰色のプレースホルダー)
  const thumbnail = document.createElement("div");
  thumbnail.className = "channel-thumbnail";
  link.appendChild(thumbnail);

  const title = document.createElement("h2");
  title.className = "channel-title";
  title.textContent = channel.title;
  link.appendChild(title);

  if (channel.attribution) {
    const attribution = document.createElement("p");
    attribution.className = "channel-attribution";
    attribution.textContent = channel.attribution;
    link.appendChild(attribution);
  }

  item.appendChild(link);
  return item;
}

// チャンネル一覧をジャンル(category)ごとにグループ化する。ジャンルはデータに登場した順番を維持する
function groupChannelsByCategory(items) {
  const groups = new Map();
  for (const channel of items) {
    const category = channel.category || "その他";
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category).push(channel);
  }
  return groups;
}

// 1ジャンル分のセクション(見出し + チャンネル一覧)を組み立てる
function createCategorySection(category, items) {
  const section = document.createElement("section");
  section.className = "channel-group";

  const heading = document.createElement("h2");
  heading.className = "channel-group-title";
  heading.textContent = category;
  section.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "channel-list";
  list.replaceChildren(...items.map(createChannelItem));
  section.appendChild(list);

  return section;
}

// 一覧をジャンルごとに分けてDOMに描画する
function renderChannels() {
  const groups = groupChannelsByCategory(channels);
  const sections = [...groups.entries()].map(([category, items]) =>
    createCategorySection(category, items)
  );
  listElement.replaceChildren(...sections);
}

// エラーメッセージを表示する
function showError(message) {
  errorElement.textContent = message;
  errorElement.hidden = false;
}

async function init() {
  try {
    await fetchChannels();
    renderChannels();
  } catch (error) {
    showError("チャンネル一覧を取得できませんでした。時間をおいて再度お試しください。");
    console.error(error);
  }
}

init();
