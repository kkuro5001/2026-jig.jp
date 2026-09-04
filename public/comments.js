const SERVER_URL = "https://intern-comment-server.intern-comment-server.deno.net";
const MAX_COMMENT_LENGTH = 200;

// サーバーから取得したアイテム一覧をidで引けるようにしたもの({ id, name, iconUrl, cost }のMap)
const itemsById = new Map();

// アイテムのコスト(10〜1000)に応じた色クラス名を返す
function getCostColorClass(cost) {
  if (cost <= 300) return "cost-cyan";
  if (cost <= 500) return "cost-green";
  if (cost <= 700) return "cost-orange";
  if (cost <= 999) return "cost-magenta";
  return "cost-red";
}

// 現在選択中のアイテムid(未選択ならnull)
let selectedItemId = null;

const commentList = document.querySelector(".comment-list");
const commentForm = document.querySelector(".comment-form");
const commentInput = document.querySelector(".comment-input");
const itemRow = document.querySelector(".item-row");
const itemToggle = document.querySelector(".item-toggle");
const itemIconToggle = document.querySelector(".item-icon-toggle");
const commentError = document.querySelector(".comment-error");
const jumpToLatestButton = document.querySelector(".jump-to-latest");
const itemEffectLayer = document.querySelector(".item-effect-layer");

// アイテム演出(アニメーション画像)を1件表示しておく時間(ミリ秒)
const ITEM_EFFECT_DURATION_MS = 3000;

// 再生待ちの演出用animationUrlを溜めておくキュー
const itemEffectQueue = [];
let isPlayingItemEffect = false;

// 自分がこれから送信するアイテムidを送信前に積んでおくキュー(他の視聴者の送信では演出を出さないため)。
// サーバーへの送信リクエストが完了するより先にSSEで通知が届くことがあるため、
// レスポンス待ちにせず送信操作の直後(通信前)に積む。
const pendingOwnItemIds = [];

// pendingOwnItemIdsに指定のアイテムidがあれば1件分消費してtrueを返す(無ければfalse)
function consumePendingOwnItem(itemId) {
  const index = pendingOwnItemIds.indexOf(itemId);
  if (index === -1) return false;
  pendingOwnItemIds.splice(index, 1);
  return true;
}

// キューの先頭から演出画像を1件取り出し、映像エリアに表示する。表示し終わったら次を再生する
function playNextItemEffect() {
  if (!itemEffectLayer || itemEffectQueue.length === 0) {
    isPlayingItemEffect = false;
    return;
  }
  isPlayingItemEffect = true;

  const animationUrl = itemEffectQueue.shift();
  const img = document.createElement("img");
  img.className = "item-effect-image";
  img.src = animationUrl;
  itemEffectLayer.appendChild(img);

  setTimeout(() => {
    img.remove();
    playNextItemEffect();
  }, ITEM_EFFECT_DURATION_MS);
}

// アイテム送信時の演出をキューに追加する(演出用animationUrlが無いアイテムは無視する)
function enqueueItemEffect(animationUrl) {
  if (!animationUrl) return;
  itemEffectQueue.push(animationUrl);
  if (!isPlayingItemEffect) {
    playNextItemEffect();
  }
}

// スクロール位置が最新コメント付近と見なせる誤差(px)
const BOTTOM_THRESHOLD = 24;

// コメントリストが最新コメントまでスクロールされているかを判定する
function isScrolledToBottom() {
  if (!commentList) return true;
  return (
    commentList.scrollHeight - commentList.scrollTop - commentList.clientHeight <=
    BOTTOM_THRESHOLD
  );
}

// コメントリストを最新コメントまでスクロールし、ジャンプボタンを隠す
function scrollToLatest() {
  if (!commentList) return;
  commentList.scrollTop = commentList.scrollHeight;
  if (jumpToLatestButton) jumpToLatestButton.hidden = true;
}

// 入力エラーのメッセージを表示する
function showCommentError(message) {
  if (!commentError) return;
  commentError.textContent = message;
  commentError.hidden = false;
}

// 表示中の入力エラーメッセージを隠す
function clearCommentError() {
  if (!commentError) return;
  commentError.hidden = true;
}

// ISO 8601形式のタイムスタンプを「時:分:秒」の表示用文字列に変換する
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// SSE で届いたコメント・アイテムを1件分、コメントリストのDOMに追加する
// data: { id, text, item: { id, name, iconUrl } | null, timestamp }
function addMessage({ text, item, timestamp }) {
  if (!commentList) return;

  // 追加前に最新コメントまで見ていたかどうかを覚えておく
  const wasAtBottom = isScrolledToBottom();

  const li = document.createElement("li");
  li.className = "comment-item";

  const timeSpan = document.createElement("span");
  timeSpan.className = "comment-time";
  timeSpan.textContent = formatTimestamp(timestamp);

  // 送信者名を表す実データが無いため、常に「視聴者」を表示する
  const nameSpan = document.createElement("span");
  nameSpan.className = "comment-name";
  nameSpan.textContent = "視聴者";

  const giftTextSpan = document.createElement("span");
  giftTextSpan.className = "comment-gift-text";

  const textP = document.createElement("p");
  textP.className = "comment-text";

  if (item) {
    li.classList.add("comment-item--gift");
    if (!text) {
      li.classList.add("comment-item--gift-only");
    }
    if (typeof item.cost === "number") {
      li.classList.add(getCostColorClass(item.cost));
    }
    // アイテム一覧APIから取得したiconUrl・animationUrlを使う
    const knownItem = itemsById.get(item.id);
    const iconUrl = knownItem?.iconUrl ?? item.iconUrl;
    // 演出は自分が送信したアイテムのときだけ再生する
    if (consumePendingOwnItem(item.id)) {
      enqueueItemEffect(knownItem?.animationUrl);
    }
    if (iconUrl) {
      const icon = document.createElement("img");
      icon.className = "comment-item-icon";
      icon.src = iconUrl;
      icon.alt = item.name;
      giftTextSpan.appendChild(icon);
    } else {
      giftTextSpan.append("🎁 ");
    }
    // 「アイテム名を贈りました」の告知文と、実際に打ち込んだコメント文を分けて持たせる
    // (アイテム表示を消したときに告知文だけ隠し、コメント文は残せるようにするため)
    giftTextSpan.append(`${item.name}を贈りました`);
    textP.textContent = text ?? "";
  } else {
    textP.textContent = text;
  }

  li.append(timeSpan, nameSpan, giftTextSpan, textP);
  commentList.appendChild(li);

  // 元々最新コメントを見ていた場合だけ自動で追従させる。
  // 遡って読んでいた場合は位置を保ち、代わりにジャンプボタンを表示する。
  if (wasAtBottom) {
    scrollToLatest();
  } else if (jumpToLatestButton) {
    jumpToLatestButton.hidden = false;
  }
}

// アイテム一覧をサーバーから取得し、id, name, iconUrlをitemsByIdに保持する
async function fetchItems() {
  const res = await fetch(`${SERVER_URL}/items`);
  if (!res.ok) {
    console.error("アイテム一覧の取得に失敗しました", res.status, await res.text());
    return [];
  }
  const { items } = await res.json();
  itemsById.clear();
  for (const item of items) {
    itemsById.set(item.id, item);
  }
  return items;
}

// アイテムの選択状態を切り替える(同じボタンをもう一度押すと選択解除)
function toggleItemSelection(button, itemId) {
  const alreadySelected = selectedItemId === itemId;
  for (const other of itemRow.querySelectorAll(".item-button")) {
    other.classList.remove("selected");
  }
  selectedItemId = alreadySelected ? null : itemId;
  if (!alreadySelected) button.classList.add("selected");
}

// 取得したアイテム一覧をもとに、アイテム送信ボタンをDOMに描画する
function renderItemButtons(items) {
  if (!itemRow) return;
  itemRow.innerHTML = "";

  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "item-button";
    if (item.id === selectedItemId) button.classList.add("selected");
    button.dataset.itemId = item.id;
    button.title = typeof item.cost === "number" ? `${item.name} (${item.cost})` : item.name;
    if (typeof item.cost === "number") {
      button.classList.add(getCostColorClass(item.cost));
    }

    const icon = document.createElement("img");
    icon.className = "item-button-icon";
    icon.src = item.iconUrl;
    icon.alt = item.name;
    button.appendChild(icon);

    // クリックでアイテムを選択/選択解除する(実際の送信はコメント欄の送信時に行う)
    button.addEventListener("click", () => {
      toggleItemSelection(button, item.id);
    });

    itemRow.appendChild(button);
  }
}

// コメント/アイテムのデータをJSONに変換してサーバーへPOST送信する
async function postMessage(body) {
  const res = await fetch(`${SERVER_URL}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("メッセージの送信に失敗しました", res.status, await res.text());
    // 送信に失敗した分は演出も起きないので、積んでおいたアイテムidを取り消す
    if (body.itemId) consumePendingOwnItem(body.itemId);
  }
}

if (commentList) {
  commentList.innerHTML = "";

  // アイテム表示欄を開いていなくても演出を再生できるよう、先にアイテム一覧を取得しておく
  fetchItems();

  const eventSource = new EventSource(`${SERVER_URL}/events`);
  eventSource.onmessage = (event) => {
    try {
      addMessage(JSON.parse(event.data));
    } catch {
      // JSON以外のデータ（接続確認など）は無視する
    }
  };
}

// 入力内容の量に合わせて入力欄の高さを再計算する(改行してもコメント全体が見えるように)
function resizeCommentInput() {
  if (!commentInput) return;
  commentInput.style.height = "auto";
  commentInput.style.height = `${commentInput.scrollHeight}px`;
}

// 選択中のアイテムをボタンの見た目・状態ともに解除する
function clearItemSelection() {
  if (itemRow) {
    for (const button of itemRow.querySelectorAll(".item-button")) {
      button.classList.remove("selected");
    }
  }
  selectedItemId = null;
}

// フォーム送信時: コメント・選択中アイテムを検証し、両方またはどちらか一方を送信する
commentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = commentInput.value.trim();

  if (!text && !selectedItemId) {
    showCommentError("コメントを入力するか、アイテムを選択してください");
    return;
  }
  if (text.length > MAX_COMMENT_LENGTH) {
    showCommentError(`コメントは${MAX_COMMENT_LENGTH}字以内で入力してください`);
    return;
  }

  clearCommentError();
  //送信するデータをJSONで作成する
  const body = {
    ...(text && { text }),
    ...(selectedItemId && { itemId: selectedItemId }),
  };

  // 通信より先に、これから自分が送るアイテムidを積んでおく(SSE通知が先に届いても演出を出せるように)
  if (body.itemId) pendingOwnItemIds.push(body.itemId);

  commentInput.value = "";
  resizeCommentInput();
  clearItemSelection();
  await postMessage(body);
});

// Enter単体で送信、Shift+Enterは改行として入力させる(IME変換確定時は無視)
commentInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    commentForm?.requestSubmit();
  }
});

// 入力のたびに欄の高さを調整する
commentInput?.addEventListener("input", resizeCommentInput);

// アイテムアイコンをドラッグ&ドロップした際に画像パスが挿入されないようにする
commentInput?.addEventListener("dragover", (e) => e.preventDefault());
commentInput?.addEventListener("drop", (e) => e.preventDefault());

// トグルボタンでアイテム一覧領域の開閉を切り替える。開くたびに最新のアイテム一覧に更新する
itemToggle?.addEventListener("click", async () => {
  if (!itemRow) return;
  const wasHidden = itemRow.hidden;
  itemRow.hidden = !wasHidden;
  itemToggle.setAttribute("aria-expanded", String(wasHidden));

  if (wasHidden) {
    renderItemButtons(await fetchItems());
  }
});

// ボタンでコメント欄のアイテムアイコン画像と「〜を贈りました」のメッセージの表示/非表示を切り替える
itemIconToggle?.addEventListener("click", () => {
  if (!commentList) return;
  const isPressed = itemIconToggle.getAttribute("aria-pressed") === "true";
  itemIconToggle.setAttribute("aria-pressed", String(!isPressed));
  commentList.classList.toggle("hide-items", isPressed);
});

// 「最新のコメントへ」ボタン: クリックで一番下までスクロールする
jumpToLatestButton?.addEventListener("click", scrollToLatest);

// 手動で最新コメントまでスクロールし直したときは、ジャンプボタンを隠す
commentList?.addEventListener("scroll", () => {
  if (isScrolledToBottom() && jumpToLatestButton) {
    jumpToLatestButton.hidden = true;
  }
});
