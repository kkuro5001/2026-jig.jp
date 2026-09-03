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
const commentError = document.querySelector(".comment-error");
const jumpToLatestButton = document.querySelector(".jump-to-latest");

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

// SSE で届いたコメント・アイテムを1件分、コメントリストのDOMに追加する
// data: { id, text, item: { id, name, iconUrl } | null, timestamp }
function addMessage({ text, item }) {
  if (!commentList) return;

  // 追加前に最新コメントまで見ていたかどうかを覚えておく
  const wasAtBottom = isScrolledToBottom();

  const li = document.createElement("li");
  li.className = "comment-item";

  const nameSpan = document.createElement("span");
  nameSpan.className = "comment-name";

  const textP = document.createElement("p");
  textP.className = "comment-text";

  if (item) {
    li.classList.add("comment-item--gift");
    if (typeof item.cost === "number") {
      li.classList.add(getCostColorClass(item.cost));
    }
    // アイテム一覧APIから取得したiconUrlを使ってアイコン画像を表示する
    const iconUrl = itemsById.get(item.id)?.iconUrl ?? item.iconUrl;
    if (iconUrl) {
      const icon = document.createElement("img");
      icon.className = "comment-item-icon";
      icon.src = iconUrl;
      icon.alt = item.name;
      nameSpan.appendChild(icon);
    } else {
      nameSpan.textContent = "🎁";
    }
    // コメントも一緒に送られていれば「アイテム名を贈りました」に続けて表示する
    textP.textContent = text ? `${item.name}を贈りました: ${text}` : `${item.name}を贈りました`;
  } else {
    nameSpan.textContent = "視聴者";
    textP.textContent = text;
  }

  li.append(nameSpan, textP);
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
  }
}

if (commentList) {
  commentList.innerHTML = "";

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

// 「最新のコメントへ」ボタン: クリックで一番下までスクロールする
jumpToLatestButton?.addEventListener("click", scrollToLatest);

// 手動で最新コメントまでスクロールし直したときは、ジャンプボタンを隠す
commentList?.addEventListener("scroll", () => {
  if (isScrolledToBottom() && jumpToLatestButton) {
    jumpToLatestButton.hidden = true;
  }
});
