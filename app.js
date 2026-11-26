(() => {
  const els = {
    pageTitle: document.getElementById("page-title"),
    summaryMeta: document.getElementById("summary-meta"),
    summaryGrid: document.getElementById("summary-grid"),
    caseKicker: document.getElementById("case-kicker"),
    caseTitle: document.getElementById("case-title"),
    videoSpec: document.getElementById("video-spec"),
    leftLabel: document.getElementById("left-label"),
    rightLabel: document.getElementById("right-label"),
    stage: document.getElementById("compare-stage"),
    vLeft: document.getElementById("video-original"),
    vRight: document.getElementById("video-refined"),
    divider: document.getElementById("split-divider"),
    playBtn: document.getElementById("play-control"),
    playIcon: document.getElementById("control-play-icon"),
    timeline: document.getElementById("timeline"),
    currTime: document.getElementById("current-time"),
    duration: document.getElementById("duration"),
    fsBtn: document.getElementById("fullscreen-control"),
    prevBtn: document.getElementById("prev-case"),
    nextBtn: document.getElementById("next-case"),
    materialDetail: document.getElementById("material-detail"),
    filterPills: document.getElementById("filter-pills"),
    caseGrid: document.getElementById("case-grid"),
  };

  let data = null;
  let filteredCases = [];
  let activeIdx = 0;
  let splitPct = 50;
  let currentFilter = "ALL";
  let audioMode = "muted";

  function fmtTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function setSplit(pct) {
    splitPct = Math.max(0, Math.min(100, pct));
    els.vRight.style.clipPath = `inset(0 0 0 ${splitPct}%)`;
    els.divider.style.left = `${splitPct}%`;
    els.stage.setAttribute("aria-valuenow", String(Math.round(splitPct)));
  }

  function applyAudioMode() {
    els.vLeft.muted = audioMode !== "left";
    els.vRight.muted = audioMode !== "right";
  }

  function syncPlayState(playing) {
    els.playIcon.textContent = playing ? "Ⅱ" : "▶";
  }

  async function togglePlay() {
    if (els.vLeft.paused) {
      try {
        els.vRight.currentTime = els.vLeft.currentTime;
        await Promise.all([els.vLeft.play(), els.vRight.play()]);
        syncPlayState(true);
      } catch (_) {}
    } else {
      els.vLeft.pause();
      els.vRight.pause();
      syncPlayState(false);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderMaterials(c) {
    const refsHtml = c.references.length
      ? `<div class="ref-images">${c.references
          .map(
            (r) =>
              `<a class="ref-thumb" href="${r.url}" target="_blank" rel="noopener"><img src="${r.url}" alt="${escapeHtml(r.name)}"><span title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</span></a>`
          )
          .join("")}</div>`
      : `<p style="margin:0;color:var(--muted);font-size:13px;">本条为文生视频（T2VA），无参考图片。</p>`;

    const audiosHtml = c.audios.length
      ? c.audios
          .map(
            (a) =>
              `<div style="margin-top:8px;"><div style="font-size:12px;color:var(--muted);margin-bottom:4px;">参考音频：${escapeHtml(a.name)}</div><audio controls preload="none" src="${a.url}" style="width:100%;max-width:420px;"></audio></div>`
          )
          .join("")
      : "";

    const rulesHtml = c.rulesAndJudgement
      ? `<div><h3 style="margin:0 0 6px;font-size:14px;">问题标注 / 规则</h3><div class="prompt-box">${escapeHtml(c.rulesAndJudgement)}</div></div>`
      : "";

    els.materialDetail.innerHTML = `
      <div class="materials-grid">
        <div>
          <h3 style="margin:0 0 8px;font-size:14px;">输入参考素材</h3>
          ${refsHtml}
          ${audiosHtml}
        </div>
        ${rulesHtml}
        <div>
          <h3 style="margin:0 0 6px;font-size:14px;">原始中文 Prompt (prompt_input)</h3>
          <div class="prompt-box">${escapeHtml(c.promptInput || "无")}</div>
        </div>
        <div>
          <h3 style="margin:0 0 6px;font-size:14px;">实际送入模型 Prompt (prompt_final)</h3>
          <div class="prompt-box">${escapeHtml(c.promptFinal || "无")}</div>
        </div>
      </div>
    `;
  }

  function selectCase(idx, autoplay = true) {
    if (!filteredCases.length) return;
    activeIdx = (idx + filteredCases.length) % filteredCases.length;
    const c = filteredCases[activeIdx];

    els.caseKicker.textContent = c.kicker;
    els.caseTitle.textContent = c.id;
    const lTime = c.leftSeconds != null ? `${c.leftSeconds}s` : "-";
    const rTime = c.rightSeconds != null ? `${c.rightSeconds}s` : "-";
    els.videoSpec.textContent = `${c.aspectRatio} · ${c.durationSeconds}s · 左侧 ${lTime} / 右侧 ${rTime}`;

    els.stage.classList.remove("landscape", "square");
    const [aw, ah] = c.aspectRatio.split(":").map(Number);
    if (aw && ah) {
      if (aw > ah) els.stage.classList.add("landscape");
      else if (aw === ah) els.stage.classList.add("square");
    }

    els.vLeft.src = c.leftUrl;
    els.vRight.src = c.rightUrl;
    els.vLeft.currentTime = 0;
    els.vRight.currentTime = 0;
    applyAudioMode();
    renderMaterials(c);

    document.querySelectorAll(".case-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.id === c.id);
    });

    if (autoplay) {
      Promise.all([els.vLeft.play(), els.vRight.play()])
        .then(() => syncPlayState(true))
        .catch(() => syncPlayState(false));
    } else {
      syncPlayState(false);
    }
  }

  function renderCaseGrid() {
    els.caseGrid.innerHTML = filteredCases
      .map(
        (c, i) => `
      <button type="button" class="case-item" data-id="${escapeHtml(c.id)}" data-idx="${i}">
        <div class="case-item-top">
          <span>${escapeHtml(c.kicker)}</span>
          <span>${escapeHtml(c.aspectRatio)} · ${c.durationSeconds}s</span>
        </div>
        <div class="case-item-title">${escapeHtml(c.id)}</div>
        <div class="case-item-meta">Agnes: ${c.leftSeconds ?? "-"}s · Hybrid: ${c.rightSeconds ?? "-"}s</div>
      </button>`
      )
      .join("");

    els.caseGrid.querySelectorAll(".case-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectCase(Number(btn.dataset.idx), true);
        els.stage.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  function applyFilter(filter) {
    currentFilter = filter;
    filteredCases =
      filter === "ALL"
        ? data.cases
        : data.cases.filter((c) => c.task === filter);
    els.filterPills.querySelectorAll(".pill").forEach((p) => {
      p.classList.toggle("active", p.dataset.filter === filter);
    });
    renderCaseGrid();
    selectCase(0, false);
  }

  function bindEvents() {
    let dragging = false;
    const updateFromClientX = (clientX) => {
      const rect = els.stage.getBoundingClientRect();
      if (rect.width <= 0) return;
      setSplit(((clientX - rect.left) / rect.width) * 100);
    };
    els.stage.addEventListener("pointerdown", (e) => {
      dragging = true;
      els.stage.setPointerCapture(e.pointerId);
      updateFromClientX(e.clientX);
    });
    els.stage.addEventListener("pointermove", (e) => {
      if (dragging) updateFromClientX(e.clientX);
    });
    els.stage.addEventListener("pointerup", () => {
      dragging = false;
    });
    els.stage.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") setSplit(splitPct - 3);
      else if (e.key === "ArrowRight") setSplit(splitPct + 3);
      else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    });

    els.playBtn.addEventListener("click", togglePlay);
    els.prevBtn.addEventListener("click", () => selectCase(activeIdx - 1, true));
    els.nextBtn.addEventListener("click", () => selectCase(activeIdx + 1, true));

    els.vLeft.addEventListener("loadedmetadata", () => {
      els.duration.textContent = fmtTime(els.vLeft.duration);
    });
    els.vLeft.addEventListener("timeupdate", () => {
      const d = els.vLeft.duration || 1;
      els.currTime.textContent = fmtTime(els.vLeft.currentTime);
      els.timeline.value = String(Math.round((els.vLeft.currentTime / d) * 1000));
      if (Math.abs(els.vRight.currentTime - els.vLeft.currentTime) > 0.15) {
        els.vRight.currentTime = els.vLeft.currentTime;
      }
    });
    els.timeline.addEventListener("input", () => {
      const d = els.vLeft.duration || 0;
      const t = (Number(els.timeline.value) / 1000) * d;
      els.vLeft.currentTime = t;
      els.vRight.currentTime = t;
    });

    document.querySelectorAll('input[name="pair-audio"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        audioMode = e.target.value;
        applyAudioMode();
      });
    });

    els.fsBtn.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else els.stage.requestFullscreen?.();
    });

    els.filterPills.addEventListener("click", (e) => {
      const btn = e.target.closest(".pill");
      if (btn) applyFilter(btn.dataset.filter);
    });
  }

  async function init() {
    if (window.REPORT_DATA) {
      data = window.REPORT_DATA;
    } else {
      const resp = await fetch("data/cases.json");
      data = await resp.json();
    }

    els.leftLabel.textContent = data.leftLabel;
    els.rightLabel.textContent = data.rightLabel;
    const s = data.summary;
    els.summaryMeta.textContent = `${s.totalCases} 组配对（REF2VA ${s.ref2vaCount} · T2VA ${s.t2vaCount}）`;
    els.summaryGrid.innerHTML = `
      <div class="stat-box">
        <h3>左侧 · ${escapeHtml(data.leftLabel)}</h3>
        <p>均耗时 ${s.leftStats?.mean ?? "-"}s · 中位数 ${s.leftStats?.median ?? "-"}s（${s.leftStats?.min ?? "-"}s ~ ${s.leftStats?.max ?? "-"}s）</p>
      </div>
      <div class="stat-box">
        <h3>右侧 · ${escapeHtml(data.rightLabel)}</h3>
        <p>均耗时 ${s.rightStats?.mean ?? "-"}s · 中位数 ${s.rightStats?.median ?? "-"}s（${s.rightStats?.min ?? "-"}s ~ ${s.rightStats?.max ?? "-"}s）</p>
      </div>
    `;

    setSplit(50);
    bindEvents();
    applyFilter("ALL");
  }

  init().catch((err) => {
    els.caseTitle.textContent = `加载失败: ${err}`;
  });
})();

