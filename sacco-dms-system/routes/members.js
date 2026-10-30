module.exports = [
  {
    method: "GET",
    pattern: "/members/me",
    handler: (req) => ({
      status: 200,
      body: {
        id: req.actor.id,
        full_name: req.actor.full_name,
        sector: req.actor.sector,
        kyc_status: req.actor.kyc_status,
      },
      audit: false, // read-only profile fetch, not audit-worthy on its own
    }),
  },
];
