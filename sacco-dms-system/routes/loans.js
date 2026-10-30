const { loanProducts, loans, nextId } = require("../data/store");

module.exports = [
  {
    method: "GET",
    pattern: "/loan-products",
    handler: (req) => {
      const { sector } = req.query;
      let products = [...loanProducts.values()];
      if (sector) products = products.filter((p) => p.sector === sector);
      return { status: 200, body: { products }, audit: false };
    },
  },
  {
    method: "POST",
    pattern: "/loans/apply",
    handler: (req) => {
      const { product_id, amount, tenure_months } = req.body || {};
      const product = loanProducts.get(product_id);
      if (!product) return { status: 404, body: { error: "Unknown product_id" } };
      if (!amount || amount <= 0) return { status: 400, body: { error: "amount must be positive" } };
      if (tenure_months < product.min_tenure_months || tenure_months > product.max_tenure_months) {
        return {
          status: 422,
          body: { error: `tenure_months must be between ${product.min_tenure_months} and ${product.max_tenure_months} for this product` },
        };
      }

      const loan = {
        id: nextId("loan"),
        member_id: req.actor.id,
        product_id,
        principal: amount,
        tenure_months,
        status: "applied",
        applied_at: new Date().toISOString(),
      };
      loans.set(loan.id, loan);
      return { status: 201, body: { loan } };
    },
  },
  {
    method: "GET",
    pattern: "/loans/:id/status",
    handler: (req) => {
      const loan = loans.get(req.params.id);
      if (!loan || loan.member_id !== req.actor.id) {
        return { status: 404, body: { error: "Loan not found" } };
      }
      return { status: 200, body: { loan }, audit: false };
    },
  },
];
