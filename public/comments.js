const SERVER_URL = "https://intern-comment-server.intern-comment-server.deno.net";
const MAX_COMMENT_LENGTH = 200;

const ITEM_EMOJIS = {
  heart: "❤️",
  star: "⭐",
  flower: "🌸",
};

const commentList = document.querySelector(".comment-list");
const commentForm = document.querySelector(".comment-form");
const commentInput = document.querySelector(".comment-input");
const itemButtons = document.querySelectorAll(".item-button");
const commentError = document.querySelector(".comment-error");

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

  const li = document.createElement("li");
  li.className = "comment-item";

  const nameSpan = document.createElement("span");
  nameSpan.className = "comment-name";

  const textP = document.createElement("p");
  textP.className = "comment-text";

  if (item) {
    li.classList.add("comment-item--gift");
    nameSpan.textContent = ITEM_EMOJIS[item.id] ?? "🎁";
    textP.textContent = `${item.name}を贈りました`;
  } else {
    nameSpan.textContent = "視聴者";
    textP.textContent = text;
  }

  li.append(nameSpan, textP);
  commentList.appendChild(li);
  commentList.scrollTop = commentList.scrollHeight;
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

// フォーム送信時: 入力値を検証してからコメントを送信する
commentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = commentInput.value.trim();

  if (!text) {
    showCommentError("コメントを入力してください");
    return;
  }
  if (text.length > MAX_COMMENT_LENGTH) {
    showCommentError(`コメントは${MAX_COMMENT_LENGTH}字以内で入力してください`);
    return;
  }

  clearCommentError();
  commentInput.value = "";
  resizeCommentInput();
  await postMessage({ text });
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

// アイテムボタン(❤️/⭐/🌸)をクリックしたらそのアイテムを送信する
itemButtons.forEach((button) => {
  const itemId = button.dataset.itemId;
  if (!itemId) return;

  button.addEventListener("click", async () => {
    await postMessage({ itemId });
  });
});
