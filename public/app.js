const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-US");

function fmtTokens(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return String(n);
}

function fmtSavings(deltaUsd) {
  const savings = -deltaUsd;
  const sign = savings > 0 ? "+" : "";
  return `${sign}${usd.format(savings)}`;
}

function fmtSavingsPct(deltaPct) {
  const savings = -deltaPct;
  const sign = savings > 0 ? "+" : "";
  return `${sign}${savings.toFixed(1)}%`;
}

function savingsClass(deltaPct) {
  const savings = -deltaPct;
  if (savings > 30) return "saving-large";
  if (savings > 0)  return "saving";
  if (savings < 0)  return "more-expensive";
  return "";
}

let matrix = null;
let selectedSku = null;

function initTheme() {
  const toggle = document.getElementById("theme-toggle");
  const label  = document.getElementById("theme-label");
  const apply = (val) => {
    document.body.dataset.theme = val;
    localStorage.setItem("theme", val);
    toggle.setAttribute("aria-checked", val === "light" ? "false" : "true");
    label.textContent = `Theme: ${val === "light" ? "Light" : "Dark"}`;
  };
  apply(localStorage.getItem("theme") ?? "dark");
  toggle.addEventListener("click", () => {
    apply(document.body.dataset.theme === "light" ? "dark" : "light");
  });
}

function updateAltHeaders() {
  const name = matrix.altMeta[selectedSku]?.displayName ?? selectedSku;
  document.getElementById("th-alt-cost").textContent      = `${name} $`;
  document.getElementById("th-alt-delta-pct").textContent = `Savings %`;
}

function buildDropdown() {
  const sel = document.getElementById("alt-select");
  sel.innerHTML = "";
  for (const sku of matrix.altOrder) {
    const opt = document.createElement("option");
    opt.value = sku;
    opt.textContent = matrix.altMeta[sku].displayName;
    sel.appendChild(opt);
  }
  selectedSku = matrix.altOrder[0];
  sel.value = selectedSku;
  sel.addEventListener("change", () => {
    selectedSku = sel.value;
    updateAltHeaders();
    renderAltColumns();
    renderBanners();
  });
}

function renderBanners() {
  const container = document.getElementById("banners");
  container.innerHTML = "";
  const meta = matrix.altMeta[selectedSku];
  if (meta?.valid_until) {
    const expires = new Date(meta.valid_until);
    const today   = new Date();
    today.setHours(0, 0, 0, 0);
    if (expires >= today) {
      const banner = document.createElement("div");
      banner.className = "banner banner-promo";
      banner.textContent = `${meta.displayName} — promo pricing expires ${meta.valid_until}. Update pricing.json after that date.`;
      container.appendChild(banner);
    }
  }
  const unknownRows = matrix.rows.filter(r => r.unknown);
  if (unknownRows.length) {
    const banner = document.createElement("div");
    banner.className = "banner banner-warn";
    banner.textContent = `Missing pricing.json entries for: ${unknownRows.map(r => r.model).join(", ")}. Native $ shown as $0.`;
    container.appendChild(banner);
  }
}

function renderMeta() {
  const totalTokens = matrix.rows.reduce((s, r) =>
    s + r.tokens.input + r.tokens.output + r.tokens.cacheRead + r.tokens.cacheWrite, 0);
  const days = matrix.windowDays ?? 30;
  document.getElementById("meta").textContent =
    `Last ${days} days (${matrix.windowStart} → ${matrix.windowEnd})  ·  ${num.format(matrix.totals.messages)} messages  ·  ${fmtTokens(totalTokens)} tokens  ·  ${num.format(matrix.scannedFiles)} files scanned  ·  ${matrix.projectsDir ?? ""}`;
}

function renderEmptyState() {
  const c = document.getElementById("banners");
  const banner = document.createElement("div");
  banner.className = "banner banner-warn";
  if (matrix.dirExists === false) {
    banner.textContent = `No directory at ${matrix.projectsDir}. Pass --projects-dir <path> if your Claude Code data lives elsewhere.`;
  } else {
    banner.textContent = `No Claude Code sessions found in ${matrix.projectsDir} for the last ${matrix.windowDays} days. Try --days <n> for a wider window.`;
  }
  c.appendChild(banner);
}

function makeRow(data, isTotals = false) {
  const tag = isTotals ? "th" : "td";
  const tr = document.createElement("tr");
  if (isTotals) tr.className = "totals-row";

  const altData = data.alt?.[selectedSku];
  const pct = altData?.deltaPct ?? 0;

  const cells = [
    { val: (data.displayName ?? data.model).replace(/^Claude\s+/, ""), cls: "model-name" },
    { val: num.format(data.messages), cls: "num" },
    { val: fmtTokens(data.tokens.input),     cls: "num tok" },
    { val: fmtTokens(data.tokens.output),    cls: "num tok" },
    { val: fmtTokens(data.tokens.cacheRead), cls: "num tok cache" },
    { val: fmtTokens(data.tokens.cacheWrite),cls: "num tok cache" },
    { val: usd.format(data.native.total$),   cls: "num native-cost" },
    { val: altData ? usd.format(altData.total$)        : "—", cls: "num alt-col alt-cost" },
    { val: altData ? fmtSavingsPct(altData.deltaPct)   : "—", cls: `num alt-col delta-pct ${savingsClass(pct)}` },
  ];

  for (const { val, cls } of cells) {
    const el = document.createElement(tag);
    el.className = cls ?? "";
    el.textContent = val;
    tr.appendChild(el);
  }
  return tr;
}

function renderRows() {
  const tbody = document.getElementById("cost-body");
  tbody.innerHTML = "";
  for (const row of matrix.rows) {
    tbody.appendChild(makeRow(row));
  }
}

function renderTotals() {
  const tfoot = document.getElementById("cost-foot");
  tfoot.innerHTML = "";
  const t = matrix.totals;
  const totalsTokens = matrix.rows.reduce(
    (acc, r) => ({
      input:     acc.input     + r.tokens.input,
      output:    acc.output    + r.tokens.output,
      cacheRead: acc.cacheRead + r.tokens.cacheRead,
      cacheWrite:acc.cacheWrite+ r.tokens.cacheWrite,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  );
  const row = makeRow({
    displayName: "TOTAL",
    messages: t.messages,
    tokens:   totalsTokens,
    native:   t.native,
    alt:      t.alt,
  }, true);
  tfoot.appendChild(row);
}

function fmtPrice(n) {
  if (n == null) return "—";
  return `$${n.toFixed(n < 0.01 ? 4 : n < 1 ? 3 : 2)}`;
}

function altRateForTier(detail, tier) {
  if (detail.type === "tiered") {
    const match = detail.tiers.find(t => t.label.split("/").includes(tier.tierLabel));
    if (!match) return null;
    const suffix = match.banded ? " (from)" : "";
    return { name: match.displayName + suffix, input: match.input, output: match.output, cache_read: match.cache_read };
  }
  if (detail.type === "flat") {
    return { name: matrix.altMeta[selectedSku].displayName, input: detail.input, output: detail.output, cache_read: detail.cache_read };
  }
  if (detail.type === "banded") {
    const band = detail.bands[0];
    return { name: `${matrix.altMeta[selectedSku].displayName} (banded)`, input: band.input, output: band.output, cache_read: detail.cache_read };
  }
  return null;
}

function renderPricingDetail() {
  const container = document.getElementById("pricing-detail");
  container.innerHTML = "";
  const detail = matrix.altPricingDetails?.[selectedSku];
  if (!detail || !matrix.claudeRates) return;

  const table = document.createElement("table");
  table.className = "rate-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Model Mapping</th>
      <th class="num">Input $/M</th>
      <th class="num">Output $/M</th>
      <th class="num">Cache Read $/M</th>
    </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const tierOrder = ["premium", "standard", "fast"];
  const savings = (c, a) => {
    if (c == null || a == null || c === 0) return "";
    const pct = ((a - c) / c) * 100;
    const sign = pct < 0 ? "" : "+";
    const cls = pct < 0 ? "saving-large" : "more-expensive";
    return ` <span class="rate-delta ${cls}">${sign}${pct.toFixed(0)}%</span>`;
  };
  for (const tierKey of tierOrder) {
    const claude = matrix.claudeRates[tierKey];
    if (!claude) continue;
    const alt = altRateForTier(detail, claude);

    const claudeRow = document.createElement("tr");
    claudeRow.className = "rate-claude";
    claudeRow.innerHTML = `
      <td>${claude.displayName}</td>
      <td class="num">${fmtPrice(claude.input)}</td>
      <td class="num">${fmtPrice(claude.output)}</td>
      <td class="num">${fmtPrice(claude.cache_read)}</td>`;
    tbody.appendChild(claudeRow);

    const altRow = document.createElement("tr");
    altRow.className = "rate-alt";
    if (!alt) {
      altRow.innerHTML = `<td>—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td>`;
    } else {
      altRow.innerHTML = `
        <td>↳ ${alt.name}</td>
        <td class="num">${fmtPrice(alt.input)}${savings(claude.input, alt.input)}</td>
        <td class="num">${fmtPrice(alt.output)}${savings(claude.output, alt.output)}</td>
        <td class="num">${fmtPrice(alt.cache_read)}${savings(claude.cache_read, alt.cache_read)}</td>`;
    }
    tbody.appendChild(altRow);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderMappingNote() {
  const container = document.getElementById("mapping-note");
  container.innerHTML = "";
  const meta = matrix.altMeta[selectedSku];
  if (!meta?.tierModelNames) return;

  const TIER_LABELS = { premium: "Opus", standard: "Sonnet", fast: "Haiku" };

  const header = document.createElement("div");
  header.className = "mapping-arrow";
  header.textContent = `${meta.displayName} mapping:`;
  container.appendChild(header);

  for (const [tier, skuName] of Object.entries(meta.tierModelNames)) {
    const line = document.createElement("div");
    line.className = "mapping-row";
    line.innerHTML = `<span class="mapping-arrow">${TIER_LABELS[tier] ?? tier} →</span> <span class="mapping-sku">${skuName}</span>`;
    container.appendChild(line);
  }
}

function renderAltColumns() {
  renderRows();
  renderTotals();
  renderMappingNote();
  renderPricingDetail();
}

async function init() {
  initTheme();
  try {
    const res = await fetch("/api/matrix");
    if (!res.ok) throw new Error(await res.text());
    matrix = await res.json();
    renderMeta();
    if (!matrix.rows || matrix.rows.length === 0) {
      renderEmptyState();
      return;
    }
    buildDropdown();
    updateAltHeaders();
    renderRows();
    renderTotals();
    renderBanners();
    renderMappingNote();
    renderPricingDetail();
  } catch (err) {
    document.getElementById("meta").textContent = "Error loading data: " + err.message;
    console.error(err);
  }
}

init();
