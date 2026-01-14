function finishIntro(){
  const intro = document.getElementById("introOverlay");
  const site  = document.getElementById("site");

  if (!intro || !site) return;

  intro.classList.add("hide");
  site.classList.remove("site--hidden");
  site.classList.add("site--show");
  document.body.classList.remove("no-scroll");

  setTimeout(() => { intro.style.display = "none"; }, 1000);
}

// автоматаар
setTimeout(finishIntro, 3500);

// Enter товч
const btn = document.getElementById("skipIntro");
if (btn) btn.addEventListener("click", finishIntro);

// хүсвэл intro дээр дарвал бас орно
const overlay = document.getElementById("introOverlay");
if (overlay) overlay.addEventListener("click", (e) => {
  if (e.target && e.target.id === "skipIntro") return;
  finishIntro();
});
