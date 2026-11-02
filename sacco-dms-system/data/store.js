// Data store.
// Stands in for PostgreSQL for this prototype — every shape here maps directly
// onto a table in umoja-sacco-architecture.md §4 (Database Schema).
// Data lives in memory while the server runs and is saved to data/db.json after
// every change, so registered members and their records survive a restart.

const fs = require("fs");
const path = require("path");
const { hashPassword, isHashed } = require("./password");

let idCounter = 1;
const nextId = (prefix) => `${prefix}_${(idCounter++).toString(36)}`;

const members = new Map([
  [
    "mem_achieng",
    {
      id: "mem_achieng",
      full_name: "J. Achieng",
      email: "achieng@gmail.com",
      phone: "254712121212",
      password: "Teacher@123",
      sector: "teacher",
      kyc_status: "verified",
      role: "member",
    },
  ],
  [
    "mem_mwangi",
    {
      id: "mem_mwangi",
      full_name: "P. Mwangi",
      email: "mwangi@gmail,com",
      phone: "254707070707",
      password: "Officer@123",
      sector: "other",
      kyc_status: "verified",
      role: "officer", 
    },
  ],
  [
    "mem_admin",
    {
      id: "mem_admin",
      full_name: "System Administrator",
      email: "admin@gmail.com",
      phone: "254712000003",
      password: "Admin@12345", 
      sector: "other",
      kyc_status: "verified",
      role: "admin", 
    },
  ],
]);

const accounts = new Map([
  ["acc_achieng_savings", { id: "acc_achieng_savings", member_id: "mem_achieng", type: "savings", balance: 342560 }],
  ["acc_achieng_invest", { id: "acc_achieng_invest", member_id: "mem_achieng", type: "investment", balance: 45000 }],
]);

const transactions = [];

const loanProducts = new Map([
  ["prod_teacher", { id: "prod_teacher", name: "Teacher's Holiday Loan", sector: "teacher", rate: 9.0, min_tenure_months: 3, max_tenure_months: 12, collateral_required: false }],
  ["prod_nurse", { id: "prod_nurse", name: "Nurse's Equipment Loan", sector: "nurse", rate: 11.0, min_tenure_months: 12, max_tenure_months: 36, collateral_required: true }],
  ["prod_farmer", { id: "prod_farmer", name: "Farm Input Loan", sector: "farmer", rate: 8.0, min_tenure_months: 6, max_tenure_months: 6, collateral_required: false }],
  ["prod_trader", { id: "prod_trader", name: "Working Capital Boost", sector: "trader", rate: 12.0, min_tenure_months: 1, max_tenure_months: 6, collateral_required: false }],
]);

const loans = new Map();

const investmentProducts = new Map([
  ["inv_realestate", { id: "inv_realestate", name: "Kilimani Two-Bedroom Development", type: "real_estate", expected_return: "14% p.a.", unit_price: 25000 }],
  ["inv_tbill", { id: "inv_tbill", name: "91-Day Treasury Bill", type: "t_bill", expected_return: "16.1% p.a.", unit_price: 5000 }],
  ["inv_agri", { id: "inv_agri", name: "Nakuru Greenhouse Fund", type: "agri_fund", expected_return: "19% p.a. (est.)", unit_price: 2500 }],
]);

const holdings = new Map();

const dividendHistory = [
  { year: 2021, pct: 8.5 },
  { year: 2022, pct: 9.2 },
  { year: 2023, pct: 7.8 },
  { year: 2024, pct: 10.1 },
  { year: 2025, pct: 11.4 },
  { year: 2026, pct: 12.0 },
];

const memberSettings = new Map([["mem_achieng", { reinvest: true }]]);

const courses = new Map([
  ["course_debt", { id: "course_debt", title: "How to manage debt", duration_minutes: 18,
    description: "Learn how to borrow wisely, avoid over-borrowing and clear debt faster.",
    content: "1. Borrow only what you can repay. A common rule of thumb is that loan repayments should not take more than one third of your monthly income.\n2. Compare the full cost of a loan: the interest rate, any fees and the repayment period, not only the monthly instalment.\n3. List every debt, then clear the one with the highest interest first while paying the minimum on the others.\n4. Keep some emergency savings so that a sudden expense does not push you into a new loan.",
    link: "" }],
  ["course_invest", { id: "course_invest", title: "Introduction to investing", duration_minutes: 25,
    description: "Understand risk, return and the difference between saving and investing.",
    content: "1. Saving keeps your money safe and ready to use. Investing puts money to work to earn more over time, but with more risk.\n2. Higher expected returns usually come with higher risk. Never invest money you may need soon.\n3. Spread your money across different investments so that one poor result does not cost you everything.\n4. Start small, keep learning, and check that an investment is licensed or regulated before you put money in.",
    link: "" }],
  ["course_interest", { id: "course_interest", title: "Understanding interest rates", duration_minutes: 12,
    description: "See how interest is calculated and how rates change what you pay and earn.",
    content: "1. Interest is the price of using money. Borrowers pay it and savers earn it.\n2. Simple interest is charged on the original amount only. Compound interest is charged on the amount plus the interest already added, so it grows faster.\n3. A loan quoted at a flat rate and one quoted on a reducing balance cost different amounts. Always ask which one applies.\n4. Compare offers over the same period, for example the yearly rate, before you decide.",
    link: "" }],
]);

// Business events added by the system administrator: { id, title, date (YYYY-MM-DD), time, location, description }
const events = new Map();

const courseProgress = new Map([
  ["mem_achieng:course_debt", { member_id: "mem_achieng", course_id: "course_debt", percent_complete: 100 }],
  ["mem_achieng:course_invest", { member_id: "mem_achieng", course_id: "course_invest", percent_complete: 60 }],
]);

const partners = new Map([
  ["partner_life", { id: "partner_life", name: "Britam Life Cover", category: "insurance", discount_pct: null }],
  ["partner_fuel", { id: "partner_fuel", name: "TotalEnergies Fuel Discount", category: "retail", discount_pct: 5 }],
  ["partner_remit", { id: "partner_remit", name: "WorldRemit Corridor", category: "remittance", discount_pct: null }],
]);

const auditLog = [];

const sasraSnapshot = { capital_adequacy_ratio: 18.4, liquidity_ratio: 22.1, npl_ratio: 3.2 };

// Generated SASRA reports, kept so they can be listed and re-downloaded.
const sasraReports = [];

// token -> member id, issued by POST /auth/login or /auth/register
const tokens = new Map();

// ---- seeded demo passwords are hashed, never kept as plain text -------------
for (const m of members.values()) {
  if (!isHashed(m.password)) m.password = hashPassword(m.password);
}

// ---- persistence ------------------------------------------------------------
// Everything a member can change is saved. Session tokens are not: members
// simply sign in again after a restart.
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "db.json");
const MAPS = { members, accounts, loans, holdings, memberSettings, courseProgress, courses, events };
const ARRAYS = { transactions, auditLog, sasraReports };

function save() {
  const out = { idCounter, maps: {}, arrays: {} };
  for (const [k, m] of Object.entries(MAPS)) out.maps[k] = [...m.entries()];
  for (const [k, a] of Object.entries(ARRAYS)) out.arrays[k] = a;
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(out));
  fs.renameSync(tmp, DB_FILE); // write then rename so a crash never leaves a half-written file
}

function load() {
  if (!fs.existsSync(DB_FILE)) return false;
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    for (const [k, m] of Object.entries(MAPS)) {
      if (!db.maps || !db.maps[k]) continue;
      m.clear();
      for (const [key, value] of db.maps[k]) m.set(key, value);
    }
    for (const [k, a] of Object.entries(ARRAYS)) {
      if (!db.arrays || !db.arrays[k]) continue;
      a.length = 0;
      a.push(...db.arrays[k]);
    }
    if (db.idCounter) idCounter = db.idCounter;
    return true;
  } catch (err) {
    // A damaged file must not stop the server; keep a copy and start from the seed data.
    const backup = DB_FILE + ".corrupt-" + Date.now();
    try { fs.renameSync(DB_FILE, backup); } catch (_) {}
    console.error("Could not read " + DB_FILE + ", moved it to " + backup + ". Starting with seed data.");
    return false;
  }
}

// Demo accounts added in a newer version of the code (for example the administrator)
// are inserted if a saved file does not have them yet. Existing accounts are never
// overwritten, except that a missing phone number is filled in.
const SEED_MEMBERS = [...members.entries()].map(([k, v]) => [k, { ...v }]);

if (load()) {
  console.log("Loaded saved data from " + DB_FILE);
  for (const [id, seed] of SEED_MEMBERS) {
    const existing = members.get(id);
    if (!existing) members.set(id, seed);
    else if (!existing.phone && seed.phone) existing.phone = seed.phone;
  }
}

module.exports = {
  nextId, save,
  members, accounts, transactions, loanProducts, loans,
  investmentProducts, holdings, dividendHistory, memberSettings,
  courses, events, courseProgress, partners, auditLog, sasraSnapshot, sasraReports, tokens,
};
