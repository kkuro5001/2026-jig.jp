import Hls from "hls.js";

const HLS_SERVER_BASE = "https://intern-hls-server.tomaton.workers.dev";

// URLの ?ch=<id> があればそのチャンネルのプレイリストを、無ければデフォルトチャンネルを再生する
const channelId = new URLSearchParams(location.search).get("ch");
const STREAM_URL = channelId
  ? `${HLS_SERVER_BASE}/ch/${encodeURIComponent(channelId)}/stream.m3u8`
  : `${HLS_SERVER_BASE}/stream.m3u8`;

// ヘッダーの検索窓: この画面には配信一覧が無いため、入力してEnterを押すと
// キーワード付きでチャンネル一覧画面に遷移し、そちらで絞り込みを行う
const streamSearch = document.getElementById("stream-search");
if (streamSearch) {
  streamSearch.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const keyword = streamSearch.value.trim();
    const query = keyword ? `?q=${encodeURIComponent(keyword)}` : "";
    location.href = `/channels.html${query}`;
  });
}

const video = document.getElementById("stream-video");
//ライブの再生
// 一時停止→再開時に、止めていた位置ではなく配信の最新地点(ライブエッジ)から
// 再生を続けられるようにする。getLiveEdgeはHls側/ネイティブHLS側で取得方法が違うため関数で渡す。
function attachLiveResume(video, getLiveEdge) {
  let wasPaused = false;
  video.addEventListener("pause", () => {
    wasPaused = true;
  });
  video.addEventListener("play", () => {
    if (!wasPaused) return;
    wasPaused = false;
    const liveEdge = getLiveEdge();
    if (Number.isFinite(liveEdge)) {
      video.currentTime = liveEdge;
    }
  });
}

if (video) {
  if (Hls.isSupported()) {
    const hls = new Hls({
      // 画質を固定せず、回線状況とプレイヤーの表示サイズに応じて自動選択(ABR)する
      startLevel: -1,
      capLevelToPlayerSize: true,
    });
    hls.loadSource(STREAM_URL);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {
        // 自動再生がブロックされた場合はユーザー操作を待つ
      });
    });

    attachLiveResume(video, () => hls.liveSyncPosition);
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = STREAM_URL;
    video.addEventListener("loadedmetadata", () => {
      video.play().catch(() => {});
    });

    attachLiveResume(video, () =>
      video.seekable.length
        ? video.seekable.end(video.seekable.length - 1)
        : NaN
    );
  }
}
