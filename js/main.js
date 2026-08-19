(function () {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  const navLinks = document.querySelectorAll(".nav a");
  const sections = document.querySelectorAll("section.page-block[id]");

  const headerOffset = () => (header ? header.offsetHeight : 84);

  const scrollToTarget = (target) => {
    const media = target.querySelector(".tickets-screen__media");
    const heading = target.querySelector(".section-title, h2");
    const focus = media || heading || target;
    const gap = media ? 0 : 16;
    const top = window.scrollY + focus.getBoundingClientRect().top - headerOffset() - gap;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);

    const offset = headerOffset() + 24;
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
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = (link.getAttribute("href") || "").slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;

      event.preventDefault();

      if (nav && toggle) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }

      requestAnimationFrame(() => {
        scrollToTarget(target);
        history.pushState(null, "", `#${id}`);
      });
    });
  });

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
