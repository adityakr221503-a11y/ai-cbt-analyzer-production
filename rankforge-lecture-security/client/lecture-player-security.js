/*
 Frontend contract only.
 The frontend requests authorized playback.
 It must NOT contain a permanent media URL or signing secret.
*/

async function requestLecturePlayback(lectureId) {
  if (!lectureId) {
    throw new Error("LECTURE_ID_REQUIRED");
  }

  const response = await fetch("/api/lectures/" + encodeURIComponent(lectureId) + "/play", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("LECTURE_ACCESS_DENIED");
  }

  return response.json();
}

function applyWatermark(playerContainer, identity) {
  if (!playerContainer || !identity) return;

  const watermark = document.createElement("div");
  watermark.textContent =
    String(identity).slice(0, 80) + " • RankForge";

  watermark.style.position = "absolute";
  watermark.style.right = "12px";
  watermark.style.bottom = "12px";
  watermark.style.opacity = "0.65";
  watermark.style.pointerEvents = "none";
  watermark.style.fontSize = "12px";

  playerContainer.style.position = "relative";
  playerContainer.appendChild(watermark);
}

window.RankForgeLectureSecurity = {
  requestLecturePlayback,
  applyWatermark
};
