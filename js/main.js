(function () {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  const navLinks = document.querySelectorAll(".nav a");
  const sections = document.querySelectorAll("section.page-block[id]");

  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);

    const offset = (header.offsetHeight || 84) + 28;
    let current = "";
    sections.forEach((section) => {
      if (section.offsetTop <= window.scrollY + offset) {
        current = section.id;
      }
    });

    navLinks.forEach((link) => {
      const href = link.getAttribute("href") || "";
      link.classList.toggle("is-active", current !== "" && href === `#${current}`);
    });
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  let modal = document.querySelector("dialog.modal");
  if (!modal) {
    modal = document.createElement("dialog");
    modal.className = "modal";
    modal.innerHTML =
      '<div class="modal-inner"><h2></h2><p></p><button class="btn" type="button" data-close>Закрыть</button></div>';
    document.body.appendChild(modal);
  }

  const titleEl = modal.querySelector("h2");
  const textEl = modal.querySelector("p");

  const openSoon = (title, text) => {
    titleEl.textContent = title;
    textEl.textContent = text;
    if (typeof modal.showModal === "function") modal.showModal();
  };

  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-close]")) {
      modal.close();
    }
  });

  document.querySelectorAll("[data-soon]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      openSoon(
        el.dataset.soonTitle || "Скоро",
        el.dataset.soonText || "Этот раздел скоро откроется. Следите за анонсом."
      );
    });
  });
})();
