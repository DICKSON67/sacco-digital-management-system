const crypto = require("crypto");
const { members, accounts, tokens, nextId } = require("../data/store");
const { hashPassword, verifyPassword } = require("../data/password");

// Verified against when the email is unknown, so a missing account takes as long
// to reject as a wrong password and cannot be told apart by timing.
const DUMMY_HASH = hashPassword("not-a-real-password");

const VALID_SECTORS = ["teacher", "nurse", "farmer", "trader", "other"];

module.exports = [
  {
    method: "POST",
    pattern: "/auth/login",
    public: true,
    handler: (req) => {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return { status: 400, body: { error: "email and password are required" } };
      }

      const member = [...members.values()].find(
        (m) => m.email.toLowerCase() === String(email).toLowerCase()
      );

      // Same generic error whether the email is unknown or the password is
      // wrong — this avoids confirming to an attacker that an email exists.
      const passwordOk = verifyPassword(password, member ? member.password : DUMMY_HASH);
      if (!member || !passwordOk) {
        return { status: 401, body: { error: "Invalid email or password" } };
      }

      const token = crypto.randomBytes(16).toString("hex");
      tokens.set(token, member.id);
      return {
        status: 200,
        body: {
          token,
          member: { id: member.id, full_name: member.full_name, email: member.email, sector: member.sector, role: member.role },
        },
      };
    },
  },
  {
    method: "POST",
    pattern: "/auth/register",
    public: true,
    handler: (req) => {
      const { full_name, email, password, sector, phone } = req.body || {};

      if (!full_name || !email || !password || !sector) {
        return { status: 400, body: { error: "full_name, email, password and sector are required" } };
      }
      if (!VALID_SECTORS.includes(sector)) {
        return { status: 400, body: { error: `sector must be one of: ${VALID_SECTORS.join(", ")}` } };
      }
      if (password.length < 8) {
        return { status: 400, body: { error: "password must be at least 8 characters" } };
      }

      const emailLower = String(email).toLowerCase();
      const exists = [...members.values()].some((m) => m.email.toLowerCase() === emailLower);
      if (exists) {
        return { status: 409, body: { error: "An account with that email already exists" } };
      }

      const memberId = nextId("mem");
      const member = {
        id: memberId,
        full_name,
        email,
        // Only a salted hash is stored, never the password itself.
        password: hashPassword(password),
        phone: phone || null,
        sector,
        // A real system would not verify KYC at signup — it queues Huduma/AML
        // checks (architecture doc §3.6) before the account is fully active.
        kyc_status: "pending",
        role: "member",
      };
      members.set(memberId, member);

      const accountId = nextId("acc");
      accounts.set(accountId, { id: accountId, member_id: memberId, type: "savings", balance: 0 });

      const token = crypto.randomBytes(16).toString("hex");
      tokens.set(token, memberId);

      return {
        status: 201,
        body: {
          token,
          member: { id: member.id, full_name: member.full_name, email: member.email, sector: member.sector, role: member.role },
        },
      };
    },
  },
];
