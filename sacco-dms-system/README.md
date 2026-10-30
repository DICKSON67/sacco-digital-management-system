# SACCO Digital Management System — Full-Stack Prototype

A working Node.js API server **and** a browser-based web app served from the
same process — open http://localhost:4000 and you're using the real system,
not a mockup. It's dependency-free (only Node's built-in `http`/`fs`/`path`/
`crypto` modules) so it runs immediately with no `npm install`, and it makes
**zero external network requests** — no CDN fonts, no remote APIs, nothing.
Once Node is installed, this runs entirely offline, permanently, on any
machine with no internet connection at all.

Every API request passes through the same pipeline production would use:

```
request → logger → authenticate → authorize (RBAC) → route handler → audit log → response
```

The web app walks through four screens: **Landing → Welcome → Sign in (or
Register) → Dashboard.** The dashboard now includes a dedicated
**Contributions** page, and compliance officers can **download SASRA reports**
as real CSV files, not just view them as JSON.

## Run it

```bash
node server.js
# SACCO Digital Management System API listening on http://localhost:4000
```

Then open **http://localhost:4000** in a browser. Click through the landing
and welcome screens, then either sign in with a seeded account below or click
**"New member? Register"** to create your own account on the spot — it's
added to the same in-memory member list the seeded accounts live in.
Everything you do from there — deposit, contribute, apply for a loan, buy an
investment unit, tick off a course, generate and download a SASRA report — is
a real request to the API, and if you sign in as the compliance officer
you'll see your own actions show up live in the audit trail.

## Try the API directly

```bash
# 1. Register a new member
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Jane Wanjiru","email":"jane@example.com","password":"Password123","sector":"trader"}'
# → { "token": "...", "member": { "sector": "trader", ... } }

TOKEN=<paste the token above>

# 2. Make a contribution and view your history
curl -X POST http://localhost:4000/contributions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amount":2000,"channel":"mpesa"}'
curl http://localhost:4000/contributions/me -H "Authorization: Bearer $TOKEN"

# 3. Sign in as a member (seeded demo member: Achieng, a teacher)
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"achieng@saccodms.co.ke","password":"Teacher@123"}'

# 4. Sector-personalized loan products (pillar 2)
curl "http://localhost:4000/loan-products?sector=teacher" \
  -H "Authorization: Bearer $TOKEN"

# 5. Apply for a loan — this also writes an audit_log entry automatically
curl -X POST http://localhost:4000/loans/apply \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"product_id":"prod_teacher","amount":45000,"tenure_months":6}'

# 6. Try a protected route with no token → 401
curl http://localhost:4000/accounts/me

# 7. Try an officer-only route as a member → 403
curl http://localhost:4000/compliance/ratios -H "Authorization: Bearer $TOKEN"

# 8. Sign in as the seeded compliance officer, generate a SASRA report, and
#    download it as a real CSV file
OFFICER_TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mwangi@saccodms.co.ke","password":"Officer@123"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")

REPORT_ID=$(curl -s -X POST http://localhost:4000/compliance/sasra-report/generate \
  -H "Authorization: Bearer $OFFICER_TOKEN" \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['report']['id'])")

curl -o sasra-report.csv "http://localhost:4000/compliance/sasra-reports/$REPORT_ID/download" \
  -H "Authorization: Bearer $OFFICER_TOKEN"
cat sasra-report.csv

curl http://localhost:4000/compliance/audit-log?limit=5 -H "Authorization: Bearer $OFFICER_TOKEN"
```

## Saved data

Members, accounts, contributions, loan applications, investments, course
progress and the audit log are saved to `data/db.json` after every change and
loaded again when the server starts. A member who registers today can sign in
after the server is stopped and restarted.

- To go back to the demo data, stop the server and delete `data/db.json`.
- The file holds personal data and password hashes. Do not share it or upload it
  to GitHub (`.gitignore` already excludes it).
- Set the `DB_FILE` environment variable to keep the file somewhere else.

## Seeded demo accounts

| Email | Password | Member | Role |
|---|---|---|---|
| `achieng@saccodms.co.ke` | `Teacher@123` | J. Achieng | member (sector: teacher) |
| `mwangi@saccodms.co.ke` | `Officer@123` | P. Mwangi | officer (compliance) |

## What's real vs. simplified

| Concern | This prototype | Production (per architecture doc) |
|---|---|---|
| Data store | In-memory Maps, saved to `data/db.json` after every change so data survives restarts | PostgreSQL, double-entry ledger |
| Passwords | Salted scrypt hashes (built into Node.js); the password itself is never stored | Same idea, usually bcrypt or argon2 |
| Auth token | Random hex string, kept in memory (members sign in again after a restart), no expiry | Short-lived JWT after credential verification |
| Audit log | Appended to an in-memory array | Append-only DB table, no `UPDATE`/`DELETE` grant at the role level |
| Routing | Hand-rolled matcher in `routes/index.js` | Express/NestJS or API-gateway routing |
| M-Pesa, USSD, WhatsApp | Not implemented | Daraja API, Africa's Talking, WhatsApp Business API (see architecture doc §6) |

## Project structure

```
server.js              entry point — wires the middleware pipeline + serves public/
middleware/
  logger.js             request logging
  auth.js                token → member lookup
  rbac.js                role check against a route's allowed roles
  audit.js               writes an audit_log entry for every mutating/sensitive call
routes/
  auth.js, members.js, accounts.js, contributions.js, loans.js,
  investments.js, learning.js, partners.js, compliance.js
  index.js                route registry + path matcher
data/
  store.js               in-memory data standing in for the Postgres schema
public/
  index.html              landing → welcome → sign-in/register → dashboard screens
  styles.css               shared brand tokens (same palette as the design prototype)
  app.js                    fetches real data from the API — no mock data in the browser
  images/                   artwork for the landing page, sector loans, investments and courses
```

## Changing the images

Everything in `public/images` is served automatically — no server edits needed.
The included files are illustrations (SVG). To use real photos instead, add a
`.jpg`/`.png`/`.webp` to that folder and point to it:

| Where it appears | Set in | Current file |
|---|---|---|
| Landing, welcome, sign-in, register backgrounds | `public/styles.css` (search `landing.svg`) | `landing.svg` |
| Loans page banner (per sector) | `public/app.js` (search `sector-`) | `sector-teacher/nurse/farmer/trader.svg` |
| Investment thumbnails | `public/app.js` (search `invest-`) | `invest-real_estate/t_bill/agri_fund.svg` |
| Course thumbnails | `public/app.js` (search `/images/${c.id}`) | `course_debt/invest/interest.svg` |

Keep photos under ~500 KB so pages stay fast, and make sure you have the
rights to use them.

To evolve this toward production: swap `data/store.js` for a Postgres client,
hash passwords properly, swap the auth token for real JWTs, and add the
M-Pesa/USSD/WhatsApp adapters described in the architecture doc — the
middleware pipeline and route shapes don't need to change.
