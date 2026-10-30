const { partners } = require("../data/store");

module.exports = [
  {
    method: "GET",
    pattern: "/partners",
    handler: (req) => {
      const { category } = req.query;
      let list = [...partners.values()];
      if (category) list = list.filter((p) => p.category === category);
      return { status: 200, body: { partners: list }, audit: false };
    },
  },
];
