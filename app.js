/* AI Portfolio — vanilla JS app
   Renders 6 module pages with charts, custom SVGs, and smooth transitions. */

(() => {
  // ---------- Module definitions ----------
  const MODULES = [
    { id: "revenue",      label: "Revenue",                short: "Module 1", title: "Revenue Growth & Customer Intelligence",
      subtitle: "Personalized journeys, smarter pricing, and AI-powered demand forecasting that unlock new revenue streams." },
    { id: "commercial",   label: "Commercial Operations",  short: "Module 2", title: "Commercial Operations & AI-Assisted Support",
      subtitle: "Prioritized cases, intelligent support, and supplier insight that compress decision cycles." },
    { id: "plant",        label: "Plant Performance",      short: "Module 3", title: "Plant Performance & Asset Optimization",
      subtitle: "Predictive maintenance and OEE intelligence keeping every asset productive and efficient." },
    { id: "supply",       label: "Supply Chain",           short: "Module 4", title: "Autonomous Supply Chain & Execution",
      subtitle: "From inventory signals to fleet optimization — orchestrating supply at machine speed." },
    { id: "quality",      label: "Quality Leadership",     short: "Module 5", title: "Quality Leadership & Command",
      subtitle: "Vision inspection, predictive quality and digital twins driving lower scrap and safer plants." },
    { id: "productivity", label: "Speed, Productivity & AI Copilots", short: "Module 6", title: "Speed, Productivity & AI Copilots",
      subtitle: "Production scheduling, knowledge retrieval, and operator copilots accelerating every workflow." },
    { id: "overview",     label: "AI Portfolio Overview",  short: "Overview", title: "AI Portfolio Overview",
      subtitle: "A composable AI portfolio spanning six modules that work standalone or as a unified operating system." },
  ];

  // ---------- App state ----------
  const state = { currentId: "revenue", charts: [], renderToken: 0 };

  // ---------- Backend API ----------
  // All module data now comes from the Python backend (server.py) instead of
  // being hardcoded. See /api/module/<id>.
  async function fetchModuleData(id) {
    const res = await fetch(`/api/module/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
    const json = await res.json();
    return json.data;
  }

  const loadingMarkup = () => `
    <div class="grid place-items-center py-24 text-ink/50">
      <div class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 rounded-full border-2 border-cardLine border-t-brand animate-spin"></div>
        <div class="text-sm font-medium">Loading live data…</div>
      </div>
    </div>`;

  const errorMarkup = (msg) => `
    <div class="grid place-items-center py-20">
      <div class="max-w-md text-center">
        <div class="text-accent text-3xl mb-2">⚠</div>
        <div class="text-sm font-semibold text-ink">Couldn't load data from the backend</div>
        <div class="mt-1 text-xs text-ink/55">${msg}</div>
        <div class="mt-2 text-xs text-ink/45">Make sure <code>server.py</code> is running, then
          <button id="retry-btn" class="underline font-semibold text-brand">retry</button>.</div>
      </div>
    </div>`;

  // Registries (populated below)
  const RENDERERS = {};
  const CHART_INIT = {};

  // ---------- DOM ----------
  const navEl       = document.getElementById("module-nav");
  const viewEl      = document.getElementById("module-view");
  const titleEl     = document.getElementById("module-title");
  const subtitleEl  = document.getElementById("module-subtitle");
  const overviewBtn = document.getElementById("overview-btn");
  const sidebarEl   = document.getElementById("sidebar");
  const backdropEl  = document.getElementById("sidebar-backdrop");
  const menuToggle  = document.getElementById("menu-toggle");
  const sidebarClose= document.getElementById("sidebar-close");
  const iconMenu    = document.getElementById("icon-menu");
  const iconClose   = document.getElementById("icon-close");
  const mobileCurrent = document.getElementById("mobile-current");

  // ---------- Helpers ----------
  const $h = (html) => {
    const tpl = document.createElement("template");
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  };

  const destroyCharts = () => {
    state.charts.forEach((c) => { try { c.destroy(); } catch (_) {} });
    state.charts = [];
  };

  const registerChart = (chart) => { state.charts.push(chart); return chart; };

  // ---------- Global Chart.js polish (tooltips + hover cursor) ----------
  if (window.Chart) {
    Chart.defaults.font.family = "Inter, ui-sans-serif, system-ui";
    Chart.defaults.font.size = 12;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.responsive = true;
    // Pointer cursor when hovering an interactive element
    Chart.defaults.onHover = (e, els) => {
      const t = e && e.native && e.native.target;
      if (t) t.style.cursor = els && els.length ? "pointer" : "default";
    };
    // Dark, rounded, branded tooltip for every chart
    Object.assign(Chart.defaults.plugins.tooltip, {
      enabled: true,
      backgroundColor: "rgba(11,31,58,0.96)",
      titleColor: "#ffffff",
      bodyColor: "#dce5f2",
      borderColor: "rgba(159,194,240,0.25)",
      borderWidth: 1,
      padding: 11,
      cornerRadius: 9,
      displayColors: false,
      boxPadding: 4,
      titleFont: { family: "Inter", weight: "700", size: 12.5 },
      bodyFont: { family: "Inter", weight: "500", size: 12 },
    });
  }
  // Build a per-chart tooltip config that inherits the global theme
  const ttip = (callbacks, extra = {}) => ({ callbacks, ...extra });

  // ---------- Theme (light / dark) ----------
  const THEME = { dark: false };
  const cInk  = () => (THEME.dark ? "#c2d0e6" : "#0b1f3a");   // axis/label text
  const cGrid = () => (THEME.dark ? "rgba(150,170,200,0.14)" : "#eef2f8");
  const cLine = () => (THEME.dark ? "#9cc2f0" : "#0b1f3a");   // dark data lines
  function applyChartTheme() {
    if (!window.Chart) return;
    Chart.defaults.color = cInk();
    Chart.defaults.borderColor = cGrid();
  }
  function setTheme(dark) {
    THEME.dark = dark;
    document.body.classList.toggle("dark", dark);
    try { localStorage.setItem("dash-theme", dark ? "dark" : "light"); } catch (_) {}
  }

  // ---------- Sidebar ----------
  const NAV_ICONS = {
    revenue: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-7"/><path d="M14 7h7v7"/></svg>`,
    commercial: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="2.5" y="13" width="4" height="6" rx="1.5"/><rect x="17.5" y="13" width="4" height="6" rx="1.5"/><path d="M18 19a4 4 0 0 1-4 3"/></svg>`,
    plant: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l6 4V9l6 4V6l6 3v12z"/><path d="M3 21h18"/></svg>`,
    supply: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18.5" r="1.7"/><circle cx="17.5" cy="18.5" r="1.7"/></svg>`,
    quality: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
    productivity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>`,
  };
  const renderNav = () => {
    navEl.innerHTML = `<div class="nav-heading">Modules</div>`;
    MODULES.filter(m => m.id !== "overview").forEach((m) => {
      const btn = $h(`
        <button class="nav-btn ${m.id === state.currentId ? "active" : ""}" data-id="${m.id}">
          <span class="nav-ic">${NAV_ICONS[m.id] || ""}</span>
          <span class="flex-1 min-w-0">
            <span class="nav-index block">${m.short}</span>
            <span class="block leading-tight">${m.label}</span>
          </span>
          <span class="nav-caret">›</span>
        </button>`);
      btn.addEventListener("click", () => setModule(m.id));
      navEl.appendChild(btn);
    });
  };

  // ---------- Mobile drawer ----------
  const isMobile = () => window.matchMedia("(max-width: 767.98px)").matches;
  function openMenu() {
    sidebarEl.classList.add("open");
    backdropEl.classList.add("show");
    document.body.classList.add("menu-open");
    menuToggle && menuToggle.setAttribute("aria-expanded", "true");
    iconMenu  && iconMenu.classList.add("hidden");
    iconClose && iconClose.classList.remove("hidden");
  }
  function closeMenu() {
    sidebarEl.classList.remove("open");
    backdropEl.classList.remove("show");
    document.body.classList.remove("menu-open");
    menuToggle && menuToggle.setAttribute("aria-expanded", "false");
    iconMenu  && iconMenu.classList.remove("hidden");
    iconClose && iconClose.classList.add("hidden");
  }
  function toggleMenu() {
    sidebarEl.classList.contains("open") ? closeMenu() : openMenu();
  }
  menuToggle  && menuToggle.addEventListener("click", toggleMenu);
  sidebarClose && sidebarClose.addEventListener("click", closeMenu);
  backdropEl  && backdropEl.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  window.addEventListener("resize", () => { if (!isMobile()) closeMenu(); });

  // ---------- Module switcher ----------
  function setModule(id) {
    if (state.currentId === id) {
      if (isMobile()) closeMenu();
      return;
    }
    state.currentId = id;
    // active state on nav
    navEl.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.id === id);
    });
    renderCurrent();
    if (isMobile()) closeMenu();
  }

  async function renderCurrent() {
    destroyCharts();
    const m = MODULES.find((x) => x.id === state.currentId);
    const token = ++state.renderToken;          // guard against out-of-order async renders
    titleEl.textContent = m.title;
    subtitleEl.textContent = m.subtitle;
    if (mobileCurrent) mobileCurrent.textContent = (m.short && m.id !== "overview") ? `${m.short} · ${m.label}` : m.label;
    titleEl.classList.remove("title-swap"); void titleEl.offsetWidth; titleEl.classList.add("title-swap");
    subtitleEl.classList.remove("title-swap"); void subtitleEl.offsetWidth; subtitleEl.classList.add("title-swap");

    viewEl.classList.remove("module-enter");
    viewEl.innerHTML = loadingMarkup();

    let data;
    try {
      data = await fetchModuleData(m.id);
    } catch (err) {
      if (token !== state.renderToken) return;   // a newer render superseded us
      viewEl.innerHTML = errorMarkup(err.message || String(err));
      const retry = document.getElementById("retry-btn");
      if (retry) retry.addEventListener("click", () => renderCurrent());
      return;
    }
    if (token !== state.renderToken) return;       // user switched modules mid-fetch

    viewEl.classList.remove("module-enter");
    viewEl.innerHTML = "";
    const renderer = RENDERERS[m.id] || (() => $h(`<div class="text-ink/60">Coming soon.</div>`));
    const node = renderer(data);
    viewEl.appendChild(node);
    // Force reflow to restart staggered animations
    void viewEl.offsetWidth;
    viewEl.classList.add("module-enter");

    // Initialize charts after DOM is in the page
    requestAnimationFrame(() => {
      if (token !== state.renderToken) return;
      applyChartTheme();
      (CHART_INIT[m.id] || (() => {}))(data);
    });
  }

  overviewBtn.addEventListener("click", () => setModule("overview"));

  // ============================================================
  // Reusable card builder
  // ============================================================
  const card = ({ title, body, caption, info, span = 1, tall = false }) => `
    <article class="card ${span === 2 ? "col-span-2" : ""} ${tall ? "row-span-2" : ""}">
      <div class="card-title">
        <div class="card-head">
          <span>${title}</span>
          ${info ? `<button type="button" class="info-ic" aria-label="What this means" tabindex="0">i<span class="info-pop">${info}</span></button>` : ``}
        </div>
      </div>
      <div class="card-pad pt-0">${body}</div>
      <div class="card-caption">${caption}</div>
    </article>`;

  // ============================================================
  // MODULE 1 — REVENUE
  // ============================================================
  RENDERERS.revenue = (data) => $h(`
    <div class="grid-modules">
      ${card({
        title: "Personalized Journeys",
        info: "How prospects move from Awareness to Loyalty. Bar width = how many leads remain; the badge between stages is the conversion rate. Hover any stage for the full breakdown.",
        body: (() => {
          const grads = [["#9cc8f2", "#5fa1de"], ["#7fb6e8", "#3f86d6"],
                         ["#5fa1de", "#2a6bc2"], ["#3f86d6", "#16345f"]];
          const F = data.funnel;
          const maxW = 184, cx = 102, h = 38, gap = 3;
          const H = F.length * h + (F.length - 1) * gap;
          return `
          <div class="text-[10.5px] text-ink/45 mb-2">${F[0].count.toLocaleString()} leads enter at Awareness. Hover a stage for counts and drop-off.</div>
          <div id="funnel" class="relative">
            <div id="funnel-tip" class="map-tip"></div>
            <svg viewBox="0 0 320 ${H}" class="w-full" style="max-height:200px">
              <defs>
                ${F.map((f, i) => `<linearGradient id="fg${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${grads[i][0]}"/><stop offset="1" stop-color="${grads[i][1]}"/></linearGradient>`).join("")}
              </defs>
              ${F.map((f, i) => {
                const topW = Math.max(20, f.pct / 100 * maxW);
                const botPct = i < F.length - 1 ? F[i + 1].pct : f.pct * 0.5;
                const botW = Math.max(14, botPct / 100 * maxW);
                const y = i * (h + gap);
                const pts = `${cx - topW / 2},${y} ${cx + topW / 2},${y} ${cx + botW / 2},${y + h} ${cx - botW / 2},${y + h}`;
                return `
                <g class="funnel-seg" data-fi="${i}" style="cursor:default">
                  <polygon points="${pts}" fill="url(#fg${i})" class="funnel-poly" style="animation-delay:${i * 0.08}s"/>
                  <text x="${cx}" y="${y + h / 2 + 4}" text-anchor="middle" fill="#fff" font-size="11.5" font-weight="800">${f.pct}%</text>
                  <text x="210" y="${y + h / 2 - 2}" fill="${cInk()}" font-size="12" font-weight="700">${f.stage}</text>
                  <text x="210" y="${y + h / 2 + 12}" fill="${cInk()}" font-size="9.5" opacity="0.6">${f.count.toLocaleString()} leads${i > 0 ? ` · ${f.conv}% conv` : ""}</text>
                </g>`;
              }).join("")}
            </svg>
          </div>`;
        })(),
        caption: "Personalized product recommendations improving conversion and loyalty."
      })}

      ${card({
        title: "Quote & Margin Optimization",
        info: "Each dot is a sales quote plotted by win rate versus margin. The shaded band is the AI-recommended optimal zone — winning deals without giving away margin. Hover any point for its values.",
        body: `<div class="h-[180px]"><canvas id="scatterMargin"></canvas></div>`,
        caption: "AI-driven pricing to improve win rates and margins."
      })}

      ${card({
        title: "Demand & Capacity Planning",
        info: "Quarterly forecast demand against plant capacity. When the demand line nears the capacity limit it flags where to add shifts or rebalance product mix.",
        body: `<div class="h-[180px]"><canvas id="lineDemand"></canvas></div>`,
        caption: "Forecasting for profitable product mix and channel planning."
      })}

      ${card({
        title: "Connected-Product Monetization",
        info: "Share of revenue from recurring remote-service / subscription models versus one-time hardware sales. The bigger the remote-service slice, the more predictable the revenue.",
        body: `
          <div class="text-[10.5px] text-ink/45 mb-3">Recurring (remote-service) vs one-time (traditional) revenue mix.</div>
          <div class="flex items-center gap-5">
            <div class="relative w-[140px] h-[140px] shrink-0">
              <canvas id="doughnutMonetize"></canvas>
              <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div class="text-2xl font-extrabold text-ink leading-none">${data.monetization.remoteService}%</div>
                <div class="text-[9px] text-ink/45 font-semibold uppercase tracking-wide">recurring</div>
              </div>
            </div>
            <div class="flex-1 space-y-3">
              <div class="flex items-center gap-3">
                <span class="w-3 h-3 rounded-sm shrink-0" style="background:#16345f"></span>
                <div><div class="text-lg font-bold text-ink leading-none">${data.monetization.remoteService}%</div><div class="text-ink/50 text-[11px] mt-0.5">Remote-Service · recurring</div></div>
              </div>
              <div class="flex items-center gap-3">
                <span class="w-3 h-3 rounded-sm shrink-0" style="background:#7fb6e8"></span>
                <div><div class="text-lg font-bold text-ink leading-none">${data.monetization.traditionalSales}%</div><div class="text-ink/50 text-[11px] mt-0.5">Traditional · one-time</div></div>
              </div>
            </div>
          </div>`,
        caption: "Remote-service upsell models creating new revenue."
      })}

      ${card({
        title: "AI Customer Segmentation",
        info: "The average buyer profile across your whole customer base, scored 0–100 on five traits. It tells sales which offer, price and service level to lead with.",
        body: (() => {
          const DESC = {
            "Price Sensitivity": "How much price drives their decision",
            "Service Needs": "Level of support & service required",
            "Tech Adoption": "Willingness to adopt new technology",
            "Growth Potential": "Headroom to expand the account",
            "Risk Profile": "Churn / payment risk exposure",
          };
          const L = data.segmentation.labels, V = data.segmentation.values;
          return `
          <div class="text-[10.5px] text-ink/45 mb-2">Average buyer profile across all customers (0–100 per trait). Higher isn't always better — it guides how to sell to each segment.</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
            <div class="h-[210px]"><canvas id="radarSegments"></canvas></div>
            <div class="space-y-2.5">
              ${L.map((l, i) => `
                <div>
                  <div class="flex items-baseline justify-between text-[11.5px] mb-1">
                    <span class="font-semibold text-ink/80">${l}</span>
                    <span class="font-bold text-brand">${V[i]}<span class="text-ink/35 font-medium">/100</span></span>
                  </div>
                  <div class="h-1.5 rounded-full bg-slateBg overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-brand2 to-brand" style="width:${V[i]}%"></div></div>
                  <div class="text-[10px] text-ink/45 mt-0.5">${DESC[l] || ""}</div>
                </div>`).join("")}
            </div>
          </div>`;
        })(),
        caption: "Matching the right offer and service to each buyer.",
        span: 2,
      })}
    </div>
  `);

  CHART_INIT.revenue = (data) => {
    const dark = "#1f4e9b", lightPts = "#7fb6e8";

    // Personalized Journeys funnel: interactive hover tooltips
    const funnelEl = document.getElementById("funnel");
    const funnelTip = document.getElementById("funnel-tip");
    if (funnelEl && funnelTip) {
      const F = data.funnel;
      funnelEl.querySelectorAll(".funnel-seg[data-fi]").forEach((row) => {
        const i = parseInt(row.dataset.fi, 10);
        const f = F[i];
        row.addEventListener("mouseenter", () => {
          const prev = i > 0 ? F[i - 1] : null;
          const drop = prev ? prev.count - f.count : 0;
          funnelTip.innerHTML =
            `<div class="font-bold text-[12px] leading-tight">${f.stage}</div>
             <div class="text-[11px] mt-1">${f.count.toLocaleString()} leads · ${f.pct}% of awareness</div>
             ${prev ? `<div class="text-[11px]">${f.conv}% converted from ${prev.stage}</div>
                       <div class="text-[10.5px] opacity-70">${drop.toLocaleString()} dropped off (${100 - f.conv}%)</div>`
                    : `<div class="text-[10.5px] opacity-70">Top of funnel — every lead starts here</div>`}`;
          funnelTip.classList.add("show");
        });
        row.addEventListener("mousemove", (e) => {
          const r = funnelEl.getBoundingClientRect();
          let x = e.clientX - r.left + 14, y = e.clientY - r.top + 12;
          x = Math.min(x, r.width - 172);
          funnelTip.style.left = Math.max(0, x) + "px";
          funnelTip.style.top = y + "px";
        });
        row.addEventListener("mouseleave", () => funnelTip.classList.remove("show"));
      });
    }

    // Scatter
    const scatter = document.getElementById("scatterMargin");
    if (scatter) {
      registerChart(new Chart(scatter, {
        type: "scatter",
        data: {
          datasets: [
            { label: "Low margin", data: data.margin.low,     backgroundColor: "#16345f", pointRadius: 3.2 },
            { label: "Optimal",    data: data.margin.optimal, backgroundColor: lightPts, pointRadius: 3.5 },
          ],
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: ttip({
              title: (items) => items[0].dataset.label + " quote",
              label: (ctx) => [`Win rate: ${Math.round(ctx.parsed.x)}%`,
                               `Margin: ${Math.round(ctx.parsed.y)}%`],
            }, { intersect: true, mode: "nearest" }),
          },
          scales: {
            x: { min: 0, max: 100, title:{display:true,text:"Win Rate (%)", color:cInk(), font:{size:10,weight:"600"}},
                 grid:{color:cGrid()}, ticks:{display:false} },
            y: { min: 0, max: 100, title:{display:true,text:"Margin (%)", color:cInk(), font:{size:10,weight:"600"}},
                 grid:{color:cGrid()}, ticks:{display:false} },
          },
          animation: { duration: 900, easing: "easeOutQuart" }
        },
        plugins: [{
          id: "optimalBand",
          beforeDatasetsDraw(chart) {
            const { ctx, chartArea, scales } = chart;
            const yTop = scales.y.getPixelForValue(data.margin.band.top);
            const yBot = scales.y.getPixelForValue(data.margin.band.bottom);
            ctx.save();
            ctx.fillStyle = "rgba(127,182,232,0.18)";
            ctx.fillRect(chartArea.left, yTop, chartArea.right - chartArea.left, yBot - yTop);
            ctx.strokeStyle = "rgba(31,78,155,0.35)";
            ctx.setLineDash([4,4]);
            ctx.strokeRect(chartArea.left, yTop, chartArea.right - chartArea.left, yBot - yTop);
            ctx.restore();
          }
        }]
      }));
    }

    // Line demand
    const line = document.getElementById("lineDemand");
    if (line) {
      registerChart(new Chart(line, {
        type: "line",
        data: {
          labels: data.demand.labels,
          datasets: [
            { label: "Capacity Limit", data: data.demand.capacity, borderColor: "#9aa7bd", borderDash:[5,5], borderWidth: 1.4, pointRadius:0, fill:false, tension:0 },
            { label: "Forecast Demand", data: data.demand.forecast, borderColor: cLine(), borderWidth: 2.6, pointRadius:0, fill:false, tension:0.45 }
          ]
        },
        options: {
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: ttip({
              title: (items) => items[0].label,
              label: (ctx) => ctx.dataset.label === "Capacity Limit"
                ? "Capacity limit: 100%"
                : `Forecast demand: ${Math.round(ctx.parsed.y)}% of capacity`,
            }),
          },
          scales: {
            x: { grid:{display:false}, ticks:{color:cInk(), font:{size:11, weight:"600"}} },
            y: { display:false, min: 0, max: 110 }
          },
          animation: { duration: 1100, easing: "easeOutQuart" }
        },
        plugins: [{
          id:"labels",
          afterDatasetsDraw(chart) {
            const ctx = chart.ctx;
            ctx.fillStyle = cInk();
            ctx.font = "600 10px Inter";
            ctx.fillText("Capacity Limit", chart.scales.x.getPixelForValue(0)+8, chart.scales.y.getPixelForValue(80)-6);
            ctx.fillStyle = cInk();
            ctx.fillText("Forecast Demand", chart.scales.x.getPixelForValue(2)+10, chart.scales.y.getPixelForValue(56)-6);
          }
        }]
      }));
    }

    // Doughnut
    const dn = document.getElementById("doughnutMonetize");
    if (dn) {
      registerChart(new Chart(dn, {
        type: "doughnut",
        data: { labels:["Remote-Service","Traditional Sales"], datasets:[{ data:[data.monetization.remoteService, data.monetization.traditionalSales], backgroundColor:["#16345f","#7fb6e8"], borderColor:"#fff", borderWidth:3 }]},
        options: { cutout: "68%", plugins:{ legend:{display:false},
          tooltip: ttip({ label: (ctx) => `${ctx.label}: ${ctx.parsed}% of connected revenue` }) },
          animation:{ animateRotate:true, duration:1100 } }
      }));
    }

    // Radar
    const radar = document.getElementById("radarSegments");
    if (radar) {
      registerChart(new Chart(radar, {
        type: "radar",
        data: {
          labels: data.segmentation.labels,
          datasets: [{
            data: data.segmentation.values,
            borderColor: "#1f4e9b",
            backgroundColor: "rgba(63,134,214,0.18)",
            borderWidth: 2,
            pointBackgroundColor: "#1f4e9b",
            pointRadius: 3
          }]
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: ttip({
              title: (items) => items[0].label,
              label: (ctx) => `Index: ${Math.round(ctx.parsed.r)} / 100`,
            }),
          },
          scales: {
            r: {
              suggestedMin: 0, suggestedMax: 100,
              angleLines:{color:cGrid()},
              grid:{color:cGrid()},
              pointLabels:{color:cInk(), font:{size:11, weight:"600"}},
              ticks:{display:false}
            }
          },
          animation: { duration: 1100, easing:"easeOutQuart" }
        }
      }));
    }
  };

  // ============================================================
  // MODULE 2 — COMMERCIAL OPS
  // ============================================================
  RENDERERS.commercial = (data) => $h(`
    <div class="grid-modules">
      ${card({
        title: "High-Value Service Prioritization",
        info: "Open cases ranked by an AI risk score that blends issue severity with account value (ARR). Shows revenue at risk and the SLA target for each case.",
        body: `
          <div class="flex items-center justify-between mb-2.5">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-ink/45">${data.prioritization.openTotal} open cases</span>
            <span class="text-[11px] text-ink/40">ranked by AI risk</span>
          </div>
          <div class="space-y-2">
            ${data.prioritization.cases.map(r => {
              const rc = r.priority === "high" ? "#d8581f" : r.priority === "medium" ? "#e7a93a" : "#5e9f55";
              return `
              <div class="p-2.5 rounded-xl bg-slateBg/60 border border-cardLine transition hover:border-brand2/40">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[12.5px] font-bold text-ink truncate">${r.client}</span>
                  <span class="pill ${r.priority}"><span class="pdot"></span>${r.label}</span>
                </div>
                <div class="flex items-center justify-between gap-2 mt-1">
                  <span class="text-[11px] text-ink/55 truncate">${r.issue}</span>
                  <span class="text-[11.5px] font-bold text-ink shrink-0">$${r.valueAtRisk}K <span class="text-[9px] text-ink/40 font-medium">· SLA ${r.sla}h</span></span>
                </div>
                <div class="mt-1.5 h-1.5 rounded-full bg-cardLine overflow-hidden" title="Risk ${r.riskScore}/100">
                  <div class="h-full rounded-full" style="width:${r.riskScore}%;background:${rc}"></div>
                </div>
              </div>`;
            }).join("")}
          </div>`,
        caption: "Routing the highest-value and highest-risk cases first."
      })}

      ${card({
        title: "Customer Support Copilot",
        info: "A live AI-copilot resolving real cases from the queue. It thinks, then replies — and cycles through different issue types (outage, sync error, billing…).",
        body: `
          <div class="flex flex-col h-[300px]">
            <div class="flex items-center gap-2 pb-2.5 border-b border-cardLine">
              <span class="w-6 h-6 rounded-lg bg-gradient-to-br from-brand2 to-brand grid place-items-center text-white text-[11px] font-bold shrink-0">AI</span>
              <select id="copilot-select" class="cp-select flex-1" aria-label="Choose a support case"></select>
              <button id="copilot-ask" class="cp-go">Ask copilot</button>
            </div>
            <div id="copilot-stream" class="flex flex-col gap-2.5 pt-3 flex-1 overflow-y-auto pr-1">
              <div class="cp-empty">Pick a support case and click <b>Ask copilot</b> — it will think, then reply.</div>
            </div>
          </div>`,
        caption: "Faster case resolution and higher first-contact effectiveness."
      })}

      ${card({
        title: "Supplier Risk Scoring",
        info: "Global suppliers scored for disruption risk. The ranked list shows the top exposures; markers escalate to red when a real earthquake (live USGS feed) strikes nearby.",
        body: `
          ${data.supplierLive && data.supplierLive.live ? `
            <div class="flex items-center gap-2 mb-2 text-[11px]">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ok/10 text-ok font-semibold">
                <span class="w-1.5 h-1.5 rounded-full bg-ok animate-pulse"></span>LIVE
              </span>
              <span class="text-ink/55">${data.supplierLive.quakes} active quakes (USGS) · ${data.supplierLive.elevated} supplier${data.supplierLive.elevated === 1 ? "" : "s"} elevated</span>
            </div>` : ``}
          <div id="supplier-map-wrap" class="relative">
          <div id="supplier-tip" class="map-tip"></div>
          <svg viewBox="0 0 320 170" class="w-full h-[150px]">
            <defs>
              <radialGradient id="globeBg" cx="50%" cy="40%" r="80%">
                <stop offset="0" stop-color="#eef2f8"/>
                <stop offset="1" stop-color="#dde4ef"/>
              </radialGradient>
            </defs>
            <rect width="320" height="170" fill="url(#globeBg)" rx="10"/>
            <!-- world map: recognizable continents (equirectangular, simplified) -->
            <g fill="#c2ccdc" stroke="#aab6c9" stroke-width="0.6" stroke-linejoin="round">
              <!-- North America -->
              <path d="M30,38 L62,32 L78,40 L72,52 L84,55 L74,70 L60,74 L66,86 L56,96 L48,84 L40,86 L36,72 L44,64 L34,58 L40,48 Z"/>
              <!-- Greenland -->
              <path d="M92,26 L104,24 L108,34 L98,40 L90,34 Z"/>
              <!-- South America -->
              <path d="M78,100 L92,98 L98,110 L94,128 L86,148 L78,140 L76,122 L72,110 Z"/>
              <!-- Europe -->
              <path d="M150,42 L168,38 L176,44 L170,52 L160,54 L156,62 L148,58 L150,50 Z"/>
              <!-- Africa -->
              <path d="M152,70 L176,66 L186,78 L182,100 L172,122 L160,134 L152,120 L150,98 L146,82 Z"/>
              <!-- Asia -->
              <path d="M180,34 L232,30 L262,40 L256,54 L268,60 L256,72 L238,70 L226,60 L208,64 L196,56 L186,60 L182,48 Z"/>
              <!-- India -->
              <path d="M210,72 L226,70 L222,86 L214,94 L208,84 Z"/>
              <!-- SE Asia / Indonesia -->
              <path d="M242,86 L264,84 L272,92 L260,98 L246,96 Z"/>
              <!-- Australia -->
              <path d="M256,116 L286,112 L298,124 L290,140 L268,142 L256,130 Z"/>
            </g>
            <!-- supplier risk markers (hover for details) -->
            ${data.supplierMarkers.map((m, i) => `
              <g class="map-pulse map-marker" data-mk="${i}" style="cursor:pointer">
                <circle cx="${m.x}" cy="${m.y}" r="9" fill="${m.color}" opacity="0.30"/>
                <circle cx="${m.x}" cy="${m.y}" r="3.8" fill="${m.color}" opacity="0.95" stroke="#fff" stroke-width="1.2"/>
              </g>`).join("")}
            <!-- legend -->
            <g font-size="8" font-weight="600" fill="#0b1f3a">
              <circle cx="18" cy="156" r="3.2" fill="#d8581f"/><text x="25" y="159">High</text>
              <circle cx="62" cy="156" r="3.2" fill="#e7a93a"/><text x="69" y="159">Medium</text>
              <circle cx="120" cy="156" r="3.2" fill="#5e9f55"/><text x="127" y="159">Low</text>
            </g>
          </svg>
          </div>
          <div class="mt-2 space-y-1.5">
            <div class="text-[10.5px] font-semibold uppercase tracking-wider text-ink/45 mb-1">Top exposures</div>
            ${data.supplierTop.slice(0, 3).map(s => {
              const sc = s.band === "high" ? "#d8581f" : s.band === "medium" ? "#e7a93a" : "#5e9f55";
              return `
              <div class="flex items-center gap-2.5">
                <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${sc}"></span>
                <span class="text-[12px] font-semibold text-ink w-[78px] shrink-0">${s.name}</span>
                <span class="text-[10.5px] text-ink/50 flex-1 truncate">${s.country} · ${s.reason}</span>
                <span class="text-[12px] font-bold shrink-0" style="color:${sc}">${s.risk}</span>
              </div>`;
            }).join("")}
          </div>`,
        caption: "Trade optimization to protect revenue from disruption."
      })}

      ${card({
        title: "Contract Intelligence",
        info: "AI reads every supplier agreement and flags risky clauses. The flags here are linked to your highest-risk suppliers, worst first.",
        body: `
          <div class="flex items-center gap-2 mb-3">
            <div class="px-2.5 py-1 rounded-lg bg-slateBg text-[11px] font-bold text-ink/70">${data.contracts.analyzed} analyzed</div>
            <div class="px-2.5 py-1 rounded-lg bg-accent/10 text-accent text-[11px] font-bold">${data.contracts.flagged} flagged</div>
            <span class="ml-auto text-[10.5px] text-ink/40">auto-extracted</span>
          </div>
          <div class="space-y-2">
            ${data.contracts.topFlags.map(f => `
              <div class="p-2.5 rounded-lg border border-cardLine bg-white">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[12px] font-bold text-ink truncate">${f.clause}</span>
                  <span class="pill ${f.level} shrink-0"><span class="pdot"></span>${f.level === "high" ? "High" : f.level === "medium" ? "Med" : "Low"}</span>
                </div>
                <div class="text-[10.5px] text-ink/55 mt-1 italic leading-snug">${f.excerpt}</div>
                <div class="text-[10px] text-ink/40 mt-1">${f.supplier}</div>
              </div>`).join("")}
          </div>`,
        caption: "Extraction, risk flags, and obligation tracking for supplier agreements."
      })}

      ${card({
        title: "Commercial Insight Copilot",
        info: "The next-best commercial action for the highest-upside account, with projected ARR uplift, model confidence and time to close.",
        span: 2,
        body: `
          <div class="rounded-xl border border-brand2/30 bg-brand2/10 p-4">
            <div class="flex items-start gap-3">
              <div class="w-7 h-7 rounded-full bg-brand text-white grid place-items-center shrink-0 mt-0.5">✓</div>
              <div>
                <div class="text-sm font-bold text-ink">Next Best Action:</div>
                <div class="text-sm text-ink/80 mt-0.5">${data.insight.action}</div>
              </div>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-ink/60">
            <div class="p-2 rounded-lg bg-slateBg"><div class="text-lg font-bold text-brand">${data.insight.arrUplift}</div>ARR uplift</div>
            <div class="p-2 rounded-lg bg-slateBg"><div class="text-lg font-bold text-brand">${data.insight.confidence}</div>Confidence</div>
            <div class="p-2 rounded-lg bg-slateBg"><div class="text-lg font-bold text-brand">${data.insight.toClose}</div>To close</div>
          </div>`,
        caption: "Unified data insights for faster commercial decisions."
      })}
    </div>
  `);
  CHART_INIT.commercial = (data) => {
    // ---- Supplier map: interactive hover tooltips ----
    const mapWrap = document.getElementById("supplier-map-wrap");
    const tip = document.getElementById("supplier-tip");
    if (mapWrap && tip) {
      const markers = data.supplierMarkers || [];
      mapWrap.querySelectorAll("[data-mk]").forEach((g) => {
        const m = markers[parseInt(g.dataset.mk, 10)];
        if (!m) return;
        g.addEventListener("mouseenter", () => {
          tip.innerHTML =
            `<div class="font-bold text-[12px] leading-tight">${m.name}</div>
             <div class="text-[10px] opacity-60">${m.country}</div>
             <div class="mt-1 flex items-center gap-1.5">
               <span class="w-2 h-2 rounded-full" style="background:${m.color}"></span>
               <span class="text-[11px]">Risk ${m.risk} · ${m.reason}</span>
             </div>`;
          tip.classList.add("show");
        });
        g.addEventListener("mousemove", (e) => {
          const r = mapWrap.getBoundingClientRect();
          let x = e.clientX - r.left + 14, y = e.clientY - r.top + 12;
          x = Math.min(x, r.width - 168);
          tip.style.left = Math.max(0, x) + "px";
          tip.style.top = y + "px";
        });
        g.addEventListener("mouseleave", () => tip.classList.remove("show"));
      });
    }

    // ---- Support copilot: runs only when the user clicks "Ask copilot" ----
    const scenarios = (data.copilot && data.copilot.scenarios) || [];
    const streamEl = document.getElementById("copilot-stream");
    const selectEl = document.getElementById("copilot-select");
    const askBtn = document.getElementById("copilot-ask");
    if (!streamEl || !selectEl || !scenarios.length) return;

    const token = state.renderToken;
    let runId = 0;
    const baseAlive = () => token === state.renderToken && document.body.contains(streamEl);
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));

    selectEl.innerHTML = scenarios.map((s, i) =>
      `<option value="${i}">${s.title}${s.client ? " · " + s.client : ""}</option>`).join("");

    const append = (cls, html) => {
      const el = document.createElement("div");
      el.className = cls + " copilot-in";
      el.innerHTML = html;
      streamEl.appendChild(el);
      streamEl.scrollTop = streamEl.scrollHeight;
      return el;
    };

    async function typeInto(el, prefix, text, alive) {
      const words = text.split(" ");
      for (let i = 0; i < words.length; i++) {
        if (!alive()) return;
        el.innerHTML = prefix + words.slice(0, i + 1).join(" ") + `<span class="copilot-cursor"></span>`;
        streamEl.scrollTop = streamEl.scrollHeight;
        await wait(32 + words[i].length * 9);
      }
      el.innerHTML = prefix + text;
    }

    async function run() {
      const idx = parseInt(selectEl.value, 10) || 0;
      const myRun = ++runId;                       // cancels any in-flight run
      const alive = () => baseAlive() && myRun === runId;
      askBtn.disabled = true; askBtn.textContent = "Working…";
      streamEl.innerHTML = "";
      const sc = scenarios[idx];
      for (const m of sc.messages) {
        if (!alive()) break;
        if (m.role === "ai") {
          const t = append("chat-bubble-ai copilot-typing",
            `<span class="tdot"></span><span class="tdot"></span><span class="tdot"></span>`);
          await wait(750);
          if (!alive()) break;
          t.classList.remove("copilot-typing");
          await typeInto(t, `<b>AI Copilot:</b> `, m.text, alive);
        } else {
          append("chat-bubble-user", m.text);
        }
        await wait(m.role === "ai" ? 600 : 480);
      }
      if (myRun === runId) { askBtn.disabled = false; askBtn.textContent = "Ask copilot"; }
    }
    askBtn.addEventListener("click", run);
  };

  // ============================================================
  // MODULE 3 — PLANT PERFORMANCE
  // ============================================================
  RENDERERS.plant = (data) => $h(`
    <div class="grid-modules">
      ${card({
        title: "Predictive Maintenance",
        info: "A Weibull reliability model estimates remaining useful life for the most at-risk machine. The gauge and countdown warn before a failure happens.",
        body: `
          <div id="pm-gauge" class="relative flex flex-col items-center pt-1 h-[170px]" style="cursor:help"
               data-asset="${data.maintenance.asset}" data-kind="${data.maintenance.kind}"
               data-risk="${Math.round(data.maintenance.risk * 100)}" data-hours="${data.maintenance.hoursToFailure}">
            <div id="pm-tip" class="map-tip"></div>
            <svg viewBox="0 0 220 122" class="w-[210px] h-[122px]">
              <path d="M20,116 A90,90 0 0 1 200,116" fill="none" stroke="#e5eaf1" stroke-width="16" stroke-linecap="round"/>
              <path d="M20,116 A90,90 0 0 1 130,30" fill="none" stroke="#16345f" stroke-width="16" stroke-linecap="round"/>
              <path d="M130,30 A90,90 0 0 1 200,116" fill="none" stroke="#d8581f" stroke-width="16" stroke-linecap="round"/>
              <text x="40" y="112" font-size="8.5" fill="#16345f" font-weight="600">Healthy</text>
              <text x="160" y="112" font-size="8.5" fill="#d8581f" font-weight="600">At risk</text>
              <g transform="translate(110,116)">
                <line x1="0" y1="0" x2="0" y2="-74" stroke="#0b1f3a" stroke-width="3.2" stroke-linecap="round">
                  <animateTransform attributeName="transform" type="rotate"
                    from="-88" to="${Math.round(-90 + data.maintenance.risk * 180)}"
                    dur="1.2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.34 1.36 0.64 1"/>
                </line>
                <circle r="6.5" fill="#0b1f3a"/>
                <circle r="2.5" fill="#fff"/>
              </g>
              <text x="110" y="64" text-anchor="middle" font-size="11" fill="${cInk()}" opacity="0.45" font-weight="600">risk ${Math.round(data.maintenance.risk * 100)}%</text>
            </svg>
            <div class="-mt-1 flex flex-col items-center">
              <span class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-accent/10 text-accent font-extrabold text-sm">
                <span>⚠</span> ${data.maintenance.hoursToFailure} hrs to failure
              </span>
              <span class="mt-1.5 text-[12px] text-ink/55 font-medium">${data.maintenance.asset} · ${data.maintenance.kind}</span>
            </div>
          </div>`,
        caption: "Reducing downtime, repair cost, and unplanned stoppages."
      })}

      ${card({
        title: "OEE Loss Detection",
        info: "Overall Equipment Effectiveness split into its losses — Availability, Performance and Quality. Bars waterfall from 100% planned time down to actual OEE.",
        body: `<div class="h-[200px]"><canvas id="waterfallOEE"></canvas></div>`,
        caption: "Real-time visibility into line, asset, and shift performance."
      })}

      ${card({
        title: "Asset Utilization",
        info: "Live shop-floor view — each station is a real machine, coloured by status and labelled with its utilization. Hover a station for details. Green = running, amber = underused, red = maintenance due.",
        body: `
          <div class="flex items-end justify-between mb-1">
            <div>
              <div class="text-[28px] font-extrabold text-ink leading-none">${data.assetUtil.overall}<span class="text-base text-ink/40 font-bold">%</span></div>
              <div class="text-[10px] text-ink/50 font-semibold uppercase tracking-wider">Overall utilization · ${data.assetUtil.assets.length} machines</div>
            </div>
            <div class="flex flex-col items-end gap-1 text-[10px] font-semibold">
              <span class="px-2 py-0.5 rounded-md bg-ok/10 text-ok">${data.assetUtil.counts.running} running</span>
              ${data.assetUtil.counts.idle ? `<span class="px-2 py-0.5 rounded-md bg-warn/10 text-warn">${data.assetUtil.counts.idle} underused</span>` : ``}
              ${data.assetUtil.counts.maintenance ? `<span class="px-2 py-0.5 rounded-md bg-accent/10 text-accent">${data.assetUtil.counts.maintenance} maint. due</span>` : ``}
            </div>
          </div>
          <div class="text-[10.5px] text-ink/45 mb-2">Each tile is a machine — the % is its utilization, the colour is its status. Hover for details.</div>
          ${(() => {
            const a = data.assetUtil.assets, cols = 5, rows = Math.ceil(a.length / cols);
            const H = rows * 62 + 8;
            return `
            <svg viewBox="0 0 320 ${H}" class="w-full asset-floor" style="max-height:170px">
              <defs>
                <pattern id="floorGridAU" width="16" height="16" patternUnits="userSpaceOnUse">
                  <path d="M16 0 L0 0 0 16" fill="none" stroke="#e2e8f1" stroke-width="0.7"/>
                </pattern>
              </defs>
              <rect x="2" y="2" width="316" height="${H - 4}" rx="8" fill="${THEME.dark ? "#0f1a2c" : "#f7f9fc"}" stroke="${cGrid()}"/>
              <rect x="2" y="2" width="316" height="${H - 4}" rx="8" fill="url(#floorGridAU)"/>
              ${a.map((m, i) => {
                const col = i % cols, row = Math.floor(i / cols);
                const x = 12 + col * 60, y = 10 + row * 62;
                const label = (m.name || "").replace(/\s+/g, " ");
                return `
                <g class="asset-station" data-ai="${i}" style="cursor:pointer">
                  <title>${label} — ${m.statusLabel} — ${m.utilization}% utilization · click for details</title>
                  <rect x="${x}" y="${y}" width="50" height="52" rx="7" fill="${m.color}" fill-opacity="0.12" stroke="${m.color}" stroke-opacity="0.6" stroke-width="1.3"/>
                  <circle cx="${x + 9}" cy="${y + 9}" r="3" fill="${m.color}" class="blip"/>
                  <text x="${x + 25}" y="${y + 26}" text-anchor="middle" font-size="13.5" font-weight="800" fill="${cInk()}">${m.utilization}<tspan font-size="8" opacity="0.5">%</tspan></text>
                  <text x="${x + 25}" y="${y + 40}" text-anchor="middle" font-size="6.4" fill="${cInk()}" opacity="0.6" font-weight="600">${label}</text>
                </g>`;
              }).join("")}
            </svg>
            <div class="flex items-center gap-3 mt-2 text-[10px] text-ink/55">
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-ok"></span>Running</span>
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-warn"></span>Underused</span>
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-accent"></span>Maintenance due</span>
            </div>`;
          })()}`,
        caption: "Reducing loss, idle time, and hidden capacity waste."
      })}

      ${card({
        title: "Energy Optimization",
        info: "Production volume against utility cost per unit. As volume rises the cost per unit falls — a learning curve that exposes efficiency gains.",
        body: `<div class="h-[180px]"><canvas id="energyChart"></canvas></div>`,
        caption: "Identifying inefficiencies to reduce utility cost per unit."
      })}

      ${card({
        title: "Facility Optimization",
        info: "Key building systems. HVAC load and grid carbon are pulled live from real weather and electricity-grid data.",
        span: 2,
        body: `
          <div class="grid grid-cols-3 gap-4 pt-2">
            ${data.facility.map(f => ({l:f.label, v:f.value, color:f.color, icon:f.icon})).map(g => `
              <div class="text-center">
                <svg viewBox="0 0 70 70" class="w-full h-[80px]">
                  <circle cx="35" cy="35" r="28" stroke="#e5eaf1" stroke-width="5" fill="none"/>
                  <circle cx="35" cy="35" r="28" stroke="${g.color}" stroke-width="5" fill="none"
                    stroke-dasharray="${Math.PI*2*28}" stroke-dashoffset="${Math.PI*2*28*0.35}" transform="rotate(-90 35 35)"
                    stroke-linecap="round" />
                  <text x="35" y="34" text-anchor="middle" font-size="14" font-weight="700" fill="${cInk()}">${g.v}</text>
                  <text x="35" y="46" text-anchor="middle" font-size="9" fill="${cInk()}" opacity="0.6">${g.icon}</text>
                </svg>
                <div class="text-[11px] font-semibold text-ink/75 mt-1">${g.l}</div>
              </div>
            `).join("")}
          </div>`,
        caption: "Improving plant-wide operational efficiency."
      })}
    </div>
  `);

  CHART_INIT.plant = (payload) => {
    // Predictive-maintenance gauge hover tooltip
    const gauge = document.getElementById("pm-gauge");
    const pmtip = document.getElementById("pm-tip");
    if (gauge && pmtip) {
      const d = gauge.dataset;
      const band = d.risk >= 80 ? "Critical" : d.risk >= 50 ? "Elevated" : "Healthy";
      const bc = d.risk >= 80 ? "#d8581f" : d.risk >= 50 ? "#e7a93a" : "#5e9f55";
      pmtip.innerHTML =
        `<div class="font-bold text-[12px] leading-tight">${d.asset}</div>
         <div class="text-[10px] opacity-60">${d.kind}</div>
         <div class="mt-1 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background:${bc}"></span><span class="text-[11px]">${band} · failure risk ${d.risk}%</span></div>
         <div class="text-[11px] mt-0.5">Est. ${d.hours} hrs of useful life left</div>`;
      gauge.addEventListener("mouseenter", () => pmtip.classList.add("show"));
      gauge.addEventListener("mousemove", (e) => {
        const r = gauge.getBoundingClientRect();
        let x = e.clientX - r.left + 14, y = e.clientY - r.top + 12;
        x = Math.min(x, r.width - 170);
        pmtip.style.left = Math.max(0, x) + "px";
        pmtip.style.top = y + "px";
      });
      gauge.addEventListener("mouseleave", () => pmtip.classList.remove("show"));
    }

    // Asset Utilization: click a machine tile -> detail modal
    const auAssets = (payload.assetUtil && payload.assetUtil.assets) || [];
    document.querySelectorAll(".asset-station[data-ai]").forEach((g) => {
      g.addEventListener("click", () => {
        const a = auAssets[parseInt(g.dataset.ai, 10)];
        if (a) openAssetModal(a);
      });
    });

    // Waterfall (stacked bar trick) - bars computed from the OEE losses.
    const wf = document.getElementById("waterfallOEE");
    if (wf) {
      const o = payload.oee;
      const afterAvail = 100 - o.availabilityLoss;
      const afterPerf  = afterAvail - o.performanceLoss;
      const afterQual  = afterPerf - o.qualityLoss;
      // base values to lift bars from 0
      const data = [
        { label:"Total Time",   bottom:0,          size:100,               color:"#16345f", val:"100%" },
        { label:"Availability", bottom:afterAvail, size:o.availabilityLoss, color:"#9aa7bd", val:`-${o.availabilityLoss}%` },
        { label:"Performance",  bottom:afterPerf,  size:o.performanceLoss,  color:"#9aa7bd", val:`-${o.performanceLoss}%` },
        { label:"Quality",      bottom:afterQual,  size:o.qualityLoss,      color:"#9aa7bd", val:`-${o.qualityLoss}%` },
        { label:"Actual OEE",   bottom:0,          size:o.actualOEE,        color:"#5e9f55", val:`${o.actualOEE}%` },
      ];
      registerChart(new Chart(wf, {
        type: "bar",
        data: {
          labels: data.map(d => d.label),
          datasets: [
            { label:"base", data: data.map(d => d.bottom), backgroundColor:"rgba(0,0,0,0)", stack:"a" },
            { label:"val",  data: data.map(d => d.size),
              backgroundColor: data.map(d => d.color), borderRadius:3, stack:"a", maxBarThickness: 40 },
          ]
        },
        options: {
          plugins: {
            legend:{display:false},
            tooltip: ttip({
              // skip the invisible "base" lifter dataset; show the real step
              filter: (item) => item.datasetIndex === 1,
              title: (items) => data[items[0].dataIndex].label,
              label: (ctx) => {
                const d = data[ctx.dataIndex];
                return d.label === "Total Time" ? "Planned production time: 100%"
                  : d.label === "Actual OEE" ? `Actual OEE: ${d.val}`
                  : `${d.label} loss: ${d.val}`;
              },
            }),
          },
          scales: {
            x: { grid:{display:false}, ticks:{ color:cInk(), font:{size:10, weight:"600"} } },
            y: { display:false, min:0, max:110 }
          },
          animation: { duration: 1000, easing: "easeOutQuart" }
        },
        plugins: [{
          id:"wfLabels",
          afterDatasetsDraw(chart) {
            const ctx = chart.ctx;
            const meta = chart.getDatasetMeta(1);
            ctx.fillStyle = cInk();
            ctx.font = "700 11px Inter";
            ctx.textAlign = "center";
            meta.data.forEach((bar, i) => {
              const top = bar.y;
              ctx.fillText(data[i].val, bar.x, top - 6);
            });
          }
        }]
      }));
    }

    // Energy chart
    const en = document.getElementById("energyChart");
    if (en) {
      registerChart(new Chart(en, {
        type:"line",
        data: {
          labels: payload.energy.labels,
          datasets: [
            { label:"Production Volume", data:payload.energy.production, borderColor:cLine(), borderWidth:2.4, pointRadius:0, tension:0.45, fill:false },
            { label:"Utility Cost per Unit", data:payload.energy.costPerUnit, borderColor:"#5e9f55", borderWidth:2.4, pointRadius:0, tension:0.45, fill:false },
          ]
        },
        options: {
          interaction: { mode: "index", intersect: false },
          plugins:{
            legend:{display:false},
            tooltip: ttip({
              title: (items) => items[0].label,
              label: (ctx) => ctx.dataset.label === "Production Volume"
                ? `Production volume index: ${Math.round(ctx.parsed.y)}`
                : `Utility cost / unit index: ${Math.round(ctx.parsed.y)}`,
            }),
          },
          scales: {
            x: { grid:{display:false}, ticks:{ color:cInk(), font:{size:11, weight:"600"} } },
            y: { display:false, min:0, max:90 }
          },
          animation: { duration: 1100, easing:"easeOutQuart" }
        },
        plugins: [{
          id:"endLabels",
          afterDatasetsDraw(chart) {
            const ctx = chart.ctx;
            ctx.font = "600 10.5px Inter";
            ctx.fillStyle = cInk();
            ctx.fillText("Production Volume", chart.scales.x.getPixelForValue(1.4), chart.scales.y.getPixelForValue(50));
            ctx.fillStyle = "#41733a";
            ctx.fillText("Utility Cost per Unit", chart.scales.x.getPixelForValue(1.4), chart.scales.y.getPixelForValue(40));
          }
        }]
      }));
    }
  };

  // ============================================================
  // MODULE 4 — SUPPLY CHAIN
  // ============================================================
  RENDERERS.supply = (data) => $h(`
    <div class="grid-modules">
      ${card({
        title: "Real-Time Inventory Signals",
        info: "SKUs distributed by days of cover. The left hump is stock-out risk, the right hump is excess stock; the goal is more SKUs in the optimised middle.",
        body: `<div class="h-[180px]"><canvas id="invSignals"></canvas></div>`,
        caption: "Reducing stock-outs, excess stock, and obsolescence."
      })}

      ${card({
        title: "Automated Procurement",
        info: "Each vendor's Trust Score = 60% on-time delivery + 40% quality history. The AI routes new purchase orders to the highest-trust vendors automatically.",
        body: `
          <div class="text-[10.5px] text-ink/45 mb-2.5">Trust Score = 60% on-time delivery + 40% quality. Higher = more auto-routed orders.</div>
          <div class="space-y-2.5">
            ${data.vendors.map(v => `
              <div class="p-3 rounded-xl bg-slateBg/60 border border-cardLine">
                <div class="flex items-center justify-between text-[12px]">
                  <span class="font-bold text-ink">${v.name}</span>
                  <span class="font-bold ${v.trustScore >= 90 ? "text-ok" : v.trustScore >= 80 ? "text-brand" : "text-warn"}">Trust ${v.trustScore}%</span>
                </div>
                <div class="bar-track mt-2"><div class="bar-fill" style="width:${v.trustScore}%"></div></div>
                <div class="flex items-center gap-4 mt-1.5 text-[10px] text-ink/50">
                  <span>⏱ ${v.onTime}% on-time</span>
                  <span>✓ ${v.quality}% quality</span>
                </div>
              </div>`).join("")}
          </div>`,
        caption: "Reducing sourcing friction and buying cost."
      })}

      ${card({
        title: "Warehouse Slotting & Routing",
        info: "ABC slotting by pick velocity. Fast-movers belong near the pick face (low travel). High pick efficiency + low average travel distance = lower handling cost.",
        body: `
          <div class="grid grid-cols-2 gap-2 mb-2">
            <div class="p-2.5 rounded-xl bg-brand/5 text-center" title="Share of picks coming from fast, low-travel zones">
              <div class="text-xl font-extrabold text-brand leading-none">${data.warehouse.pickEfficiency}%</div>
              <div class="text-[10px] text-ink/55 font-semibold mt-0.5">Pick efficiency</div>
            </div>
            <div class="p-2.5 rounded-xl bg-slateBg text-center" title="Average metres a picker walks per item">
              <div class="text-xl font-extrabold text-ink leading-none">${data.warehouse.avgTravel}<span class="text-xs text-ink/40">m</span></div>
              <div class="text-[10px] text-ink/55 font-semibold mt-0.5">Avg travel / pick</div>
            </div>
          </div>
          <div class="text-[10.5px] text-ink/45 mb-2">Zones A–F hold goods by pick speed (Fast → Slow). "% full" = how occupied each zone is.</div>
          <div class="space-y-1.5">
            ${data.warehouse.zones.map(z => {
              const kc = z.klass === "Fast" ? "#1f4e9b" : z.klass === "Medium" ? "#3f86d6" : "#9aa7bd";
              return `
              <div class="flex items-center gap-2" title="Zone ${z.zone} · ${z.klass}-movers · ${z.picks} picks/hr · ${z.travel}m avg travel">
                <span class="w-6 h-6 rounded-md grid place-items-center text-[11px] font-bold text-white shrink-0" style="background:${kc}">${z.zone}</span>
                <div class="flex-1 min-w-0">
                  <div class="flex justify-between text-[10px] text-ink/55 mb-0.5"><span>${z.klass}-movers · ${z.picks}/hr</span><span>${z.utilization}% full</span></div>
                  <div class="h-1.5 rounded-full bg-cardLine overflow-hidden"><div class="h-full rounded-full" style="width:${z.utilization}%;background:${kc}"></div></div>
                </div>
                ${z.reslot ? `<span class="text-[9px] font-bold text-accent shrink-0" title="AI recommends re-slotting this zone closer to the pick face">RESLOT</span>` : `<span class="w-[42px] shrink-0"></span>`}
              </div>`;
            }).join("")}
          </div>
          ${data.warehouse.reslotSuggestions ? `<div class="mt-2 text-[10.5px] text-accent/80 font-medium">⚠ ${data.warehouse.reslotSuggestions} zone${data.warehouse.reslotSuggestions === 1 ? "" : "s"} flagged: a fast item sits in a slow zone — re-slotting cuts travel.</div>` : `<div class="mt-2 text-[10.5px] text-ok/80 font-medium">✓ Slotting optimal — no re-slotting needed.</div>`}`,
        caption: "Lowering handling cost and cycle time."
      })}

      ${card({
        title: "Fleet Optimization",
        info: "Live status of every vehicle in transit — route, ETA and load. Delayed shipments are flagged first with their cause.",
        body: `
          <div class="flex items-center gap-2 mb-3">
            <span class="px-2.5 py-1 rounded-lg bg-ok/10 text-ok text-[11px] font-bold">${data.fleet.onTime} on-time</span>
            <span class="px-2.5 py-1 rounded-lg bg-accent/10 text-accent text-[11px] font-bold">${data.fleet.delayed} delayed</span>
            <span class="ml-auto text-[11px] text-ink/45 font-semibold">${data.fleet.total} vehicles</span>
          </div>
          <div class="space-y-2 max-h-[128px] overflow-y-auto pr-1">
            ${data.fleet.vehicles.map(v => `
              <div class="flex items-center gap-2.5 p-2 rounded-lg border border-cardLine ${v.status === "delayed" ? "bg-accent/5" : "bg-white"}">
                <span class="w-2 h-2 rounded-full shrink-0 ${v.status === "delayed" ? "bg-accent animate-pulse" : "bg-ok"}"></span>
                <div class="min-w-0 flex-1">
                  <div class="text-[12px] font-semibold text-ink truncate">${v.route}</div>
                  <div class="text-[10.5px] text-ink/50">${v.vehicle} · ${v.load}% load${v.reason ? ` · ${v.reason}` : ""}</div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-[12px] font-bold ${v.status === "delayed" ? "text-accent" : "text-ink/75"}">${v.eta}h</div>
                  <div class="text-[9.5px] uppercase tracking-wide ${v.status === "delayed" ? "text-accent" : "text-ok"} font-semibold">${v.status}</div>
                </div>
              </div>`).join("")}
          </div>`,
        caption: "Route, delay, and fuel-consumption analytics."
      })}

      ${card({
        title: "Back-Office Automation",
        info: "Order documents flow through data entry → validation → generation. 'Standard' orders auto-process straight-through; outliers route to a human. Each automated doc saves ~4 minutes.",
        span: 2,
        body: (() => {
          const b = data.backoffice;
          return `
          <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div class="md:col-span-4 grid grid-cols-3 gap-2 text-center">
              <div class="p-2.5 rounded-xl bg-slateBg"><div class="text-lg font-extrabold text-ink leading-none">${b.documents.toLocaleString()}</div><div class="text-[9.5px] text-ink/50 mt-0.5">Docs / yr</div></div>
              <div class="p-2.5 rounded-xl bg-brand/5"><div class="text-lg font-extrabold text-brand leading-none">${b.autoRate}%</div><div class="text-[9.5px] text-ink/50 mt-0.5">Automated</div></div>
              <div class="p-2.5 rounded-xl bg-ok/8"><div class="text-lg font-extrabold text-ok leading-none">${b.hoursSaved.toLocaleString()}</div><div class="text-[9.5px] text-ink/50 mt-0.5">Hours saved</div></div>
            </div>
            <div class="md:col-span-8">
              <div class="flex items-center gap-1.5">
                ${b.steps.map((s, i) => `
                  <div class="flex-1 text-center px-2 py-2 rounded-lg bg-slateBg border border-cardLine text-[10.5px] font-semibold text-ink/70">${s}</div>
                  <div class="text-ok shrink-0 font-bold">→</div>`).join("")}
                <div class="flex-1 text-center px-2 py-2 rounded-lg bg-ok/10 border border-ok/40 text-[10.5px] font-bold text-ok">Automated Output</div>
              </div>
              <div class="mt-2.5 flex items-center gap-2">
                <div class="flex-1 h-2 rounded-full bg-slateBg overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-brand2 to-brand" style="width:${b.autoRate}%"></div></div>
                <span class="text-[11px] font-semibold text-ink/60 shrink-0">${b.manual.toLocaleString()} routed to human review</span>
              </div>
            </div>
          </div>`;
        })(),
        caption: "Automating workflows, documents, and repetitive tasks."
      })}
    </div>
  `);

  CHART_INIT.supply = (data) => {
    const inv = document.getElementById("invSignals");
    if (inv) {
      registerChart(new Chart(inv, {
        type:"line",
        data: {
          labels: data.inventory.labels,
          datasets: [
            { label:"Stock-out Risk", data: data.inventory.stockoutRisk, borderColor:"#c98b2e", backgroundColor:"rgba(231,169,58,0.45)", fill:true, pointRadius:0, tension:0.4, borderWidth:1.6 },
            { label:"Excess Stock",   data: data.inventory.excessStock, borderColor:"#a8b3c6", backgroundColor:"rgba(180,190,210,0.45)", fill:true, pointRadius:0, tension:0.4, borderWidth:1.6 },
          ]
        },
        options: {
          interaction: { mode: "index", intersect: false },
          plugins:{
            legend:{display:false},
            tooltip: ttip({
              title: (items) => `${items[0].label} days of cover`,
              label: (ctx) => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y)} (rel.)`,
            }),
          },
          scales:{
            x:{ display:false }, y:{ display:false, min:0, max:110 },
          },
          animation:{ duration: 1100, easing:"easeOutQuart" }
        },
        plugins: [{
          id:"invLabels",
          afterDatasetsDraw(chart) {
            const ctx = chart.ctx;
            ctx.font = "700 11px Inter";
            ctx.fillStyle = "#8a6516";
            ctx.fillText("Stock-out Risk", chart.scales.x.getPixelForValue(8), chart.scales.y.getPixelForValue(55));
            ctx.fillStyle = "#4b566b";
            ctx.fillText("Excess Stock", chart.scales.x.getPixelForValue(36), chart.scales.y.getPixelForValue(55));
            ctx.fillStyle = cInk();
            ctx.font = "600 10px Inter";
            ctx.fillText("Optimized Zone", chart.scales.x.getPixelForValue(27), chart.scales.y.getPixelForValue(95));
            ctx.fillStyle = cInk();
            ctx.font = "italic 600 10px Inter";
            ctx.fillText("Probability", 6, 14);
          }
        }]
      }));
    }
  };

  // ============================================================
  // MODULE 5 — QUALITY
  // ============================================================
  RENDERERS.quality = (data) => $h(`
    <div class="grid-modules">
      ${card({
        title: "Vision-Based Inspection",
        info: "An AI camera scans each part. Orange boxes mark detected defects (with their type). The unit only passes if zero defects are found; the line pass rate is the share of parts that pass.",
        body: (() => {
          const d = data.defects, boxes = d.boxes || [], pass = d.verdict === "PASS";
          return `
          <div class="text-[10.5px] text-ink/45 mb-2">AI camera scans each part top-to-bottom; orange boxes flag defects in real time. Zero defects = PASS.</div>
          <div class="grid grid-cols-1 md:grid-cols-5 gap-4 items-stretch">
            <div class="md:col-span-3 relative h-[196px] rounded-xl overflow-hidden bg-gradient-to-br from-slateBg to-cardLine">
              <div class="vision-scan-line"></div>
              <div class="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-ink/70 text-white text-[10px] font-semibold flex items-center gap-1.5 z-10">
                <span class="w-1.5 h-1.5 rounded-full bg-ok animate-pulse"></span>AI Vision · live
              </div>
              <svg viewBox="0 0 320 180" class="w-full h-full">
                <defs>
                  <radialGradient id="metal" cx="50%" cy="50%" r="60%">
                    <stop offset="0" stop-color="#cdd6e5"/><stop offset="1" stop-color="#5e6b80"/>
                  </radialGradient>
                </defs>
                <circle cx="120" cy="90" r="70" fill="url(#metal)"/>
                <g stroke="#3c4658" stroke-width="1.5" fill="#8e98ab">
                  ${Array.from({length: 10}).map((_,i) => {
                    const a = (i/10)*Math.PI*2, x = 120 + Math.cos(a)*55, y = 90 + Math.sin(a)*55;
                    return `<ellipse cx="${x}" cy="${y}" rx="14" ry="6" transform="rotate(${(a*180/Math.PI)} ${x} ${y})"/>`;
                  }).join("")}
                </g>
                <circle cx="120" cy="90" r="20" fill="#3c4658"/>
                <rect x="190" y="80" width="120" height="20" fill="#8e98ab" stroke="#3c4658"/>
                <rect x="285" y="76" width="12" height="28" fill="#5e6b80"/>
                ${boxes.map(b => `
                  <g>
                    <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="2" fill="none" stroke="#d8581f" stroke-width="2" class="vision-box"/>
                    <rect x="${b.x}" y="${b.y - 12}" width="${b.kind.length * 4.6 + 8}" height="11" rx="2" fill="#d8581f"/>
                    <text x="${b.x + 4}" y="${b.y - 3.5}" font-size="7.2" fill="#fff" font-weight="700" class="capitalize">${b.kind}</text>
                  </g>`).join("")}
              </svg>
            </div>
            <div class="md:col-span-2 flex flex-col">
              <div class="flex items-center gap-2.5 p-3 rounded-xl ${pass ? "bg-ok/10" : "bg-accent/10"}">
                <span class="w-9 h-9 rounded-lg grid place-items-center text-white font-bold text-lg ${pass ? "bg-ok" : "bg-accent"}">${pass ? "✓" : "!"}</span>
                <div>
                  <div class="text-lg font-extrabold ${pass ? "text-ok" : "text-accent"}">${d.verdict}</div>
                  <div class="text-[11px] text-ink/55">${d.count} defect${d.count === 1 ? "" : "s"} on this unit</div>
                </div>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-center">
                <div class="p-2 rounded-lg bg-slateBg"><div class="text-base font-bold text-ink">${d.passRate}%</div><div class="text-[9.5px] text-ink/50">Line pass rate</div></div>
                <div class="p-2 rounded-lg bg-slateBg"><div class="text-base font-bold text-ink">${d.count}</div><div class="text-[9.5px] text-ink/50">Defects flagged</div></div>
              </div>
              <div class="mt-3 text-[10px] uppercase tracking-wide text-ink/45 font-semibold">Detected defects</div>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                ${d.count ? boxes.map(b => `<span class="px-2 py-1 rounded-md bg-accent/10 text-accent text-[10.5px] font-semibold capitalize">${b.kind}</span>`).join("") : `<span class="text-[11px] text-ink/40">None — clean part ✓</span>`}
              </div>
            </div>
          </div>`;
        })(),
        caption: "Automating inspection to improve consistency.",
        span: 2
      })}

      ${card({
        title: "Predictive Quality Models",
        info: "Distribution of a quality score across inspections. Units below the threshold fall into the rework-risk zone on the left; most units pass.",
        body: `<div class="h-[210px]"><canvas id="qualityDist"></canvas></div>`,
        caption: "Reducing scrap, rework, and escapes."
      })}

      ${card({
        title: "Automated Root-Cause Analysis",
        info: "Every detected defect is rolled up to its root-cause category (Machine, Material, Method). The top driver is where to focus corrective action.",
        body: `
          <div class="flex items-center gap-2 mb-3 p-2.5 rounded-xl bg-accent/8 border border-accent/20">
            <span class="w-8 h-8 rounded-lg bg-accent text-white grid place-items-center shrink-0 text-sm font-bold">${data.rootCause.top[0]}</span>
            <div>
              <div class="text-[10.5px] uppercase tracking-wide text-ink/45 font-semibold">Top defect driver</div>
              <div class="text-sm font-bold text-ink">${data.rootCause.top} — ${data.rootCause.drivers[0].pct}% of ${data.rootCause.total} defects</div>
            </div>
          </div>
          <div class="space-y-3">
            ${data.rootCause.drivers.map((d, i) => `
              <div>
                <div class="flex items-center justify-between text-[12px] mb-1">
                  <span class="font-semibold text-ink/80">${d.name}</span>
                  <span class="text-ink/55 font-semibold">${d.pct}%</span>
                </div>
                <div class="h-2.5 rounded-full bg-slateBg overflow-hidden">
                  <div class="h-full rounded-full" style="width:${d.pct}%;background:${i === 0 ? "#d8581f" : i === 1 ? "#e7a93a" : "#9aa7bd"}"></div>
                </div>
              </div>`).join("")}
          </div>`,
        caption: "Pinpointing defect drivers faster."
      })}

      ${card({
        title: "Process Digital Twins",
        info: "A live virtual replica of the asset. Sensor setpoints for pressure, temperature and speed can be simulated before touching the real machine.",
        body: `
          <div class="grid grid-cols-5 gap-3 items-center">
            <svg viewBox="0 0 130 130" class="col-span-2 w-full h-[130px]">
              <defs>
                <radialGradient id="m2" cx="50%" cy="50%" r="60%">
                  <stop offset="0" stop-color="#cdd6e5"/>
                  <stop offset="1" stop-color="#5e6b80"/>
                </radialGradient>
              </defs>
              <circle cx="65" cy="65" r="45" fill="url(#m2)"/>
              <g stroke="#3c4658" stroke-width="1.4" fill="#8e98ab">
                ${Array.from({length: 12}).map((_,i) => {
                  const a = (i/12)*Math.PI*2;
                  const x = 65 + Math.cos(a)*36;
                  const y = 65 + Math.sin(a)*36;
                  return `<ellipse cx="${x}" cy="${y}" rx="10" ry="4" transform="rotate(${(a*180/Math.PI)} ${x} ${y})"/>`;
                }).join("")}
              </g>
              <circle cx="65" cy="65" r="14" fill="#3c4658"/>
            </svg>
            <div class="col-span-3 space-y-3">
              ${data.digitalTwin.map(s => ({l:s.label, v:s.value, p:s.pct})).map(s => `
                <div>
                  <div class="flex items-center justify-between text-[11px] text-ink/60 mb-1"><span>${s.l}</span><span class="font-semibold text-ink">${s.v}</span></div>
                  <div class="slider-row">
                    <div class="slider-track"><div class="slider-fill" style="width:${s.p}%"></div><div class="slider-knob" style="left:${s.p}%"></div></div>
                  </div>
                </div>`).join("")}
            </div>
          </div>`,
        caption: "Simulation and quality optimization before physical changes."
      })}

      ${card({
        title: "Worker Safety Analytics",
        info: "Recordable safety incidents per quarter, trending down as AI monitoring and adherence improve.",
        body: `<div class="h-[180px]"><canvas id="safetyBar"></canvas></div>`,
        caption: "Reducing incidents and improving adherence."
      })}
    </div>
  `);

  CHART_INIT.quality = (data) => {
    // Skewed distribution
    const dist = document.getElementById("qualityDist");
    const threshold = data.qualityDist.reworkThreshold;
    if (dist) {
      registerChart(new Chart(dist, {
        type: "line",
        data: {
          labels: data.qualityDist.labels,
          datasets: [
            { data: data.qualityDist.values, borderColor:cLine(), backgroundColor:"#16345f", fill:true, pointRadius:0, tension:0.4, borderWidth:1.4,
              segment: { backgroundColor: ctx => ctx.p0.parsed.x < threshold ? "#d8581f" : "#16345f" } }
          ]
        },
        options: {
          interaction: { mode: "index", intersect: false },
          plugins:{
            legend:{display:false},
            tooltip: ttip({
              title: (items) => `Quality score ${items[0].label}`,
              label: (ctx) => Number(ctx.label) < threshold
                ? `Rework-risk zone · freq ${Math.round(ctx.parsed.y)}`
                : `In-spec · freq ${Math.round(ctx.parsed.y)}`,
            }),
          },
          scales:{ x:{ display:false }, y:{ display:false } },
          animation:{ duration: 1100, easing:"easeOutQuart" }
        },
        plugins: [{
          id:"distLine",
          afterDatasetsDraw(chart) {
            const ctx = chart.ctx;
            const xPix = chart.scales.x.getPixelForValue(threshold);
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(xPix, chart.chartArea.top); ctx.lineTo(xPix, chart.chartArea.bottom); ctx.stroke();
            ctx.fillStyle = cInk();
            ctx.font = "600 10px Inter";
            ctx.fillText("Probability of Rework", chart.chartArea.left + 4, chart.chartArea.bottom - 4);
          }
        }]
      }));
    }
    // Safety bar
    const sb = document.getElementById("safetyBar");
    if (sb) {
      registerChart(new Chart(sb, {
        type: "bar",
        data: {
          labels: data.safety.labels,
          datasets: [{ data:data.safety.incidents, backgroundColor:["#a7c79d","#a7c79d","#a7c79d","#5e9f55"], borderRadius: 6, maxBarThickness: 36 }]
        },
        options: {
          plugins:{
            legend:{display:false},
            tooltip: ttip({
              title: (items) => items[0].label,
              label: (ctx) => `${ctx.parsed.y} recordable incidents`,
            }),
          },
          scales:{
            x:{ grid:{display:false}, ticks:{ color:cInk(), font:{size:11, weight:"600"} } },
            y:{ display:false, min:0, max:100, title:{display:true, text:"Incidents"} },
          },
          animation:{ duration: 1000, easing:"easeOutQuart" }
        },
        plugins: [{
          id:"sLabel",
          beforeDraw(chart) {
            const ctx = chart.ctx;
            ctx.save();
            ctx.translate(14, chart.chartArea.top + (chart.chartArea.bottom-chart.chartArea.top)/2);
            ctx.rotate(-Math.PI/2);
            ctx.fillStyle = cInk(); ctx.font = "italic 600 10px Inter";
            ctx.textAlign = "center";
            ctx.fillText("Incidents", 0, 0);
            ctx.restore();
          }
        }]
      }));
    }
  };

  // ============================================================
  // MODULE 6 — PRODUCTIVITY
  // ============================================================
  RENDERERS.productivity = (data) => $h(`
    <div class="grid-modules">
      ${card({
        title: "Production Scheduling",
        info: "Each line's production-run vs changeover blocks across the year. The % is the line's uptime share; the dashed line marks today. Hover any block for details.",
        body: (() => {
          const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          const d = new Date();
          const nowPct = ((d.getMonth() + d.getDate() / 31) / 12) * 100;
          return `
          <div class="text-[10.5px] text-ink/45 mb-2.5">Each row is a production line across the year. Navy = producing, amber = changeover/setup. The % is the line's uptime; the dashed line is today.</div>
          <div class="space-y-2.5">
            <div class="flex items-center gap-2">
              <div class="w-16"></div>
              <div class="grid grid-cols-12 flex-1 text-[9.5px] text-ink/50 font-semibold">
                ${MO.map(m=>`<div class="text-center">${m}</div>`).join("")}
              </div>
              <div class="w-9"></div>
            </div>
            ${data.schedule.map(r => `
              <div class="flex items-center gap-2">
                <div class="w-16 text-[11px] font-semibold text-ink/70 truncate">${r.name}</div>
                <div class="relative flex-1 h-5 rounded-full bg-slateBg overflow-hidden">
                  ${r.segs.map(s => `
                    <div class="absolute top-0 bottom-0 sched-seg"
                      title="${r.name} · ${MO[s.s]}–${MO[Math.min(11, s.e-1)]} · ${s.kind === 'run' ? 'Production run' : 'Changeover'}"
                      style="left:${(s.s/12)*100}%; width:${((s.e-s.s)/12)*100}%; background:${s.c}"></div>`).join("")}
                  <div class="absolute top-0 bottom-0 w-px bg-ink/45 z-10" style="left:${nowPct}%"></div>
                </div>
                <div class="w-9 text-[11px] font-bold text-ink/70 text-right">${r.runPct}%</div>
              </div>`).join("")}
            <div class="flex items-center gap-4 text-[10px] text-ink/55 pt-1">
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" style="background:#16345f"></span>Production run</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" style="background:#e7a93a"></span>Changeover</span>
              <span class="flex items-center gap-1.5"><span class="w-px h-3 bg-ink/45"></span>Today</span>
              <span class="ml-auto text-ink/40">% = uptime share</span>
            </div>
          </div>`;
        })(),
        caption: "Increasing throughput and reducing cycle time.",
        span: 2
      })}

      ${card({
        title: "Operator Copilots",
        info: "Pick a machine fault and click Generate — the on-device AI copilot thinks, then produces the step-by-step fix for that machine.",
        body: `
          <div class="tablet">
            <div class="tablet-screen flex flex-col" style="min-height:212px">
              <div class="flex items-center gap-2">
                <select id="op-select" class="cp-select flex-1" aria-label="Choose a machine fault"></select>
                <button id="op-run" class="cp-go">Generate fix</button>
              </div>
              <div class="mt-2 flex items-center gap-2 px-3 py-2 rounded-full bg-brand text-white text-[11px] font-semibold min-h-[34px]">
                <span class="opacity-70">›</span><span id="op-query" class="opacity-70">Select a fault and click Generate fix…</span><span id="op-caret" class="copilot-cursor" style="display:none"></span>
              </div>
              <div id="op-steps" class="grid grid-cols-4 gap-2 mt-2.5 flex-1 content-start"></div>
              <div id="op-status" class="mt-1.5 text-[10px] text-ink/45"></div>
            </div>
          </div>`,
        caption: "Improving decision quality and execution speed."
      })}

      ${card({
        title: "AI Service Desk",
        info: "The real ticket pipeline: AI auto-resolves routine cases and routes the rest. Numbers come from the live ticket queue.",
        body: `
          <div class="grid grid-cols-3 gap-2 mb-3">
            <div class="text-center p-2.5 rounded-xl bg-slateBg">
              <div class="text-xl font-extrabold text-ink">${data.serviceDesk.incoming}</div>
              <div class="text-[10px] text-ink/55 font-semibold">Incoming</div>
            </div>
            <div class="text-center p-2.5 rounded-xl bg-brand/5">
              <div class="text-xl font-extrabold text-brand">${data.serviceDesk.triaged + data.serviceDesk.open}</div>
              <div class="text-[10px] text-ink/55 font-semibold">Routed</div>
            </div>
            <div class="text-center p-2.5 rounded-xl bg-ok/8">
              <div class="text-xl font-extrabold text-ok">${data.serviceDesk.resolved}</div>
              <div class="text-[10px] text-ink/55 font-semibold">Resolved</div>
            </div>
          </div>
          <div class="flex items-center justify-between text-[11px] mb-1.5">
            <span class="font-semibold text-ink/70">AI auto-resolution rate</span>
            <span class="font-bold text-ok">${data.serviceDesk.autoResolvePct}%</span>
          </div>
          <div class="h-2.5 rounded-full bg-slateBg overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r from-ok to-okSoft" style="width:${data.serviceDesk.autoResolvePct}%"></div>
          </div>
          <div class="mt-2 text-[11px] text-ink/45">${data.serviceDesk.open} cases escalated to a human agent.</div>`,
        caption: "Accelerating internal support operations."
      })}

      ${card({
        title: "Alert Prioritization",
        info: "A single prioritized feed that fuses signals from maintenance, inventory, the live supplier-risk map and the service desk — so teams act on what matters.",
        body: `
          ${data.alerts.length ? `
          <div class="space-y-2">
            ${data.alerts.map(a => `
              <div class="flex items-start gap-2.5 p-2.5 rounded-lg border border-cardLine ${a.level === "high" ? "bg-accent/5" : "bg-white"}">
                <span class="pill ${a.level === "high" ? "high" : "medium"} mt-0.5 shrink-0"><span class="pdot"></span>${a.level === "high" ? "High" : "Med"}</span>
                <div class="min-w-0">
                  <div class="text-[12px] font-semibold text-ink leading-snug">${a.title}</div>
                  <div class="text-[10.5px] text-ink/45 mt-0.5">${a.source}</div>
                </div>
              </div>`).join("")}
          </div>` : `<div class="h-[140px] grid place-items-center text-ink/40 text-sm">No active alerts — all systems nominal.</div>`}`,
        caption: "Reducing noise to focus teams on high-impact issues."
      })}

      ${card({
        title: "Engineering Knowledge Base",
        info: "Type a question (or pick a suggestion) and hit search. The AI ranks manuals, videos and procedures by relevance match and streams the results.",
        body: `
          <div class="flex items-center gap-2">
            <div class="kb-search flex-1">
              <span class="text-ink/45">🔎</span>
              <input id="kb-input" type="text" placeholder="Search manuals, videos, procedures…" />
            </div>
            <button id="kb-go" class="cp-go" aria-label="Search">Search</button>
          </div>
          <div id="kb-suggest" class="flex flex-wrap gap-1.5 mt-2"></div>
          <div id="kb-results" class="mt-3 space-y-2 min-h-[140px]"></div>`,
        caption: "Reducing search time and raising productivity."
      })}
    </div>
  `);
  CHART_INIT.productivity = (data) => {
    const token = state.renderToken;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    // ---------- Operator Copilot: runs when "Generate fix" is clicked ----------
    (() => {
      const scenarios = data.operators || [];
      const selectEl = document.getElementById("op-select");
      const runBtn = document.getElementById("op-run");
      const qEl = document.getElementById("op-query");
      const stepsEl = document.getElementById("op-steps");
      const statusEl = document.getElementById("op-status");
      const caret = document.getElementById("op-caret");
      if (!selectEl || !stepsEl || !scenarios.length) return;
      let runId = 0;
      const alive = (my) => token === state.renderToken && my === runId && document.body.contains(qEl);

      selectEl.innerHTML = scenarios.map((s, i) =>
        `<option value="${i}">${s.asset} — ${s.query.split("— ")[1] || s.kind}</option>`).join("");

      async function run() {
        const idx = parseInt(selectEl.value, 10) || 0;
        const my = ++runId;
        const sc = scenarios[idx];
        runBtn.disabled = true; runBtn.textContent = "Working…";
        qEl.classList.remove("opacity-70");
        qEl.textContent = ""; stepsEl.innerHTML = ""; statusEl.textContent = "";
        caret.style.display = "inline-block";
        const words = sc.query.split(" ");
        for (let i = 0; i < words.length; i++) { if (!alive(my)) break; qEl.textContent = words.slice(0, i + 1).join(" "); await wait(44); }
        caret.style.display = "none";
        if (alive(my)) {
          statusEl.innerHTML = `<span class="inline-flex items-center gap-1.5"><span class="opacity-70">Generating fix</span><span class="op-think"><span class="tdot"></span><span class="tdot"></span><span class="tdot"></span></span></span>`;
          await wait(1150);
        }
        if (alive(my)) statusEl.textContent = "";
        for (const st of sc.steps) {
          if (!alive(my)) break;
          const el = document.createElement("div");
          el.className = "op-step p-2 rounded-md bg-white border border-cardLine text-center text-[9.5px] text-ink/70 font-semibold copilot-in";
          el.innerHTML = `<div class="text-base leading-none mb-0.5">${st.icon}</div>${st.n}. ${st.text}`;
          stepsEl.appendChild(el);
          await wait(420);
        }
        if (alive(my)) statusEl.innerHTML = `<span class="text-ok font-semibold">✓ Fix generated · logged to ${sc.asset}</span>`;
        if (my === runId) { runBtn.disabled = false; runBtn.textContent = "Generate fix"; }
      }
      runBtn.addEventListener("click", run);
    })();

    // ---------- Engineering KB: real search on click / Enter ----------
    (() => {
      const queries = data.knowledgeBase || [];
      const inputEl = document.getElementById("kb-input");
      const goBtn = document.getElementById("kb-go");
      const sugEl = document.getElementById("kb-suggest");
      const resEl = document.getElementById("kb-results");
      if (!inputEl || !resEl || !queries.length) return;
      let runId = 0;
      const alive = (my) => token === state.renderToken && my === runId && document.body.contains(resEl);

      // suggestion chips fill + run the search
      sugEl.innerHTML = queries.slice(0, 4).map((q) =>
        `<button class="kb-chip" data-q="${q.q.replace(/"/g, "&quot;")}">${q.q}</button>`).join("");
      sugEl.querySelectorAll("[data-q]").forEach((c) =>
        c.addEventListener("click", () => { inputEl.value = c.dataset.q; search(); }));

      // match free text to the closest predefined query by word overlap
      function bestMatch(text) {
        const words = text.toLowerCase().split(/\W+/).filter(Boolean);
        let best = queries[0], bestScore = -1;
        for (const q of queries) {
          const ql = q.q.toLowerCase();
          const score = words.reduce((s, w) => s + (ql.includes(w) ? 1 : 0), 0);
          if (score > bestScore) { bestScore = score; best = q; }
        }
        return best;
      }

      async function search() {
        const text = (inputEl.value || "").trim();
        if (!text) { resEl.innerHTML = `<div class="h-[120px] grid place-items-center text-ink/40 text-[12px]">Type a question and press Search.</div>`; return; }
        const my = ++runId;
        const sc = bestMatch(text);
        goBtn.disabled = true;
        resEl.innerHTML = `<div class="flex items-center gap-2 text-[12px] text-ink/55 py-3"><span class="w-3.5 h-3.5 rounded-full border-2 border-cardLine border-t-brand animate-spin"></span>Searching knowledge base…</div>`;
        await wait(900);
        if (!alive(my)) return;
        resEl.innerHTML = "";
        for (const r of sc.results) {
          if (!alive(my)) break;
          const el = document.createElement("div");
          el.className = "flex items-center gap-3 p-2.5 rounded-lg border border-cardLine bg-white text-[12px] copilot-in";
          el.innerHTML = `<span class="w-7 h-7 rounded-md bg-slateBg grid place-items-center shrink-0">${r.icon}</span>
            <div class="flex-1 min-w-0"><div class="text-ink/80 truncate">${r.title}</div>
            <div class="mt-1 h-1 rounded-full bg-cardLine overflow-hidden"><div class="h-full bg-brand rounded-full" style="width:${r.match}%"></div></div></div>
            <span class="text-[10.5px] font-bold text-brand shrink-0">${r.match}%</span>`;
          resEl.appendChild(el);
          await wait(320);
        }
        if (my === runId) goBtn.disabled = false;
      }
      goBtn.addEventListener("click", search);
      inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });
    })();
  };

  // ============================================================
  // OVERVIEW
  // ============================================================
  RENDERERS.overview = (data) => $h(`
    <div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        ${(data.kpis || []).map(k => `
          <div class="card p-4">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-ink/50">${k.label}</div>
            <div class="mt-1 flex items-end gap-2">
              <div class="text-2xl font-extrabold text-ink">${k.value}</div>
              <div class="text-[11px] font-semibold text-ok mb-1">${k.delta}</div>
            </div>
          </div>`).join("")}
      </div>
      <div class="grid-modules">
      ${MODULES.filter(m => m.id !== "overview").map((m, i) => `
        <article class="card">
          <div class="card-pad">
            <div class="text-[11px] uppercase tracking-[0.18em] font-semibold text-brand">${m.short}</div>
            <div class="mt-1 text-lg font-bold text-ink">${m.label}</div>
            <p class="mt-2 text-sm text-ink/65 leading-snug">${m.subtitle}</p>
            <button data-id="${m.id}" class="overview-jump mt-4 text-[12px] font-semibold text-brand hover:text-navyDeep transition">Open module →</button>
          </div>
        </article>`).join("")}
      </div>
    </div>
  `);
  CHART_INIT.overview = () => {
    document.querySelectorAll(".overview-jump").forEach(b =>
      b.addEventListener("click", () => setModule(b.dataset.id)));
  };

  // ---------- Live status badge ----------
  async function refreshLiveBadge() {
    const dot = document.getElementById("live-dot");
    const text = document.getElementById("live-text");
    if (!dot || !text) return;
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const h = await res.json();
      const live = h.live || {};
      const up = Object.values(live).filter((s) => s && s.ok).length;
      const total = Object.keys(live).length || 5;
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (h.anyLive) {
        dot.className = "w-1.5 h-1.5 rounded-full bg-ok";
        text.textContent = `Live · ${up}/${total} sources · ${now}`;
      } else {
        dot.className = "w-1.5 h-1.5 rounded-full bg-warn";
        text.textContent = "Offline — simulated data";
      }
    } catch (_) {
      dot.className = "w-1.5 h-1.5 rounded-full bg-warn";
      text.textContent = "Offline — simulated data";
    }
  }

  // ---------- Asset detail modal ----------
  let assetModal = null;
  function openAssetModal(a) {
    if (!assetModal) {
      assetModal = $h(`
        <div class="modal-root" id="asset-modal">
          <div class="modal-scrim"></div>
          <div class="modal-card" role="dialog" aria-modal="true"></div>
        </div>`);
      document.body.appendChild(assetModal);
      assetModal.querySelector(".modal-scrim").addEventListener("click", closeAssetModal);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAssetModal(); });
    }
    const C = 2 * Math.PI * 42;                       // ring circumference
    const offset = C * (1 - a.utilization / 100);
    const statusBg = a.status === "maintenance" ? "bg-accent/10 text-accent"
      : a.status === "idle" ? "bg-warn/10 text-warn" : "bg-ok/10 text-ok";
    assetModal.querySelector(".modal-card").innerHTML = `
      <button class="modal-close" aria-label="Close">✕</button>
      <div class="flex items-center gap-3 mb-4">
        <span class="w-11 h-11 rounded-xl grid place-items-center text-white text-lg font-bold shrink-0" style="background:${a.color}">${(a.kind[0] || "M")}</span>
        <div>
          <div class="text-lg font-extrabold text-ink leading-tight">${a.name}</div>
          <div class="text-[12px] text-ink/55">${a.kind} · ${a.line}</div>
        </div>
        <span class="ml-auto px-2.5 py-1 rounded-full text-[11px] font-bold ${statusBg}">${a.statusLabel}</span>
      </div>
      <div class="flex items-center gap-5">
        <div class="relative w-[120px] h-[120px] shrink-0">
          <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="${THEME.dark ? '#26374f' : '#e9eef7'}" stroke-width="9"/>
            <circle cx="50" cy="50" r="42" fill="none" stroke="${a.color}" stroke-width="9" stroke-linecap="round"
              stroke-dasharray="${C}" stroke-dashoffset="${C}" style="transition:stroke-dashoffset 1s var(--ease-out)" class="ring-fill"/>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <div class="text-2xl font-extrabold text-ink leading-none">${a.utilization}<span class="text-sm text-ink/40">%</span></div>
            <div class="text-[9px] text-ink/45 font-semibold uppercase tracking-wide">utilization</div>
          </div>
        </div>
        <div class="flex-1 grid grid-cols-2 gap-2.5">
          <div class="p-2.5 rounded-lg bg-slateBg"><div class="text-[15px] font-bold text-ink leading-none">${a.risk}%</div><div class="text-[10px] text-ink/50 mt-0.5">Failure risk</div></div>
          <div class="p-2.5 rounded-lg bg-slateBg"><div class="text-[15px] font-bold text-ink leading-none">${a.rul.toLocaleString()}h</div><div class="text-[10px] text-ink/50 mt-0.5">Remaining life</div></div>
          <div class="p-2.5 rounded-lg bg-slateBg"><div class="text-[15px] font-bold text-ink leading-none">${a.agePct}%</div><div class="text-[10px] text-ink/50 mt-0.5">Age (of design life)</div></div>
          <div class="p-2.5 rounded-lg bg-slateBg"><div class="text-[15px] font-bold text-ink leading-none">${a.line}</div><div class="text-[10px] text-ink/50 mt-0.5">Production line</div></div>
        </div>
      </div>
      <div class="mt-4 flex items-start gap-2.5 p-3 rounded-xl ${a.status === 'maintenance' ? 'bg-accent/8' : a.status === 'idle' ? 'bg-warn/8' : 'bg-ok/8'}">
        <span class="text-base leading-none mt-0.5">${a.status === 'maintenance' ? '⚠' : a.status === 'idle' ? '↘' : '✓'}</span>
        <div class="text-[12.5px] text-ink/75"><b>AI recommendation:</b> ${a.recommendation}</div>
      </div>`;
    assetModal.querySelector(".modal-close").addEventListener("click", closeAssetModal);
    assetModal.classList.add("show");
    requestAnimationFrame(() => {
      const ring = assetModal.querySelector(".ring-fill");
      if (ring) ring.style.strokeDashoffset = offset;
    });
  }
  function closeAssetModal() { if (assetModal) assetModal.classList.remove("show"); }

  // ---------- Guided walkthrough ----------
  const TOUR = [
    { id: null, title: "Welcome to the AI Portfolio", body: "Six composable AI modules that run standalone or as one operating system. Take a 60-second tour — each module updates live as we go." },
    { id: "revenue", title: "Module 1 · Revenue", body: "AI-driven pricing, demand forecasting and customer segmentation that unlock new revenue streams. Hover the charts to explore." },
    { id: "commercial", title: "Module 2 · Commercial Operations", body: "Prioritized cases, an animated support copilot, and a live supplier-risk map that reacts to real earthquakes (USGS)." },
    { id: "plant", title: "Module 3 · Plant Performance", body: "Predictive maintenance from a Weibull reliability model, OEE loss analysis, and a live shop-floor utilization view." },
    { id: "supply", title: "Module 4 · Supply Chain", body: "Inventory stock-out signals, vendor trust scores, ABC warehouse slotting, and live fleet status with delay reasons." },
    { id: "quality", title: "Module 5 · Quality Leadership", body: "Computer-vision inspection, predictive quality, automated defect root-cause, and a process digital twin." },
    { id: "productivity", title: "Module 6 · Speed & AI Copilots", body: "Production scheduling, an operator copilot that generates fixes step-by-step, and live engineering knowledge search." },
    { id: "__form", title: "See it on your data", body: "Request a personalized walkthrough and we'll tailor the modules to your plant and metrics." },
  ];
  let tourRoot = null, tourIdx = 0, tourDone = false;

  function buildTour() {
    tourRoot = $h(`
      <div class="tour-root" id="tour-root">
        <div class="tour-scrim"></div>
        <div class="tour-panel" role="dialog" aria-modal="true" aria-label="Guided walkthrough">
          <button class="tour-close" aria-label="Close tour">✕</button>
          <div class="tour-top">
            <span class="tour-badge">Guided tour</span>
            <span class="tour-step"></span>
          </div>
          <div class="tour-progress"><div class="tour-bar"></div></div>
          <h3 class="tour-title"></h3>
          <p class="tour-body"></p>
          <div class="tour-form"></div>
          <div class="tour-footer">
            <button class="tour-back">‹ Back</button>
            <div class="tour-dots"></div>
            <button class="tour-next">Next ›</button>
          </div>
        </div>
      </div>`);
    document.body.appendChild(tourRoot);
    tourRoot.querySelector(".tour-close").addEventListener("click", closeTour);
    tourRoot.querySelector(".tour-scrim").addEventListener("click", closeTour);
    tourRoot.querySelector(".tour-back").addEventListener("click", () => gotoTour(tourIdx - 1));
    tourRoot.querySelector(".tour-next").addEventListener("click", () => {
      if (tourDone) return closeTour();
      if (TOUR[tourIdx].id === "__form") submitTour();
      else gotoTour(tourIdx + 1);
    });
    const dots = tourRoot.querySelector(".tour-dots");
    dots.innerHTML = TOUR.map((_, i) => `<button class="tour-dot" data-td="${i}" aria-label="Step ${i + 1}"></button>`).join("");
    dots.querySelectorAll("[data-td]").forEach((d) =>
      d.addEventListener("click", () => gotoTour(parseInt(d.dataset.td, 10))));
  }

  function openTour() { if (!tourRoot) buildTour(); tourDone = false; tourRoot.classList.add("show"); gotoTour(0); }
  function closeTour() { if (tourRoot) tourRoot.classList.remove("show"); }

  function gotoTour(i) {
    tourDone = false;
    tourIdx = Math.max(0, Math.min(TOUR.length - 1, i));
    const step = TOUR[tourIdx], p = tourRoot;
    if (step.id && step.id !== "__form" && state.currentId !== step.id) setModule(step.id);
    p.querySelector(".tour-step").textContent = `${tourIdx + 1} / ${TOUR.length}`;
    p.querySelector(".tour-bar").style.width = ((tourIdx + 1) / TOUR.length * 100) + "%";
    p.querySelector(".tour-title").textContent = step.title;
    p.querySelector(".tour-body").textContent = step.body;
    p.querySelectorAll(".tour-dot").forEach((d, idx) => d.classList.toggle("active", idx === tourIdx));
    p.querySelector(".tour-back").style.visibility = tourIdx === 0 ? "hidden" : "visible";
    const next = p.querySelector(".tour-next");
    const formArea = p.querySelector(".tour-form");
    if (step.id === "__form") {
      formArea.innerHTML = `
        <div class="tour-fields">
          <input id="tour-name" class="tour-input" placeholder="Your name" autocomplete="name" />
          <input id="tour-email" class="tour-input" placeholder="Work email" type="email" autocomplete="email" />
          <input id="tour-company" class="tour-input" placeholder="Company (optional)" autocomplete="organization" />
          <div class="tour-err"></div>
        </div>`;
      formArea.style.display = "block";
      next.textContent = "Submit request";
    } else {
      formArea.style.display = "none"; formArea.innerHTML = "";
      next.textContent = tourIdx === TOUR.length - 1 ? "Finish" : "Next ›";
    }
  }

  function submitTour() {
    const root = tourRoot;
    const name = (root.querySelector("#tour-name").value || "").trim();
    const email = (root.querySelector("#tour-email").value || "").trim();
    const company = (root.querySelector("#tour-company").value || "").trim();
    const err = root.querySelector(".tour-err");
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!name) { err.textContent = "Please enter your name."; err.classList.add("show"); return; }
    if (!emailOk) { err.textContent = "Please enter a valid work email."; err.classList.add("show"); return; }
    try {
      const reqs = JSON.parse(localStorage.getItem("walkthrough-requests") || "[]");
      reqs.push({ name, email, company, at: new Date().toISOString() });
      localStorage.setItem("walkthrough-requests", JSON.stringify(reqs));
    } catch (_) {}
    root.querySelector(".tour-title").textContent = "Request received ✓";
    root.querySelector(".tour-body").textContent = "";
    root.querySelector(".tour-form").innerHTML =
      `<div class="tour-success">Thanks, ${name}! Our team will reach out at <b>${email}</b> to schedule your personalized walkthrough.</div>`;
    root.querySelector(".tour-back").style.visibility = "hidden";
    root.querySelector(".tour-next").textContent = "Done";
    tourDone = true;
  }

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeTour(); });

  // ---------- Theme wiring ----------
  function toggleTheme() { setTheme(!THEME.dark); renderCurrent(); }
  ["theme-toggle", "theme-toggle-m"].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener("click", toggleTheme);
  });
  let savedTheme = null;
  try { savedTheme = localStorage.getItem("dash-theme"); } catch (_) {}
  setTheme(savedTheme === "dark");

  // ---------- Boot ----------
  const wbtn = document.getElementById("walkthrough-btn");
  if (wbtn) wbtn.addEventListener("click", openTour);
  renderNav();
  renderCurrent();
})();
