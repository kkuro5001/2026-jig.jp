const SERVER_URL = "https://intern-comment-server.intern-comment-server.deno.net";

const ITEM_EMOJIS = {
  heart: "❤️",
  star: "⭐",
  flower: "🌸",
};

const commentList = document.querySelector(".comment-list");
const commentForm = document.querySelector(".comment-form");
const commentInput = document.querySelector(".comment-input");
const itemButtons = document.querySelectorAll(".item-button");

// SSE で届く1件: { id, text, item: { id, name, iconUrl } | null, timestamp }
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

commentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = commentInput.value.trim();
  if (!text) return;

  commentInput.value = "";
  await postMessage({ text });
});

itemButtons.forEach((button) => {
  const itemId = button.dataset.itemId;
  if (!itemId) return;

  button.addEventListener("click", async () => {
    await postMessage({ itemId });
  });
});
