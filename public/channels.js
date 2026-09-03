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

// 1件分のチャンネルをカード(li要素)として組み立てる
function createChannelItem(channel) {
  const item = document.createElement("li");
  item.className = "channel-item";

  const link = document.createElement("a");
  link.className = "channel-link";
  link.href = `/index.html?ch=${encodeURIComponent(channel.id)}`;

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

  if (channel.default) {
    const badge = document.createElement("span");
    badge.className = "channel-default-badge";
    badge.textContent = "デフォルト";
    link.appendChild(badge);
  }

  item.appendChild(link);
  return item;
}

// 一覧をDOMに描画する
function renderChannels() {
  listElement.replaceChildren(...channels.map(createChannelItem));
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
