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

  const cfg = window.ERA_APPLY || {};
  const formDialog = document.querySelector("#apply-form");
  const applyForm = formDialog && formDialog.querySelector("form");
  const errorEl = applyForm && applyForm.querySelector("[data-form-error]");
  const okEl = applyForm && applyForm.querySelector("[data-form-ok]");
  const submitBtn = applyForm && applyForm.querySelector("[data-submit]");
  const fileDrop = applyForm && applyForm.querySelector(".file-drop");
  const fileInput = applyForm && applyForm.querySelector('input[name="receipt"]');

  let formSent = false;

  const restoreApplyForm = () => {
    if (okEl) okEl.hidden = true;
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
    if (submitBtn) {
      submitBtn.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Отправить";
    }
    if (formSent && applyForm) {
      applyForm.reset();
      resetReceiptUi();
      formSent = false;
    }
  };

  document.querySelectorAll("[data-apply]").forEach((el) => {
    el.addEventListener("click", () => {
      if (formDialog && typeof formDialog.showModal === "function") {
        restoreApplyForm();
        formDialog.showModal();
      }
    });
  });

  const showError = (text) => {
    if (!errorEl) return;
    errorEl.hidden = !text;
    errorEl.textContent = text || "";
    if (okEl) okEl.hidden = true;
  };

  const fileProgress = applyForm && applyForm.querySelector("[data-file-progress]");
  const fileBar = applyForm && applyForm.querySelector("[data-file-bar]");
  const fileLabel = applyForm && applyForm.querySelector("[data-file-label]");

  const receiptState = {
    token: 0,
    status: "empty",
    uploadId: "",
    chunkTotal: 0,
    receiptName: "",
    receiptMime: ""
  };

  const fileDropHint = "Нажмите, чтобы выбрать jpg, png или pdf";

  const setReceiptProgress = (percent, text, state) => {
    if (!fileProgress || !fileBar || !fileLabel) return;
    fileProgress.hidden = false;
    fileProgress.classList.toggle("is-ready", state === "ready");
    fileProgress.classList.toggle("is-error", state === "error");
    fileBar.style.width = Math.max(0, Math.min(100, percent)) + "%";
    fileLabel.textContent = text;
  };

  const resetReceiptUi = () => {
    receiptState.status = "empty";
    receiptState.uploadId = "";
    receiptState.chunkTotal = 0;
    receiptState.receiptName = "";
    receiptState.receiptMime = "";
    if (fileProgress) fileProgress.hidden = true;
    if (fileDrop) fileDrop.textContent = fileDropHint;
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
      reader.readAsDataURL(file);
    });

  const receiptMeta = (file) => {
    const name = String(file.name || "receipt");
    const ext = (name.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";
    const type = String(file.type || "").toLowerCase();
    const safeName = name.replace(/[^\w.\-]+/g, "_") || "receipt";
    if (type === "application/pdf" || ext === "pdf") {
      return { kind: "file", mime: "application/pdf", name: /\.pdf$/i.test(safeName) ? safeName : safeName + ".pdf" };
    }
    if (type === "image/png" || ext === "png") {
      return { kind: "image", mime: "image/png", name: /\.png$/i.test(safeName) ? safeName : safeName + ".png" };
    }
    if (type === "image/jpeg" || type === "image/jpg" || ext === "jpg" || ext === "jpeg") {
      return { kind: "image", mime: "image/jpeg", name: /\.jpe?g$/i.test(safeName) ? safeName : safeName + ".jpg" };
    }
    return null;
  };

  const compressImage = (file) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 800;
        let width = img.width;
        let height = img.height;
        if (Math.max(width, height) > max) {
          const scale = max / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.55).split(",")[1]);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Не удалось прочитать изображение"));
      };
      img.src = url;
    });

  const prepareReceipt = async (file, meta) => {
    if (meta.kind === "image") {
      try {
        const base64 = await compressImage(file);
        return {
          base64,
          mime: "image/jpeg",
          name: meta.name.replace(/\.[^.]+$/, "") + ".jpg"
        };
      } catch (err) {
        return {
          base64: await fileToBase64(file),
          mime: meta.mime,
          name: meta.name
        };
      }
    }
    return {
      base64: await fileToBase64(file),
      mime: meta.mime,
      name: meta.name
    };
  };

  const getGas = async (href) => {
    await fetch(href, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store"
    });
  };

  const postToGas = async (url, payload) => {
    const query = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
    console.log("[ERA] save row", payload);
    await getGas(url + "?" + query);
  };

  const setSubmitBusy = (busy) => {
    if (!submitBtn) return;
    submitBtn.disabled = busy;
  };

  const uploadReceipt = async (file) => {
    if (!cfg.gasUrl || cfg.gasUrl.includes("YOUR_DEPLOYMENT_ID")) {
      throw new Error("Форма ещё не подключена");
    }

    const meta = receiptMeta(file);
    if (!meta) {
      throw new Error("Нужен файл jpg, png или pdf");
    }

    const token = ++receiptState.token;
    receiptState.status = "uploading";
    receiptState.uploadId = "";
    receiptState.chunkTotal = 0;
    receiptState.receiptName = meta.name;
    receiptState.receiptMime = meta.mime;
    if (fileDrop) fileDrop.textContent = file.name;
    setSubmitBusy(true);
    setReceiptProgress(2, meta.kind === "image" ? "сжатие…" : "чтение…", "uploading");

    const prepared = await prepareReceipt(file, meta);
    if (token !== receiptState.token) return;
    receiptState.receiptName = prepared.name;
    receiptState.receiptMime = prepared.mime;
    const receiptBase64 = prepared.base64;

    const chunkSize = 12000;
    const uploadId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const chunkTotal = Math.ceil(receiptBase64.length / chunkSize);
    const url = cfg.gasUrl;
    setReceiptProgress(4, "4%", "uploading");

    for (let i = 0; i < chunkTotal; i += 1) {
      if (token !== receiptState.token) return;
      const piece = receiptBase64.slice(i * chunkSize, (i + 1) * chunkSize);
      const query = new URLSearchParams({
        action: "chunk",
        id: uploadId,
        n: String(i),
        t: String(chunkTotal),
        d: piece
      }).toString();
      const percent = Math.max(5, Math.round(((i + 1) / chunkTotal) * 100));
      setReceiptProgress(percent, percent + "%", "uploading");
      await getGas(url + "?" + query);
    }

    if (token !== receiptState.token) return;
    receiptState.status = "ready";
    receiptState.uploadId = uploadId;
    receiptState.chunkTotal = chunkTotal;
    setReceiptProgress(100, "100%", "ready");
    setSubmitBusy(false);
  };

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        receiptState.token += 1;
        resetReceiptUi();
        setSubmitBusy(false);
        return;
      }
      if (!receiptMeta(file)) {
        receiptState.token += 1;
        fileInput.value = "";
        resetReceiptUi();
        setSubmitBusy(false);
        showError("Прикрепите файл jpg, png или pdf.");
        return;
      }
      showError("");
      uploadReceipt(file).catch((err) => {
        console.warn("[ERA] receipt upload failed", err);
        receiptState.status = "error";
        setReceiptProgress(0, "ошибка", "error");
        setSubmitBusy(false);
        showError("Не удалось загрузить чек. Выберите файл ещё раз.");
      });
    });
  }

  if (formDialog) {
    formDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
    });
    formDialog.addEventListener("click", (event) => {
      if (!event.target.closest("[data-close]")) return;
      receiptState.token += 1;
      if (receiptState.status === "uploading") {
        resetReceiptUi();
        setSubmitBusy(false);
      }
      formDialog.close();
    });
  }

  if (applyForm) {
    applyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      showError("");
      if (okEl) okEl.hidden = true;

      const data = new FormData(applyForm);
      const name = String(data.get("name") || "").trim();
      const city = String(data.get("city") || "").trim();
      const dateOfBirth = String(data.get("dateOfBirth") || "").trim();
      const category = String(data.get("category") || "").trim();
      const videoLink = String(data.get("videoLink") || "").trim();
      const experience = String(data.get("experience") || "").trim();
      const level = String(data.get("level") || "").trim();
      const phone = String(data.get("phone") || "").trim();
      const vkLink = String(data.get("vkLink") || "").trim();
      const tgLink = String(data.get("tgLink") || "").trim();
      const receipt = fileInput && fileInput.files && fileInput.files[0];

      if (!name || !city || !dateOfBirth || !category || !videoLink || !experience || !level || !phone) {
        showError("Заполните все обязательные поля.");
        return;
      }
      if (!vkLink && !tgLink) {
        showError("Укажите ссылку ВКонтакте или Telegram.");
        return;
      }
      if (!receipt) {
        showError("Прикрепите файл jpg, png или pdf.");
        return;
      }
      if (receiptState.status === "uploading") {
        showError("Дождитесь загрузки чека.");
        return;
      }
      if (receiptState.status !== "ready" || !receiptState.uploadId) {
        showError("Чек ещё не загружен. Выберите файл ещё раз и дождитесь 100%.");
        return;
      }
      if (!cfg.gasUrl || cfg.gasUrl.includes("YOUR_DEPLOYMENT_ID")) {
        showError("Форма ещё не подключена: укажите URL скрипта в js/config.js.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Отправка…";

      try {
        const person = name.replace(/\s+/g, "_") || "receipt";
        const original = receiptState.receiptName || "receipt";
        const payload = {
          tableId: cfg.tableId,
          sheetName: cfg.sheetName || "apply",
          name,
          city,
          dateOfBirth,
          category,
          videoLink,
          experience,
          level,
          phone,
          vkLink,
          tgLink,
          uploadId: receiptState.uploadId,
          chunkTotal: receiptState.chunkTotal,
          receiptName: original.indexOf(person) === 0 ? original : person + "_" + original,
          receiptMime: receiptState.receiptMime || "application/octet-stream"
        };

        await postToGas(cfg.gasUrl, payload);

        formSent = true;
        applyForm.reset();
        resetReceiptUi();
        if (okEl) okEl.hidden = false;
        submitBtn.hidden = true;
      } catch (err) {
        showError("Не удалось отправить заявку. Попробуйте ещё раз.");
      } finally {
        if (!formSent) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Отправить";
        }
      }
    });
  }
})();

