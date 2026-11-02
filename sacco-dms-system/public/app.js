// SACCO Digital Management System — web frontend. Talks to the Node backend
// on the same origin, so no CORS setup is needed. No mock data here — every
// number on screen came back from a real API response.

let state = { token: null, actor: null, tab: "overview" };

const NAV = [
  { key: "overview", label: "Overview" },
  { key: "contributions", label: "Contributions", not: ["admin"] },
  { key: "loans", label: "Loans & Products", not: ["admin"] },
  { key: "invest", label: "Invest", not: ["admin"] },
  { key: "learn", label: "Learn" },
  { key: "partners", label: "Partners" },
  { key: "compliance", label: "Compliance", not: ["admin"] },
  { key: "loanapps", label: "Loan Applications", only: ["officer"] },
  { key: "memberapps", label: "Member Approvals", only: ["officer"] },
  { key: "admin", label: "Administration", only: ["admin"] },
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

// Escape text before it is placed inside HTML. Member names and emails are typed
// by users, so they must never be inserted as raw markup.
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "");
const pill = (status) => {
  const cls = { applied: "pill-wait", pending: "pill-wait", approved: "pill-ok", verified: "pill-ok", rejected: "pill-bad" }[status] || "pill-wait";
  const text = { applied: "awaiting decision", verified: "approved" }[status] || status;
  return `<span class="pill ${cls}">${esc(text)}</span>`;
};

// A thick circular progress indicator drawn as SVG.
function ring(percent, size, stroke, big) {
  const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, mid = size / 2;
  const colour = p === 100 ? "var(--forest-light)" : "var(--gold)";
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${p} percent complete">
    <circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="var(--forest-pale)" stroke-width="${stroke}"/>
    ${p > 0 ? `<circle class="ring-bar" cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="${colour}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}" transform="rotate(-90 ${mid} ${mid})" style="--ring-c:${c}"/>` : ""}
    <text x="${mid}" y="${mid}" text-anchor="middle" dominant-baseline="central" class="ring-text" style="font-size:${big ? 32 : 16}px">${p}%</text>
  </svg>`;
}

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
  const res = await fetch(path, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...body };
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
  const phone = document.getElementById("reg-phone").value.trim();
  const password = document.getElementById("reg-password").value;
  const sector = document.getElementById("reg-sector").value;
  const statusEl = document.getElementById("register-status");
  statusEl.textContent = "Creating account…";
  try {
    const { token, member } = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ full_name, email, phone, password, sector }),
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
    ({ officer: "Compliance officer", admin: "System administrator" })[state.actor.role] || `${state.actor.sector} member`;

  const navList = document.getElementById("nav-list");
  navList.innerHTML = "";
  NAV.filter((n) => (!n.only || n.only.includes(state.actor.role)) && !(n.not || []).includes(state.actor.role)).forEach((n) => {
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
    else if (state.tab === "loanapps") await renderLoanApplications(el);
    else if (state.tab === "memberapps") await renderMemberApprovals(el);
    else if (state.tab === "admin") await renderAdmin(el);
  } catch (err) {
    el.innerHTML = `<div class="error-banner">${err.error || "Something went wrong"} ${err.status ? `(HTTP ${err.status})` : ""}</div>`;
  }
}

// ---------- overview ----------
async function renderOverview(el) {
  const me = await api("/members/me");
  const isMember = me.role === "member";
  const profession = { teacher: "Teacher", nurse: "Nurse", farmer: "Farmer", trader: "Trader", other: "Other" }[me.sector] || me.sector;
  const roleName = { member: "SACCO member", officer: "Compliance officer", admin: "System administrator" }[me.role] || me.role;
  const rows = [
    ["Name", esc(me.full_name)],
    isMember ? ["Profession", esc(profession)] : ["Role", esc(roleName)],
    ["Phone number", me.phone ? esc(me.phone) : "Not provided"],
    ["Email", esc(me.email)],
  ];
  if (isMember) rows.push(["Membership", pill(me.kyc_status)]);
  const history = isMember ? (await api("/investments/dividends/history")).history : [];

  el.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h3 class="card-title">My details</h3>
        <dl class="details">
          ${rows.map(([k, v]) => `<div class="details-row"><dt>${k}</dt><dd>${v}</dd></div>`).join("")}
        </dl>
      </div>
      ${me.savings !== null ? `
      <div class="card balance-card">
        <p class="card-sub">Total savings</p>
        <div class="balance">KES ${Number(me.savings).toLocaleString()}</div>
        <p class="card-sub">Use the Contributions page to add to your savings.</p>
      </div>` : ""}
    </div>
    ${isMember ? `
    <div class="card">
      <h3 class="card-title">Dividend history</h3>
      ${history.map((h) => `<div class="list-row"><div>${h.year}</div><div class="list-row-meta">${h.pct}%</div></div>`).join("")}
    </div>` : ""}
  `;
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
  const me = await api("/members/me");
  const product = products[0];
  const notice = me.kyc_status === "verified" ? "" : `
    <div class="notice">Your membership is <strong>${esc(me.kyc_status)}</strong>. A SACCO officer must approve it before you can apply for a loan.</div>`;

  el.innerHTML = notice + `
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
    <div class="card">
      <h3 class="card-title">My loan applications</h3>
      <div id="my-loans"><p class="empty">Loading…</p></div>
    </div>
  `;

  async function loadMyLoans() {
    const { loans } = await api("/loans/me");
    document.getElementById("my-loans").innerHTML = loans.length
      ? loans.map((l) => `<div class="list-row">
          <div>
            <div>${esc(l.product_name)}</div>
            <div class="list-row-meta">KES ${Number(l.principal).toLocaleString()} · ${l.tenure_months} months · applied ${fmtDate(l.applied_at)}${l.decision_note ? " · " + esc(l.decision_note) : ""}</div>
          </div>
          ${pill(l.status)}
        </div>`).join("")
      : `<p class="empty">You have not applied for a loan yet.</p>`;
  }
  loadMyLoans();

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
        status.textContent = `Application submitted. An officer will review it. Loan ID ${loan.id}.`;
        loadMyLoans();
      } catch (err) {
        status.textContent = err.error || "Application failed";
      }
    });
  }
}

// ---------- officer: loan applications ----------
async function renderLoanApplications(el) {
  const { loans, counts } = await api("/officer/loans");
  el.innerHTML = `
    <div class="card">
      <h3 class="card-title">Loan applications</h3>
      <p class="card-sub">${counts.applied} awaiting a decision · ${counts.approved} approved · ${counts.rejected} rejected</p>
      <div class="table-wrap">
        <table class="audit-table">
          <thead><tr><th>Applicant</th><th>Product</th><th>Amount (KES)</th><th>Tenure</th><th>Applied</th><th>Status</th><th>Decision</th></tr></thead>
          <tbody>
            ${loans.length ? loans.map((l) => `<tr>
              <td>${esc(l.applicant_name)}<div class="list-row-meta">${esc(l.applicant_email)}</div></td>
              <td>${esc(l.product_name)}</td>
              <td>${Number(l.principal).toLocaleString()}</td>
              <td>${l.tenure_months} months</td>
              <td>${fmtDate(l.applied_at)}</td>
              <td>${pill(l.status)}</td>
              <td>${l.status === "applied"
                ? `<button class="btn-outline btn-small decide-loan" data-id="${esc(l.id)}" data-decision="approve">Approve</button>
                   <button class="btn-outline btn-small decide-loan" data-id="${esc(l.id)}" data-decision="reject">Reject</button>`
                : `<span class="list-row-meta">${fmtDate(l.decided_at)}${l.decision_note ? " · " + esc(l.decision_note) : ""}</span>`}</td>
            </tr>`).join("") : `<tr><td colspan="7" class="empty">No loan applications yet.</td></tr>`}
          </tbody>
        </table>
      </div>
      <p class="lock-hint" id="loan-decision-status" style="color:var(--ink-soft);"></p>
    </div>
  `;
  document.querySelectorAll(".decide-loan").forEach((btn) => {
    btn.addEventListener("click", async () => {
      let note = "";
      if (btn.dataset.decision === "reject") {
        note = window.prompt("Reason for rejecting (optional):");
        if (note === null) return; // cancelled
      }
      try {
        await api(`/officer/loans/${encodeURIComponent(btn.dataset.id)}/decision`, {
          method: "POST", body: JSON.stringify({ decision: btn.dataset.decision, note }),
        });
        renderLoanApplications(el);
      } catch (err) {
        document.getElementById("loan-decision-status").textContent = err.error || "Could not save the decision";
      }
    });
  });
}

// ---------- officer: member approvals ----------
async function renderMemberApprovals(el) {
  const { members, counts } = await api("/officer/members");
  el.innerHTML = `
    <div class="card">
      <h3 class="card-title">Member approvals</h3>
      <p class="card-sub">${counts.pending} awaiting approval · ${counts.verified} approved · ${counts.rejected} rejected. Members must be approved before they can apply for loans.</p>
      <div class="table-wrap">
        <table class="audit-table">
          <thead><tr><th>Member</th><th>Sector</th><th>Registered</th><th>Status</th><th>Decision</th></tr></thead>
          <tbody>
            ${members.length ? members.map((m) => `<tr>
              <td>${esc(m.full_name)}<div class="list-row-meta">${esc(m.email)}</div></td>
              <td>${esc(m.sector)}</td>
              <td>${m.created_at ? fmtDate(m.created_at) : "—"}</td>
              <td>${pill(m.kyc_status)}</td>
              <td>${m.kyc_status !== "verified" ? `<button class="btn-outline btn-small decide-member" data-id="${esc(m.id)}" data-decision="approve">Approve</button>` : ""}
                  ${m.kyc_status === "pending" ? `<button class="btn-outline btn-small decide-member" data-id="${esc(m.id)}" data-decision="reject">Reject</button>` : ""}</td>
            </tr>`).join("") : `<tr><td colspan="5" class="empty">No members yet.</td></tr>`}
          </tbody>
        </table>
      </div>
      <p class="lock-hint" id="member-decision-status" style="color:var(--ink-soft);"></p>
    </div>
  `;
  document.querySelectorAll(".decide-member").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api(`/officer/members/${encodeURIComponent(btn.dataset.id)}/decision`, {
          method: "POST", body: JSON.stringify({ decision: btn.dataset.decision }),
        });
        renderMemberApprovals(el);
      } catch (err) {
        document.getElementById("member-decision-status").textContent = err.error || "Could not save the decision";
      }
    });
  });
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
function eventRow(e) {
  const d = new Date(e.date + "T00:00:00");
  const meta = [e.time, e.location].filter(Boolean).map(esc).join(" · ");
  return `<div class="event-row">
    <div class="event-date"><span class="event-day">${d.getDate()}</span><span class="event-month">${d.toLocaleString("en-GB", { month: "short" })}</span></div>
    <div>
      <div class="event-title">${esc(e.title)}</div>
      <div class="list-row-meta">${d.getFullYear()}${meta ? " · " + meta : ""}</div>
      ${e.description ? `<p class="card-sub" style="margin:4px 0 0;">${esc(e.description)}</p>` : ""}
    </div>
  </div>`;
}

function courseCard(c) {
  const safeLink = /^https?:\/\//i.test(c.link || "") ? c.link : "";
  return `<div class="card course-card">
    <div class="course-thumb" style="background-image:url('/images/${encodeURIComponent(c.id)}.svg'), url('/images/course_default.svg');"></div>
    <div class="course-head">
      <div>
        <div class="course-name">${esc(c.title)}</div>
        <div class="list-row-meta">${Number(c.duration_minutes)} min</div>
      </div>
      ${ring(c.percent_complete, 72, 11, false)}
    </div>
    ${c.description ? `<p class="card-sub">${esc(c.description)}</p>` : ""}
    ${c.content || safeLink ? `<details class="lesson" data-id="${esc(c.id)}">
      <summary>Read the lesson</summary>
      <div class="lesson-body">${esc(c.content).replace(/\n/g, "<br>")}</div>
      ${safeLink ? `<p class="lesson-body"><a href="${esc(safeLink)}" target="_blank" rel="noopener noreferrer">Open the video or resource</a></p>` : ""}
    </details>` : ""}
    ${c.percent_complete < 100
      ? `<div class="course-actions">
           <button class="btn-outline btn-small set-progress" data-id="${esc(c.id)}" data-value="${Math.min(100, c.percent_complete + 25)}">Continue (+25%)</button>
           <button class="btn-outline btn-small set-progress" data-id="${esc(c.id)}" data-value="100">Mark complete</button>
         </div>`
      : `<span class="pill pill-ok">Completed</span>`}
  </div>`;
}

async function renderLearn(el) {
  const [{ courses }, { events }] = await Promise.all([api("/learning/courses"), api("/learning/events")]);
  const total = courses.length;
  const done = courses.filter((c) => c.percent_complete >= 100).length;
  const overall = total ? Math.round(courses.reduce((sum, c) => sum + c.percent_complete, 0) / total) : 0;
  const openLessons = [...el.querySelectorAll("details[open]")].map((d) => d.dataset.id);

  el.innerHTML = `
    <div class="card learn-summary">
      ${ring(overall, 160, 22, true)}
      <div>
        <h3 class="card-title" style="font-size:17px;">Your learning progress</h3>
        <p class="card-sub">${done} of ${total} courses completed</p>
        <p class="card-sub">${total && done === total ? "You have finished every course. New lessons appear here when they are added." : "Open a lesson, then press Continue as you work through it."}</p>
      </div>
    </div>
    <h3 class="section-title">Courses</h3>
    <div class="course-grid">${courses.length ? courses.map(courseCard).join("") : `<p class="empty">No courses yet.</p>`}</div>
    <h3 class="section-title">Upcoming business events</h3>
    <div class="card">${events.length ? events.map(eventRow).join("") : `<p class="empty">No upcoming events yet. Check back soon.</p>`}</div>
  `;
  el.querySelectorAll("details").forEach((d) => { if (openLessons.includes(d.dataset.id)) d.open = true; });

  el.querySelectorAll(".set-progress").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/learning/courses/${encodeURIComponent(btn.dataset.id)}/progress`, {
        method: "PATCH", body: JSON.stringify({ percent: Number(btn.dataset.value) }),
      });
      renderLearn(el);
    });
  });
}

// ---------- system administrator ----------
async function renderAdmin(el, flash) {
  const [{ courses }, { events }, { users }] = await Promise.all([api("/learning/courses"), api("/admin/events"), api("/admin/users")]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const roleName = { member: "Member", officer: "Officer", admin: "Administrator" };

  el.innerHTML = `
    ${flash ? `<div class="notice notice-ok">${esc(flash)}</div>` : ""}
    <div class="card">
      <h3 class="card-title">Add learning content</h3>
      <p class="card-sub">A new course appears in every member's Learn tab straight away.</p>
      <form id="course-form" class="admin-form">
        <label>Title<input name="title" required minlength="3" maxlength="120" /></label>
        <label>Duration (minutes)<input name="duration" type="number" min="1" max="600" required /></label>
        <label class="wide">Short description<input name="description" maxlength="300" /></label>
        <label class="wide">Lesson content<textarea name="content" rows="6" maxlength="5000" placeholder="Write the lesson here. Start each point on a new line."></textarea></label>
        <label class="wide">Link to a video or resource (optional)<input name="link" type="url" placeholder="https://" /></label>
        <div class="wide"><button class="btn-gold" type="submit">Publish course</button> <span class="form-status" id="course-status"></span></div>
      </form>
    </div>

    <div class="card">
      <h3 class="card-title">Published courses (${courses.length})</h3>
      ${courses.map((c) => `<div class="list-row">
        <div><div>${esc(c.title)}</div><div class="list-row-meta">${Number(c.duration_minutes)} min</div></div>
        <button class="btn-outline btn-small delete-item" data-kind="courses" data-id="${esc(c.id)}" data-name="${esc(c.title)}">Delete</button>
      </div>`).join("") || `<p class="empty">No courses yet.</p>`}
    </div>

    <div class="card">
      <h3 class="card-title">Add an upcoming business event</h3>
      <p class="card-sub">Events show in the Learn tab until their date has passed.</p>
      <form id="event-form" class="admin-form">
        <label>Event title<input name="title" required minlength="3" maxlength="120" /></label>
        <label>Date<input name="date" type="date" required /></label>
        <label>Time (optional)<input name="time" type="time" /></label>
        <label>Place<input name="location" maxlength="120" /></label>
        <label class="wide">Details<textarea name="description" rows="3" maxlength="500"></textarea></label>
        <div class="wide"><button class="btn-gold" type="submit">Publish event</button> <span class="form-status" id="event-status"></span></div>
      </form>
    </div>

    <div class="card">
      <h3 class="card-title">Events (${events.length})</h3>
      ${events.map((e) => `<div class="list-row">
        <div><div>${esc(e.title)}</div><div class="list-row-meta">${esc(e.date)}${e.time ? " " + esc(e.time) : ""}${e.location ? " · " + esc(e.location) : ""}${e.date < todayIso ? " · past" : ""}</div></div>
        <button class="btn-outline btn-small delete-item" data-kind="events" data-id="${esc(e.id)}" data-name="${esc(e.title)}">Delete</button>
      </div>`).join("") || `<p class="empty">No events yet.</p>`}
    </div>

    <div class="card">
      <h3 class="card-title">Users (${users.length})</h3>
      <div class="table-wrap">
        <table class="audit-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Profession</th><th>Status</th></tr></thead>
          <tbody>${users.map((u) => `<tr>
            <td>${esc(u.full_name)}<div class="list-row-meta">${esc(u.email)}</div></td>
            <td>${u.phone ? esc(u.phone) : "—"}</td>
            <td>${esc(roleName[u.role] || u.role)}</td>
            <td>${u.role === "member" ? esc(u.sector) : "—"}</td>
            <td>${u.role === "member" ? pill(u.kyc_status) : ""}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("course-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = ev.target, status = document.getElementById("course-status");
    try {
      await api("/admin/courses", { method: "POST", body: JSON.stringify({
        title: f.title.value, duration_minutes: Number(f.duration.value),
        description: f.description.value, content: f.content.value, link: f.link.value,
      }) });
      renderAdmin(el, "Course published. Members can see it in the Learn tab.");
    } catch (err) { status.textContent = err.error || "Could not publish the course"; }
  });

  document.getElementById("event-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = ev.target, status = document.getElementById("event-status");
    try {
      await api("/admin/events", { method: "POST", body: JSON.stringify({
        title: f.title.value, date: f.date.value, time: f.time.value,
        location: f.location.value, description: f.description.value,
      }) });
      renderAdmin(el, "Event published. Members can see it in the Learn tab.");
    } catch (err) { status.textContent = err.error || "Could not publish the event"; }
  });

  el.querySelectorAll(".delete-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm(`Delete "${btn.dataset.name}" for all members?`)) return;
      try {
        await api(`/admin/${btn.dataset.kind}/${encodeURIComponent(btn.dataset.id)}`, { method: "DELETE" });
        renderAdmin(el, "Deleted.");
      } catch (err) { renderAdmin(el, err.error || "Could not delete"); }
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
      const res = await fetch(`/compliance/sasra-reports/${btn.dataset.id}/download`, {
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
