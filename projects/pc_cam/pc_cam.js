// PC Cam: browser webcam recorder.
// All recordings stay in this page's memory as Blob objects. Nothing is uploaded.
// Everything is released when the page is closed or left.
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const ui = {
    error: $("pccam-error"),
    preview: $("pccam-preview"),
    start: $("pccam-start"),
    camera: $("pccam-camera"),
    resolution: $("pccam-resolution"),
    audio: $("pccam-audio"),
    photo: $("pccam-photo"),
    record: $("pccam-record"),
    status: $("pccam-status"),
    empty: $("pccam-empty"),
    download: $("pccam-download"),
    discard: $("pccam-discard"),
    clear: $("pccam-clear"),
    clips: $("pccam-clips"),
    playerWrap: $("pccam-player-wrap"),
    playerTitle: $("pccam-player-title"),
    player: $("pccam-player"),
    playerImg: $("pccam-player-img"),
  };
  if (!ui.preview) return;

  let stream = null;
  let recorder = null;
  let chunks = [];
  let recordStart = 0;
  let timer = null;
  let counter = 0;
  // Each item: { id, kind: "video" | "photo", blob, url, thumb, name, keep }
  let items = [];

  function showError(msg) {
    ui.error.textContent = msg;
    ui.error.hidden = !msg;
  }

  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError("Camera access needs a secure (https) page and a modern browser.");
    ui.start.disabled = true;
    return;
  }
  if (typeof MediaRecorder === "undefined") {
    showError("This browser cannot record video. Photos still work.");
  }

  function pickMimeType() {
    const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    if (typeof MediaRecorder === "undefined") return "";
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  }

  function extFor(type) {
    return type.includes("mp4") ? "mp4" : "webm";
  }

  function timestamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  function stopStream() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    ui.preview.srcObject = null;
  }

  async function listCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput");
    const current = stream && stream.getVideoTracks()[0] ? stream.getVideoTracks()[0].getSettings().deviceId : "";
    ui.camera.innerHTML = "";
    cams.forEach((c, i) => {
      const opt = document.createElement("option");
      opt.value = c.deviceId;
      opt.textContent = c.label || `Camera ${i + 1}`;
      if (c.deviceId === current) opt.selected = true;
      ui.camera.appendChild(opt);
    });
  }

  async function startCamera() {
    if (recorder && recorder.state === "recording") return;
    showError("");
    stopStream();
    const [w, h] = ui.resolution.value.split("x").map(Number);
    const video = { width: { ideal: w }, height: { ideal: h } };
    if (ui.camera.value) video.deviceId = { exact: ui.camera.value };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: ui.audio.checked });
    } catch (err) {
      showError(`Could not open the camera: ${err.message || err.name}`);
      setCameraControls(false);
      return;
    }
    ui.preview.srcObject = stream;
    await listCameras();
    const s = stream.getVideoTracks()[0].getSettings();
    ui.status.textContent = s.width ? `Live: ${s.width} × ${s.height}` : "Live";
    ui.start.textContent = "Restart camera";
    setCameraControls(true);
  }

  function setCameraControls(on) {
    ui.camera.disabled = !on;
    ui.resolution.disabled = !on;
    ui.photo.disabled = !on;
    ui.record.disabled = !on || typeof MediaRecorder === "undefined";
  }

  function grabFrame(type, quality) {
    const v = ui.preview;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0);
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  async function takePhoto() {
    if (!stream || !ui.preview.videoWidth) return;
    const blob = await grabFrame("image/png");
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    addItem({ kind: "photo", blob, url, thumb: url, name: `photo_${timestamp()}.png` });
  }

  async function startRecording() {
    if (!stream) return;
    const mimeType = pickMimeType();
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (err) {
      showError(`Could not start recording: ${err.message || err.name}`);
      return;
    }
    chunks = [];
    const thumbBlob = await grabFrame("image/jpeg", 0.7);
    const thumb = thumbBlob ? URL.createObjectURL(thumbBlob) : "";
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      clearInterval(timer);
      const type = recorder.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunks, { type });
      chunks = [];
      recorder = null;
      ui.record.textContent = "Record";
      ui.record.classList.remove("is-recording");
      ui.status.classList.remove("pccam-rec");
      ui.status.textContent = "Live";
      [ui.start, ui.camera, ui.resolution, ui.audio].forEach((el) => (el.disabled = false));
      if (!blob.size) {
        if (thumb) URL.revokeObjectURL(thumb);
        return;
      }
      addItem({ kind: "video", blob, url: URL.createObjectURL(blob), thumb, name: `video_${timestamp()}.${extFor(type)}` });
    };
    recorder.start(1000);
    recordStart = Date.now();
    ui.record.textContent = "Stop";
    ui.record.classList.add("is-recording");
    ui.status.classList.add("pccam-rec");
    [ui.start, ui.camera, ui.resolution, ui.audio].forEach((el) => (el.disabled = true));
    const tick = () => {
      const s = Math.floor((Date.now() - recordStart) / 1000);
      ui.status.textContent = `● REC ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    };
    tick();
    timer = setInterval(tick, 500);
  }

  function toggleRecording() {
    if (recorder && recorder.state === "recording") recorder.stop();
    else startRecording();
  }

  function addItem(item) {
    item.id = ++counter;
    item.keep = true;
    items.push(item);
    render();
  }

  function releaseItem(item) {
    URL.revokeObjectURL(item.url);
    if (item.thumb && item.thumb !== item.url) URL.revokeObjectURL(item.thumb);
    item.blob = null;
  }

  function removeItems(predicate) {
    const gone = items.filter(predicate);
    if (gone.some((it) => it.url === ui.player.src || it.url === ui.playerImg.src)) closePlayer();
    gone.forEach(releaseItem);
    items = items.filter((it) => !predicate(it));
    render();
  }

  function closePlayer() {
    ui.player.pause();
    ui.player.removeAttribute("src");
    ui.player.load();
    ui.playerImg.removeAttribute("src");
    ui.playerWrap.hidden = true;
  }

  function play(item) {
    ui.playerWrap.hidden = false;
    ui.playerTitle.textContent = item.name;
    if (item.kind === "video") {
      ui.playerImg.hidden = true;
      ui.player.hidden = false;
      ui.player.src = item.url;
      ui.player.play().catch(() => {});
    } else {
      ui.player.pause();
      ui.player.hidden = true;
      ui.playerImg.hidden = false;
      ui.playerImg.src = item.url;
    }
    ui.playerWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function downloadItem(item) {
    const a = document.createElement("a");
    a.href = item.url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadSelected() {
    items
      .filter((it) => it.keep)
      .forEach((it, i) => setTimeout(() => downloadItem(it), i * 400));
  }

  function formatSize(bytes) {
    return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
  }

  function render() {
    ui.clips.innerHTML = "";
    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "pccam-clip";

      const img = document.createElement("img");
      img.src = item.thumb;
      img.alt = item.name;
      img.title = "Click to preview";
      img.addEventListener("click", () => play(item));

      const name = document.createElement("div");
      name.className = "pccam-clip__name";
      name.textContent = `${item.kind === "video" ? "🎬" : "📷"} ${item.name}`;
      name.title = item.name;

      const actions = document.createElement("div");
      actions.className = "pccam-clip-actions";
      const label = document.createElement("label");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = item.keep;
      box.addEventListener("change", () => {
        item.keep = box.checked;
        updateButtons();
      });
      label.append(box, ` Keep · ${formatSize(item.blob.size)}`);
      const dl = document.createElement("button");
      dl.type = "button";
      dl.className = "pccam-link";
      dl.textContent = "Download";
      dl.addEventListener("click", () => downloadItem(item));
      actions.append(label, dl);

      card.append(img, name, actions);
      ui.clips.appendChild(card);
    });
    updateButtons();
  }

  function updateButtons() {
    const any = items.length > 0;
    const kept = items.some((it) => it.keep);
    ui.empty.hidden = any;
    ui.download.disabled = !kept;
    ui.discard.disabled = !items.some((it) => !it.keep);
    ui.clear.disabled = !any;
  }

  // Release everything when the visitor leaves the page.
  function cleanup() {
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    recorder = null;
    chunks = [];
    stopStream();
    items.forEach(releaseItem);
    items = [];
  }

  ui.start.addEventListener("click", startCamera);
  ui.camera.addEventListener("change", startCamera);
  ui.resolution.addEventListener("change", startCamera);
  ui.audio.addEventListener("change", () => stream && startCamera());
  ui.photo.addEventListener("click", takePhoto);
  ui.record.addEventListener("click", toggleRecording);
  ui.download.addEventListener("click", downloadSelected);
  ui.discard.addEventListener("click", () => removeItems((it) => !it.keep));
  ui.clear.addEventListener("click", () => {
    if (confirm("Delete all clips? Anything not downloaded will be lost.")) removeItems(() => true);
  });
  navigator.mediaDevices.addEventListener("devicechange", () => stream && listCameras());

  window.addEventListener("beforeunload", (e) => {
    const recording = recorder && recorder.state === "recording";
    if (items.length || recording) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("pagehide", cleanup);
})();
