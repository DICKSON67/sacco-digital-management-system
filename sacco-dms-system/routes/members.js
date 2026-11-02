const { accounts } = require("../data/store");

module.exports = [
  {
    method: "GET",
    pattern: "/members/me",
    handler: (req) => {
      // Total of the member's savings accounts. Staff accounts have none (null).
      const savingsAccounts = [...accounts.values()].filter((a) => a.member_id === req.actor.id && a.type === "savings");
      const savings = savingsAccounts.length ? savingsAccounts.reduce((sum, a) => sum + a.balance, 0) : null;
      return {
        status: 200,
        body: {
          id: req.actor.id,
          full_name: req.actor.full_name,
          email: req.actor.email,
          phone: req.actor.phone || null,
          sector: req.actor.sector,
          role: req.actor.role,
          kyc_status: req.actor.kyc_status,
          savings,
        },
        audit: false, // read-only profile fetch, not audit-worthy on its own
      };
    },
  },
];
