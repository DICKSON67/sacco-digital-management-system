const { investmentProducts, holdings, dividendHistory, memberSettings, nextId } = require("../data/store");

module.exports = [
  {
    method: "GET",
    pattern: "/investments/products",
    handler: () => ({ status: 200, body: { products: [...investmentProducts.values()] }, audit: false }),
  },
  {
    method: "POST",
    pattern: "/investments/:product_id/buy",
    handler: (req) => {
      const product = investmentProducts.get(req.params.product_id);
      if (!product) return { status: 404, body: { error: "Unknown product" } };
      const { units } = req.body || {};
      if (!units || units <= 0) return { status: 400, body: { error: "units must be a positive number" } };

      const key = `${req.actor.id}:${product.id}`;
      const existing = holdings.get(key);
      const total_units = (existing ? existing.units : 0) + units;
      holdings.set(key, { member_id: req.actor.id, product_id: product.id, units: total_units, purchased_at: new Date().toISOString() });

      return {
        status: 201,
        body: { holding: holdings.get(key), cost: units * product.unit_price },
      };
    },
  },
  {
    method: "GET",
    pattern: "/investments/dividends/history",
    handler: () => ({ status: 200, body: { history: dividendHistory }, audit: false }),
  },
  {
    method: "PATCH",
    pattern: "/investments/settings",
    handler: (req) => {
      const { reinvest } = req.body || {};
      if (typeof reinvest !== "boolean") {
        return { status: 400, body: { error: "reinvest must be a boolean" } };
      }
      memberSettings.set(req.actor.id, { reinvest });
      return { status: 200, body: { settings: memberSettings.get(req.actor.id) } };
    },
  },
];
