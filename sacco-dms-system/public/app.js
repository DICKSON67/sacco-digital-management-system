// SACCO Digital Management System — web frontend. Talks to the Node backend
// on the same origin, so no CORS setup is needed. No mock data here — every
// number on screen came back from a real API response.

let state = { token: null, actor: null, tab: "overview" };

const NAV = [
  { key: "overview", label: "Overview" },
  { key: "contributions", label: "Contributions" },
  { key: "loans", label: "Loans & Products" },
  { key: "invest", label: "Invest" },
  { key: "learn", label: "Learn" },
  { key: "partners", label: "Partners" },
  { key: "compliance", label: "Compliance" },
];

function show(screenId) {
  ["landing-screen", "welcome-screen", "login-screen", "register-screen", "app-shell"].forEach((id) => {
    document.getElementById(id).style.display = id === screenId ? "flex" : "none";
  });
}

document.getElementById("landing-cta").addEventListener("click", () => show("welcome-screen"));
document.getElementById("welcome-cta").addEventListener("click", () => show("login-screen"));
document.getElementById("goto-register").addEventListener("click", () => show("register-screen"));
document.getElementById("goto-login").addEventListener("click", () => show("login-screen"));

const API_BASE = "https://sacco-dms-backend.onrender.com";

async function api(path, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };

  if (state.token) {
    headers["Authorization"] = `Bearer ${state.token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw { status: res.status, ...body };
  }

  return body;
}

// ---------- login ----------
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email-input").value.trim();
  const password = document.getElementById("password-input").value;
  const statusEl = document.getElementById("login-status");
  statusEl.textContent = "Signing in…";
  try {
    const { token, member } = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    state.token = token;
    state.actor = member;
    statusEl.textContent = "";
    enterApp();
  } catch (err) {
    statusEl.textContent = err.error || "Login failed";
  }
});

// ---------- register ----------
document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const full_name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const sector = document.getElementById("reg-sector").value;
  const statusEl = document.getElementById("register-status");
  statusEl.textContent = "Creating account…";
  try {
    const { token, member } = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ full_name, email, password, sector }),
    });
    state.token = token;
    state.actor = member;
    statusEl.textContent = "";
    enterApp();
  } catch (err) {
    statusEl.textContent = err.error || "Registration failed";
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  state = { token: null, actor: null, tab: "overview" };
  document.getElementById("login-status").textContent = "";
  document.getElementById("register-status").textContent = "";
  show("landing-screen");
});

function enterApp() {
  show("app-shell");
  document.getElementById("greeting").textContent = `Habari, ${state.actor.full_name}`;
  document.getElementById("sector-badge").textContent =
    state.actor.role === "officer" ? "Compliance officer" : `${state.actor.sector} member`;

  const navList = document.getElementById("nav-list");
  navList.innerHTML = "";
  NAV.forEach((n) => {
    const btn = document.createElement("button");
    btn.className = "nav-item" + (state.tab === n.key ? " nav-item-active" : "");
    btn.textContent = n.label;
    btn.onclick = () => {
      state.tab = n.key;
      enterApp();
    };
    navList.appendChild(btn);
  });

  renderView();
}

async function renderView() {
  const el = document.getElementById("view-content");
  el.innerHTML = `<p class="empty">Loading…</p>`;
  try {
    if (state.tab === "overview") await renderOverview(el);
    else if (state.tab === "contributions") await renderContributions(el);
    else if (state.tab === "loans") await renderLoans(el);
    else if (state.tab === "invest") await renderInvest(el);
    else if (state.tab === "learn") await renderLearn(el);
    else if (state.tab === "partners") await renderPartners(el);
    else if (state.tab === "compliance") await renderCompliance(el);
  } catch (err) {
    el.innerHTML = `<div class="error-banner">${err.error || "Something went wrong"} ${err.status ? `(HTTP ${err.status})` : ""}</div>`;
  }
}

// ---------- overview ----------
async function renderOverview(el) {
  const { accounts } = await api("/accounts/me");
  const savings = accounts.find((a) => a.type === "savings");
  const { history } = await api("/investments/dividends/history");

  el.innerHTML = `
    <div class="grid-2">
      <div class="card balance-card">
        <p class="card-sub">Total savings</p>
        <div class="balance">KES ${savings ? savings.balance.toLocaleString() : "0"}</div>
        <form id="deposit-form" class="form-inline">
          <input name="amount" type="number" placeholder="Amount" required style="flex:1;" />
          <button class="btn-gold" type="submit">Deposit</button>
        </form>
        <p class="lock-hint" id="deposit-status" style="color:#F3E4B8;"></p>
      </div>
      <div class="card">
        <h3 class="card-title">Dividend trend</h3>
        <p class="card-sub">From the live investments API</p>
        ${history.map((h) => `<div class="list-row"><div>${h.year}</div><div class="list-row-meta">${h.pct}%</div></div>`).join("")}
      </div>
    </div>
  `;

  if (savings) {
    document.getElementById("deposit-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const amount = Number(e.target.amount.value);
      const status = document.getElementById("deposit-status");
      try {
        const res = await api(`/accounts/${savings.id}/deposit`, {
          method: "POST",
          body: JSON.stringify({ amount, channel: "web" }),
        });
        status.textContent = `Deposited. New balance KES ${res.new_balance.toLocaleString()}.`;
        renderOverview(el);
      } catch (err) {
        status.textContent = err.error || "Deposit failed";
      }
    });
  }
}

// ---------- contributions ----------
async function renderContributions(el) {
  const { contributions, total } = await api("/contributions/me");

  el.innerHTML = `
    <div class="card balance-card">
      <p class="card-sub">Total contributed</p>
      <div class="balance">KES ${total.toLocaleString()}</div>
      <form id="contribute-form" class="form-inline">
        <input name="amount" type="number" placeholder="Amount" required style="flex:1;" />
        <select name="channel" style="border-radius:7px;">
          <option value="mpesa">M-Pesa</option>
          <option value="bank">Bank</option>
          <option value="web">Web/manual</option>
        </select>
        <button class="btn-gold" type="submit">Contribute</button>
      </form>
      <p class="lock-hint" id="contribute-status" style="color:#F3E4B8;"></p>
    </div>
    <div class="card">
      <h3 class="card-title">Contribution history</h3>
      ${
        contributions.length
          ? contributions
              .map(
                (c) => `<div class="list-row">
                  <div>${new Date(c.created_at).toLocaleDateString()}</div>
                  <div class="list-row-meta">KES ${c.amount.toLocaleString()} · ${c.channel}</div>
                </div>`
              )
              .join("")
          : `<p class="empty">No contributions yet — make your first one above.</p>`
      }
    </div>
  `;

  document.getElementById("contribute-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = Number(e.target.amount.value);
    const channel = e.target.channel.value;
    const status = document.getElementById("contribute-status");
    try {
      const res = await api("/contributions", {
        method: "POST",
        body: JSON.stringify({ amount, channel }),
      });
      status.textContent = `Contributed. New balance KES ${res.new_balance.toLocaleString()}.`;
      renderContributions(el);
    } catch (err) {
      status.textContent = err.error || "Contribution failed";
    }
  });
}

// ---------- loans ----------
async function renderLoans(el) {
  const sector = state.actor.sector || "teacher";
  const { products } = await api(`/loan-products?sector=${encodeURIComponent(sector)}`);
  const product = products[0];

  el.innerHTML = `
    <div class="card" ${product ? "" : "style='display:none;'"}>
      ${["teacher", "nurse", "farmer", "trader"].includes(sector) ? `<div class="loan-banner" style="background-image:url('/images/sector-${sector}.svg')"></div>` : ""}
      <p class="card-sub">Recommended for ${sector}s</p>
      ${
        product
          ? `<h3 class="card-title" style="font-size:18px;">${product.name}</h3>
             <p class="card-sub">${product.rate}% p.a. · ${product.min_tenure_months}–${product.max_tenure_months} months · ${product.collateral_required ? "collateral required" : "collateral-free"}</p>
             <form id="loan-form" class="form-inline">
               <input name="amount" type="number" placeholder="Amount (KES)" required />
               <input name="tenure" type="number" placeholder="Tenure (months)" required />
               <button class="btn-gold" type="submit">Apply</button>
             </form>
             <p class="lock-hint" id="loan-status" style="color:var(--ink-soft);"></p>`
          : `<p class="empty">No dedicated product for this sector yet.</p>`
      }
    </div>
    <div id="loan-result"></div>
  `;

  if (product) {
    document.getElementById("loan-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const amount = Number(e.target.amount.value);
      const tenure_months = Number(e.target.tenure.value);
      const status = document.getElementById("loan-status");
      try {
        const { loan } = await api("/loans/apply", {
          method: "POST",
          body: JSON.stringify({ product_id: product.id, amount, tenure_months }),
        });
        status.textContent = `Application submitted — status: ${loan.status}. Loan ID ${loan.id}.`;
      } catch (err) {
        status.textContent = err.error || "Application failed";
      }
    });
  }
}

// ---------- invest ----------
async function renderInvest(el) {
  const { products } = await api("/investments/products");
  const { history } = await api("/investments/dividends/history");

  el.innerHTML = `
    <div class="card">
      <h3 class="card-title">Investment marketplace</h3>
      ${products
        .map(
          (p) => `
        <div class="list-row">
          <div class="row-main">
            <div class="thumb" style="background-image:url('/images/invest-${p.type}.svg')"></div>
            <div>
              <div>${p.name}</div>
              <div class="list-row-meta">${p.type} · ${p.expected_return} · KES ${p.unit_price.toLocaleString()}/unit</div>
            </div>
          </div>
          <form class="buy-form form-inline" data-product="${p.id}" style="margin:0;">
            <input name="units" type="number" min="1" placeholder="Units" style="width:80px;" required />
            <button class="btn-outline btn-small" type="submit">Buy</button>
          </form>
        </div>`
        )
        .join("")}
      <p class="lock-hint" id="buy-status" style="color:var(--ink-soft);"></p>
    </div>
    <div class="card">
      <h3 class="card-title">Dividend history</h3>
      ${history.map((h) => `<div class="list-row"><div>${h.year}</div><div class="list-row-meta">${h.pct}%</div></div>`).join("")}
      <label style="display:flex; align-items:center; gap:8px; margin-top:12px; font-size:13px;">
        <input type="checkbox" id="reinvest-check" checked /> Auto-reinvest dividends
      </label>
    </div>
  `;

  document.querySelectorAll(".buy-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const units = Number(e.target.units.value);
      const status = document.getElementById("buy-status");
      try {
        const res = await api(`/investments/${form.dataset.product}/buy`, {
          method: "POST",
          body: JSON.stringify({ units }),
        });
        status.textContent = `Bought ${res.holding.units} unit(s) total. Cost KES ${res.cost.toLocaleString()}.`;
      } catch (err) {
        status.textContent = err.error || "Purchase failed";
      }
    });
  });

  document.getElementById("reinvest-check").addEventListener("change", async (e) => {
    await api("/investments/settings", {
      method: "PATCH",
      body: JSON.stringify({ reinvest: e.target.checked }),
    });
  });
}

// ---------- learn ----------
async function renderLearn(el) {
  const { courses } = await api("/learning/courses");
  el.innerHTML = `
    <div class="grid-3">
      ${courses
        .map(
          (c) => `
        <div class="card">
          <div class="course-thumb" style="background-image:url('/images/${c.id}.svg')"></div>
          <div style="font-size:13.5px; font-weight:500; margin-bottom:8px;">${c.title}</div>
          <div class="course-bar"><div class="course-fill" style="width:${c.percent_complete}%;"></div></div>
          <div class="list-row-meta">${c.percent_complete}% complete · ${c.duration_minutes} min</div>
          ${
            c.percent_complete < 100
              ? `<button class="btn-outline btn-small mark-done" data-course="${c.id}" style="margin-top:10px;">Mark complete</button>`
              : ""
          }
        </div>`
        )
        .join("")}
    </div>
  `;

  document.querySelectorAll(".mark-done").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/learning/courses/${btn.dataset.course}/progress`, {
        method: "PATCH",
        body: JSON.stringify({ percent: 100 }),
      });
      renderLearn(el);
    });
  });
}

// ---------- partners ----------
async function renderPartners(el) {
  const { partners } = await api("/partners");
  el.innerHTML = `
    <div class="card">
      <h3 class="card-title">Partner marketplace</h3>
      ${partners
        .map(
          (p) => `<div class="list-row"><div>${p.name}</div><div class="list-row-meta">${p.category}${p.discount_pct ? ` · ${p.discount_pct}% off` : ""}</div></div>`
        )
        .join("")}
    </div>
  `;
}

// ---------- compliance ----------
async function renderCompliance(el) {
  if (state.actor.role !== "officer") {
    el.innerHTML = `
      <div class="card">
        <h3 class="card-title">Deposit insurance</h3>
        <p class="card-sub">Your deposits are guaranteed by the SDIC up to KES 500,000.</p>
        <p class="empty">Ratio and audit data are visible to compliance officers only.</p>
      </div>`;
    return;
  }

  const { ratios } = await api("/compliance/ratios");
  const { entries } = await api("/compliance/audit-log?limit=10");
  const { reports } = await api("/compliance/sasra-reports");

  el.innerHTML = `
    <div class="grid-3">
      <div class="card"><p class="card-sub">Capital adequacy</p><div class="balance" style="font-size:24px;">${ratios.capital_adequacy_ratio}%</div><span class="badge-ok">above 10% minimum</span></div>
      <div class="card"><p class="card-sub">Liquidity ratio</p><div class="balance" style="font-size:24px;">${ratios.liquidity_ratio}%</div><span class="badge-ok">above 15% minimum</span></div>
      <div class="card"><p class="card-sub">NPL ratio</p><div class="balance" style="font-size:24px;">${ratios.npl_ratio}%</div><span class="badge-ok">below 5% ceiling</span></div>
    </div>
    <div class="card">
      <h3 class="card-title">SASRA reports</h3>
      <p class="card-sub">Generate a report, then download it as a CSV file.</p>
      <button id="gen-report" class="btn-outline btn-small">Generate SASRA report</button>
      <p class="lock-hint" id="report-status" style="color:var(--ink-soft);"></p>
      <div id="reports-list" style="margin-top:12px;">
        ${
          reports.length
            ? reports
                .map(
                  (r) => `<div class="list-row">
                    <div>${r.period}</div>
                    <div class="list-row-meta" style="display:flex; align-items:center; gap:10px;">
                      CAR ${r.capital_adequacy_ratio}% · Liquidity ${r.liquidity_ratio}% · NPL ${r.npl_ratio}%
                      <button class="btn-outline btn-small download-report" data-id="${r.id}" data-period="${r.period}">Download</button>
                    </div>
                  </div>`
                )
                .join("")
            : `<p class="empty">No reports generated yet.</p>`
        }
      </div>
    </div>
    <div class="card">
      <h3 class="card-title">Audit trail — live</h3>
      <p class="card-sub">Every action you've taken in this session appears here automatically.</p>
      <table class="audit-table">
        <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>IP</th></tr></thead>
        <tbody>
          ${
            entries.length
              ? entries.map((r) => `<tr><td>${new Date(r.created_at).toLocaleTimeString()}</td><td>${r.actor_id}</td><td>${r.action}</td><td>${r.ip_address}</td></tr>`).join("")
              : `<tr><td colspan="4" class="empty">No entries yet</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("gen-report").addEventListener("click", async () => {
    const res = await api("/compliance/sasra-report/generate", { method: "POST" });
    document.getElementById("report-status").textContent = `Report ${res.report.id} generated for ${res.report.period}.`;
    renderCompliance(el);
  });

  // File downloads need the Authorization header, which a plain <a href>
  // can't send — so fetch the file as a blob and trigger the browser's
  // save dialog manually.
  document.querySelectorAll(".download-report").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const res = await fetch(`${API_BASE}/compliance/sasra-reports/${btn.dataset.id}/download`, {
        headers: { Authorization: `Bearer ${state.token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sasra-report-${btn.dataset.period}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  });
}
