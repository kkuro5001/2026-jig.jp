// チャンネル一覧画面のロジック。/channels.json を取得し、廃止済みでないチャンネルを一覧表示する。

const CHANNELS_URL = "https://intern-hls-server.tomaton.workers.dev/channels.json";

// 取得したチャンネル一覧(廃止済みを除く)をモジュールスコープの変数として保持する
let channels = [];

// 検索窓に入力中のキーワード(小文字化済み)をモジュールスコープの変数として保持する
let searchKeyword = "";

const listElement = document.querySelector("#channel-list");
const errorElement = document.querySelector("#channel-error");
const noResultElement = document.querySelector("#channel-no-result");
const searchInput = document.querySelector("#channel-search");

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

// 検索キーワードでチャンネルを絞り込む(タイトル・配信者名を対象に部分一致、大文字小文字を区別しない)
function filterChannelsByKeyword(items, keyword) {
  if (!keyword) {
    return items;
  }
  return items.filter((channel) => {
    const title = (channel.title || "").toLowerCase();
    const attribution = (channel.attribution || "").toLowerCase();
    return title.includes(keyword) || attribution.includes(keyword);
  });
}

// 一覧をジャンルごとに分けてDOMに描画する(検索キーワードによる絞り込みを反映する)
function renderChannels() {
  const filtered = filterChannelsByKeyword(channels, searchKeyword);
  const groups = groupChannelsByCategory(filtered);
  const sections = [...groups.entries()].map(([category, items]) =>
    createCategorySection(category, items)
  );
  listElement.replaceChildren(...sections);
  noResultElement.hidden = filtered.length !== 0;
}

// エラーメッセージを表示する
function showError(message) {
  errorElement.textContent = message;
  errorElement.hidden = false;
}

// 検索窓への入力を検知し、キーワードを更新して再描画する
searchInput.addEventListener("input", () => {
  searchKeyword = searchInput.value.trim().toLowerCase();
  renderChannels();
});

// 視聴画面の検索窓から遷移してきた場合、URLの ?q=<keyword> を検索窓に反映する
function applyKeywordFromUrl() {
  const query = new URLSearchParams(location.search).get("q");
  if (!query) return;
  searchInput.value = query;
  searchKeyword = query.trim().toLowerCase();
}

async function init() {
  try {
    applyKeywordFromUrl();
    await fetchChannels();
    renderChannels();
  } catch (error) {
    showError("チャンネル一覧を取得できませんでした。時間をおいて再度お試しください。");
    console.error(error);
  }
}

init();
