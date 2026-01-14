import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp,
  doc, deleteDoc, updateDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

/** Firebase config */
const firebaseConfig = {
  apiKey: "AIzaSyAiKlQgFrd6YrexAsMUYIdP30Fw7BLCiSE",
  authDomain: "love-app-cf9f4.firebaseapp.com",
  projectId: "love-app-cf9f4",
  storageBucket: "love-app-cf9f4.firebasestorage.app",
  messagingSenderId: "619345611444",
  appId: "1:619345611444:web:03c7bfc39b04da346fe5e1",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

/** UI refs */
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const openAddBtn = document.getElementById("openAddBtn");
const authHint = document.getElementById("authHint");

const addModal = document.getElementById("addModal");
const closeModal = document.getElementById("closeModal");
const xCloseBtn = document.getElementById("xCloseBtn");

const form = document.getElementById("memoryForm");
const statusEl = document.getElementById("status");
const memoryList = document.getElementById("memoryList");
const loadingLine = document.getElementById("loadingLine");

/** Detail modal refs */
const detailModal = document.getElementById("detailModal");
const closeDetail = document.getElementById("closeDetail");
const xDetailBtn = document.getElementById("xDetailBtn");
const dTitle = document.getElementById("dTitle");
const detailBody = document.getElementById("detailBody");
const deleteInDetailBtn = document.getElementById("deleteInDetailBtn");

const addMoreWrap = document.getElementById("addMoreWrap");
const addMoreInput = document.getElementById("addMoreMedia");
const addMoreBtn = document.getElementById("addMoreBtn");
const addMoreStatus = document.getElementById("addMoreStatus");

let currentDetailId = null;
let memoryCache = [];

/** ---- Add Modal ---- */
function showAddModal() {
  addModal?.classList.add("show");
  addModal?.setAttribute("aria-hidden", "false");
}
function hideAddModal() {
  addModal?.classList.remove("show");
  addModal?.setAttribute("aria-hidden", "true");
}

closeModal?.addEventListener("click", hideAddModal);
xCloseBtn?.addEventListener("click", hideAddModal);

openAddBtn?.addEventListener("click", () => {
  if (!auth.currentUser) {
    alert("Дурсамж нэмэхийн тулд эхлээд нэвтэрнэ үү.");
    return;
  }
  if (statusEl) statusEl.textContent = "";
  showAddModal();
});

/** ---- Detail Modal ---- */
function showDetail() {
  if (!detailModal) return;
  detailModal.classList.add("show");
  detailModal.setAttribute("aria-hidden", "false");
}

function hideDetail() {
  if (!detailModal) return;
  detailModal.classList.remove("show");
  detailModal.setAttribute("aria-hidden", "true");
  currentDetailId = null;
  if (detailBody) detailBody.innerHTML = "";
  if (addMoreStatus) addMoreStatus.textContent = "";
  if (addMoreInput) addMoreInput.value = "";
}

closeDetail?.addEventListener("click", hideDetail);
xDetailBtn?.addEventListener("click", hideDetail);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideDetail();
});

/** ---- Auth ---- */
loginBtn?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    if (loginBtn) loginBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-flex";
    if (openAddBtn) openAddBtn.disabled = false;
    if (authHint) authHint.textContent = `Нэвтэрсэн ✅ (${user.displayName || "user"})`;
  } else {
    if (loginBtn) loginBtn.style.display = "inline-flex";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (openAddBtn) openAddBtn.disabled = true;
    if (authHint) authHint.textContent = "Дурсамж нэмэхийн тулд нэвтэрнэ.";
    hideAddModal();
  }

  // ✅ detail доторх товчууд
  if (deleteInDetailBtn) deleteInDetailBtn.style.display = user ? "inline-flex" : "none";
  if (addMoreWrap) addMoreWrap.style.display = user ? "block" : "none";
});

/** ---- Delete inside detail ---- */
deleteInDetailBtn?.addEventListener("click", async () => {
  if (!currentDetailId) return;
  if (!auth.currentUser) return alert("Устгахын тулд нэвтэрнэ үү.");

  const ok = confirm("Энэ дурсамжийг устгах уу?");
  if (!ok) return;

  await deleteDoc(doc(db, "memories", currentDetailId));
  alert("Устгалаа ✅");
  hideDetail();
});

/** ---- Realtime list ---- */
const q = query(collection(db, "memories"), orderBy("eventDate", "desc"));
onSnapshot(q, (snap) => {
  const items = [];
  snap.forEach(d => items.push({ id: d.id, ...d.data() }));
  memoryCache = items;

  if (loadingLine) loadingLine.remove();

  if (items.length === 0) {
    if (memoryList) memoryList.innerHTML = `<div class="tiny">Одоохондоо дурсамж алга байна… 💗</div>`;
    return;
  }

  if (memoryList) memoryList.innerHTML = items.map(m => renderMemory(m)).join("");
});

/** Click on card -> open detail */
memoryList?.addEventListener("click", (e) => {
  const card = e.target.closest(".memory");
  if (!card) return;

  const id = card.getAttribute("data-id");
  const mem = memoryCache.find(x => x.id === id);
  if (mem) openDetail(mem);
});

/** ---- Upload helper (media[]) ---- */
async function uploadFilesToMedia(files) {
  const media = [];
  for (const f of files) {
    const t = (f.type || "").toLowerCase();
    const name = (f.name || "").toLowerCase();

    const isVideo = t.startsWith("video/") || /\.(mp4|mov|webm|mkv)$/i.test(name);
    const isAudio = t.startsWith("audio/") || /\.(mp3|m4a|aac|wav|ogg)$/i.test(name);
    const type = isVideo ? "video" : (isAudio ? "audio" : "image");

    const fileRef = ref(storage, `memories/${Date.now()}-${safeName(f.name)}`);
    await uploadBytes(fileRef, f);
    const url = await getDownloadURL(fileRef);

    media.push({ type, url });
  }
  return media;
}

/** ---- Detail open ---- */
function openDetail(m) {
  if (!detailModal) return;
  currentDetailId = m.id;

  if (dTitle) dTitle.textContent = m.title || "Дурсамж";

  const parts = [];
  parts.push(`<div class="m-date">${escapeHtml((m.mood || "💗") + " " + (m.eventDate || ""))}</div>`);
  if (m.location) parts.push(`<div class="tiny">📍 ${escapeHtml(m.location)}</div>`);

  const media = Array.isArray(m.media) ? m.media : [];
  const audioTrack = media.find(x => x.type === "audio");
  const slides = media.filter(x => x.type !== "audio"); // image/video

  if (slides.length) {
    parts.push(`
      <div class="storybox">
        <div class="story-progress">
          ${slides.map(() => `<span></span>`).join("")}
          ${auth.currentUser ? `<button class="story-add" type="button" title="Нэмэх">+</button>` : ``}
        </div>

        <div class="story-stage">
          ${slides.map((x, i) => {
            if (x.type === "video") {
              return `<video class="story-slide${i===0?' active':''}"
                        src="${x.url}"
                        playsinline
                        controls
                        preload="metadata"
                      ></video>`;
            }
            return `<img class="story-slide${i===0 ? " active" : ""}" src="${x.url}" alt="">`;
          }).join("")}
        </div>

        <div class="story-nav left" aria-label="Prev"></div>
        <div class="story-nav right" aria-label="Next"></div>

        ${audioTrack ? `
          <div class="bg-audio">
            <button class="bg-audio-btn" type="button" title="Audio">🎵</button>
            <audio class="bg-audio-el" src="${audioTrack.url}" preload="metadata" controls></audio>
          </div>
        ` : ``}
      </div>
    `);
  }

  if (m.text) parts.push(`<div class="m-text" style="-webkit-line-clamp:unset">${escapeHtml(m.text)}</div>`);

  if (detailBody) detailBody.innerHTML = parts.join("");
  showDetail();

  const box = detailBody?.querySelector(".storybox");
  if (box) initStorySlider(box);

  // ✅ login үед л addMoreWrap харагдана (onAuthStateChanged бас update хийнэ)
  if (addMoreWrap) addMoreWrap.style.display = auth.currentUser ? "block" : "none";
  if (deleteInDetailBtn) deleteInDetailBtn.style.display = auth.currentUser ? "inline-flex" : "none";
}

// ✅ + дээр дарахад file picker нээх (энэ аль хэдийн байгаа)
detailBody?.addEventListener("click", (e) => {
  if (e.target.closest(".story-add") || e.target.closest(".story-stage")) {
    // зөвхөн login үед
    if (auth.currentUser) addMoreInput?.click();
  }
});


// ✅ Файл сонгогдмогц шууд upload + append хийх (FB story шиг)
addMoreInput?.addEventListener("change", async () => {
  if (!auth.currentUser) return alert("Нэвтэрч байж нэмнэ.");
  if (!currentDetailId) return alert("Аль дурсамж дээр нэмэхээ олсонгүй.");

  const files = Array.from(addMoreInput.files || []);
  if (!files.length) return;

  if (addMoreStatus) addMoreStatus.textContent = "Upload хийж байна...";

  try {
    const newItems = await uploadFilesToMedia(files);

    await updateDoc(doc(db, "memories", currentDetailId), {
      media: arrayUnion(...newItems)
    });

    if (addMoreStatus) addMoreStatus.textContent = "Нэмэгдлээ ✅";
    addMoreInput.value = ""; // reset
  } catch (err) {
    console.error(err);
    if (addMoreStatus) addMoreStatus.textContent = "Алдаа гарлаа ❌";
    alert("Нэмэх үед алдаа гарлаа.");
  }
});


/** ---- Submit: Add memory ---- */
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!auth.currentUser) return alert("Нэвтэрч байж нэмнэ.");
  if (statusEl) statusEl.textContent = "Нэмэж байна…";

  const title = document.getElementById("title")?.value.trim();
  const text = document.getElementById("text")?.value.trim();
  const date = document.getElementById("date")?.value || new Date().toISOString().slice(0, 10);
  const location = document.getElementById("location")?.value.trim();
  const mood = document.getElementById("mood")?.value || "💗";

  const files = Array.from(document.getElementById("media")?.files || []);
  let media = [];

  try {
    if (files.length) {
      media = await uploadFilesToMedia(files);
    }

    await addDoc(collection(db, "memories"), {
      title: title || "",
      text: text || "",
      eventDate: date,
      location: location || "",
      mood,
      media,
      createdAt: serverTimestamp(),
      authorUid: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || ""
    });

    form.reset();
    if (statusEl) statusEl.textContent = "Нэмэгдлээ ✅";
    setTimeout(() => {
      if (statusEl) statusEl.textContent = "";
      hideAddModal();
    }, 700);
  } catch (err) {
    console.error(err);
    alert("Нэмэх үед алдаа гарлаа.");
    if (statusEl) statusEl.textContent = "";
  }
});

/** ---- Render list card ---- */
function renderMemory(m) {
  const dateLine = `${m.mood || "💗"} ${m.eventDate || ""}`;
  const locLine = m.location ? `📍 ${m.location}` : "";
  const first = (m.media && m.media.length) ? m.media[0] : null;

  return `
    <article class="memory" data-id="${m.id}">
      ${first ? `
        <div class="m-hero">
          ${first.type === "video"
            ? `<video src="${first.url}" muted playsinline></video>`
            : first.type === "image"
              ? `<img src="${first.url}" alt="">`
              : `<div class="m-hero fake"><div class="badge">🎵 AUDIO</div></div>`
          }
        </div>
      ` : `
        <div class="m-hero fake"><div class="badge">MEMORY</div></div>
      `}

      <div class="m-body">
        <div class="m-date">${escapeHtml(dateLine)}</div>
        ${locLine ? `<div class="tiny" style="margin:0;">${escapeHtml(locLine)}</div>` : ``}
        <div class="m-title">${escapeHtml(m.title || "")}</div>
        <div class="m-text">${escapeHtml(m.text || "")}</div>
      </div>
    </article>
  `;
}

/** ---- Helpers ---- */
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function safeName(name) {
  return String(name).replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}

/** ---- Misc ---- */
const elYear = document.getElementById("year");
if (elYear) elYear.textContent = new Date().getFullYear();

const todayLine = document.getElementById("todayLine");
if (todayLine) {
  const d = new Date();
  todayLine.textContent =
    `Өнөөдөр: ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} • “Дурсамж нэмэгдсээр...”`;
}

document.getElementById("copyLinkBtn")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    alert("Линк хууллаа ✅");
  } catch (e) {
    alert("Хуулах боломжгүй байна. Гар аргаар хуулна уу.");
  }
});

/** ---- Story Slider (box param-тай) ---- */
function initStorySlider(box) {
  const slides = Array.from(box.querySelectorAll(".story-slide"));
  const bars = Array.from(box.querySelectorAll(".story-progress span"));
  const left = box.querySelector(".story-nav.left");
  const right = box.querySelector(".story-nav.right");
  const bgAudio = box.querySelector(".bg-audio-el");

  if (!slides.length) return;
  let i = 0;

  function stopAllVideos() {
    slides.forEach((s) => {
      if (s.tagName === "VIDEO") {
        s.pause();
        s.currentTime = 0;
      }
    });
  }

  function render() {
    slides.forEach((s, idx) => s.classList.toggle("active", idx === i));
    bars.forEach((b, idx) => b.classList.toggle("active", idx === i));

    const active = slides[i];

    if (active && active.tagName === "VIDEO") {
      if (bgAudio) bgAudio.pause();
      stopAllVideos();
      active.play().catch(() => {});
      return;
    }

    stopAllVideos();
    if (bgAudio) {
      bgAudio.play().catch(() => {});
    }
  }

  function goNext() {
    i = (i + 1) % slides.length;
    render();
  }
  function goPrev() {
    i = (i - 1 + slides.length) % slides.length;
    render();
  }

  right && (right.onclick = goNext);
  left && (left.onclick = goPrev);

  // Mobile swipe
  let startX = null;
  box.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) startX = e.touches[0].clientX;
  });
  box.addEventListener("touchend", (e) => {
    if (startX !== null && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - startX;
      if (dx > 40) goPrev();
      else if (dx < -40) goNext();
      startX = null;
    }
  });

  // 🎵 жижиг товч дарахад controls show/hide
  const btn = box.querySelector(".bg-audio-btn");
  const wrap = box.querySelector(".bg-audio");
  if (btn && wrap) {
    btn.onclick = () => wrap.classList.toggle("open");
  }

  render();
}
addMoreBtn?.addEventListener("click", () => {
  addMoreMedia?.click();
});
window.addEventListener("load", () => {
  const intro = document.getElementById("intro");
  if (!intro) return;

  setTimeout(() => {
    intro.remove();
  }, 3800); // animation дууссаны дараа
});

