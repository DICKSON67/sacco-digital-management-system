const { members, loans, loanProducts } = require("../data/store");

// Officer-only routes: who has applied for a loan, who has registered, and the
// decisions on both. Every POST here is written to the audit log automatically
// by the request pipeline in server.js.

const publicMember = (m) => ({
  id: m.id, full_name: m.full_name, email: m.email, sector: m.sector,
  kyc_status: m.kyc_status, created_at: m.created_at || null,
  decided_by: m.decided_by || null, decided_at: m.decided_at || null,
});

const decisions = { approve: "approve", reject: "reject" };

module.exports = [
  // ---- members ---------------------------------------------------------------
  {
    method: "GET",
    pattern: "/officer/members",
    roles: ["officer"],
    handler: () => {
      const rank = { pending: 0, rejected: 1, verified: 2 };
      const list = [...members.values()]
        .filter((m) => m.role === "member")
        .map(publicMember)
        .sort((a, b) => (rank[a.kyc_status] ?? 3) - (rank[b.kyc_status] ?? 3) ||
                        String(b.created_at).localeCompare(String(a.created_at)));
      const counts = { pending: 0, verified: 0, rejected: 0 };
      list.forEach((m) => { if (m.kyc_status in counts) counts[m.kyc_status]++; });
      return { status: 200, body: { members: list, counts }, audit: false };
    },
  },
  {
    method: "POST",
    pattern: "/officer/members/:id/decision",
    roles: ["officer"],
    handler: (req) => {
      const decision = decisions[(req.body || {}).decision];
      if (!decision) return { status: 400, body: { error: 'decision must be "approve" or "reject"' } };
      const member = members.get(req.params.id);
      if (!member || member.role !== "member") return { status: 404, body: { error: "Member not found" } };
      member.kyc_status = decision === "approve" ? "verified" : "rejected";
      member.decided_by = req.actor.id;
      member.decided_at = new Date().toISOString();
      return { status: 200, body: { member: publicMember(member) } };
    },
  },

  // ---- loan applications -----------------------------------------------------
  {
    method: "GET",
    pattern: "/officer/loans",
    roles: ["officer"],
    handler: () => {
      const rank = { applied: 0, approved: 1, rejected: 2 };
      const list = [...loans.values()].map((l) => {
        const m = members.get(l.member_id);
        const p = loanProducts.get(l.product_id);
        return {
          ...l,
          applicant_name: m ? m.full_name : "(unknown member)",
          applicant_email: m ? m.email : "",
          applicant_sector: m ? m.sector : "",
          product_name: p ? p.name : l.product_id,
        };
      }).sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) ||
                        String(b.applied_at).localeCompare(String(a.applied_at)));
      const counts = { applied: 0, approved: 0, rejected: 0 };
      list.forEach((l) => { if (l.status in counts) counts[l.status]++; });
      return { status: 200, body: { loans: list, counts }, audit: false };
    },
  },
  {
    method: "POST",
    pattern: "/officer/loans/:id/decision",
    roles: ["officer"],
    handler: (req) => {
      const { decision: d, note } = req.body || {};
      const decision = decisions[d];
      if (!decision) return { status: 400, body: { error: 'decision must be "approve" or "reject"' } };
      const loan = loans.get(req.params.id);
      if (!loan) return { status: 404, body: { error: "Loan application not found" } };
      if (loan.status !== "applied") {
        return { status: 409, body: { error: `This application was already ${loan.status}` } };
      }
      loan.status = decision === "approve" ? "approved" : "rejected";
      loan.decided_by = req.actor.id;
      loan.decided_at = new Date().toISOString();
      loan.decision_note = String(note || "").slice(0, 200);
      return { status: 200, body: { loan } };
    },
  },
];
