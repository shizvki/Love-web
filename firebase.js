import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp,
  doc, deleteDoc
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

let currentDetailId = null;

/** State */
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
}

closeDetail?.addEventListener("click", hideDetail);
xDetailBtn?.addEventListener("click", hideDetail);

// ✅ ESC дархад хаах
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideDetail();
});


function openDetail(m) {
  if (!detailModal) return;

  currentDetailId = m.id;

  if (dTitle) dTitle.textContent = m.title || "Дурсамж";

  const parts = [];
  parts.push(`<div class="m-date">${escapeHtml((m.mood || "💗") + " " + (m.eventDate || ""))}</div>`);
  if (m.location) parts.push(`<div class="tiny">📍 ${escapeHtml(m.location)}</div>`);
  if (m.imageUrl) parts.push(`<img class="detail-img" src="${m.imageUrl}" alt="">`);
  if (m.musicLink) parts.push(renderMusic(m.musicLink));
  if (m.videoLink) parts.push(renderVideo(m.videoLink));
  if (m.text) parts.push(`<div class="m-text" style="-webkit-line-clamp:unset">${escapeHtml(m.text)}</div>`);

  if (detailBody) detailBody.innerHTML = parts.join("");
  showDetail();
}

/** Delete only inside detail modal */
deleteInDetailBtn?.addEventListener("click", async () => {
  if (!currentDetailId) return;

  if (!auth.currentUser) return alert("Устгахын тулд нэвтэрнэ үү.");

  const ok = confirm("Энэ дурсамжийг устгах уу?");
  if (!ok) return;

  await deleteDoc(doc(db, "memories", currentDetailId));
  alert("Устгалаа ✅");
  hideDetail();
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
  const musicLink = document.getElementById("music")?.value.trim();
  const videoLink = document.getElementById("video")?.value.trim();
  const file = document.getElementById("photo")?.files?.[0];

  let imageUrl = "";
  if (file) {
    try {
      const fileRef = ref(storage, `memories/${Date.now()}-${safeName(file.name)}`);
      await uploadBytes(fileRef, file);
      imageUrl = await getDownloadURL(fileRef);
    } catch (err) {
      console.error(err);
      alert("Зураг upload хийхэд алдаа гарлаа.");
    }
  }

  await addDoc(collection(db, "memories"), {
    title: title || "",
    text: text || "",
    eventDate: date,
    location: location || "",
    mood,
    imageUrl: imageUrl || "",
    musicLink: musicLink || "",
    videoLink: videoLink || "",
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
});

/** ---- Render list card ---- */
function renderMemory(m) {
  const dateLine = `${m.mood || "💗"} ${m.eventDate || ""}`;
  const locLine = m.location ? `📍 ${m.location}` : "";

  return `
    <article class="memory" data-id="${m.id}">
      ${m.imageUrl ? `
        <div class="m-hero">
          <img src="${m.imageUrl}" alt="">
        </div>
      ` : `
        <div class="m-hero fake">
          <div class="badge">MEMORY</div>
        </div>
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
function renderMusic(url) {
  if (url.includes("spotify.com")) {
    const embed = url.replace("open.spotify.com/", "open.spotify.com/embed/");
    return `<iframe style="margin-top:10px;border-radius:12px" src="${embed}"
      width="100%" height="80" frameborder="0"
      allow="autoplay; clipboard-write; encrypted-media;"></iframe>`;
  }
  return `<div class="tiny" style="margin-top:10px;">🎵 ${linkify(url)}</div>`;
}

function renderVideo(url) {
  let src = url;
  try {
    if (url.includes("youtube.com/watch")) {
      const id = new URL(url).searchParams.get("v");
      if (id) src = `https://www.youtube.com/embed/${id}`;
    } else if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split("?")[0];
      if (id) src = `https://www.youtube.com/embed/${id}`;
    }
  } catch (_) {}
  return `<iframe style="margin-top:10px;border-radius:12px" src="${src}"
    width="100%" height="220" frameborder="0" allowfullscreen></iframe>`;
}

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

function linkify(url) {
  const safe = escapeHtml(url);
  return `<a class="tiny" href="${safe}" target="_blank" rel="noreferrer" style="color:rgba(255,255,255,.8)">${safe}</a>`;
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
