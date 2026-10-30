const { accounts, transactions, nextId } = require("../data/store");

// A "contribution" is a deposit into a member's savings account. This route
// exists alongside /accounts/:id/deposit to give members a dedicated,
// simpler flow that doesn't require knowing their account id up front.

function findSavingsAccount(memberId) {
  return [...accounts.values()].find((a) => a.member_id === memberId && a.type === "savings");
}

module.exports = [
  {
    method: "GET",
    pattern: "/contributions/me",
    handler: (req) => {
      const myAccountIds = [...accounts.values()]
        .filter((a) => a.member_id === req.actor.id)
        .map((a) => a.id);

      const history = transactions
        .filter((t) => myAccountIds.includes(t.account_id) && t.type === "deposit")
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const total = history.reduce((sum, t) => sum + t.amount, 0);

      return { status: 200, body: { contributions: history, total }, audit: false };
    },
  },
  {
    method: "POST",
    pattern: "/contributions",
    handler: (req) => {
      const { amount, channel } = req.body || {};
      if (!amount || amount <= 0) {
        return { status: 400, body: { error: "amount must be a positive number" } };
      }

      const account = findSavingsAccount(req.actor.id);
      if (!account) {
        return { status: 404, body: { error: "No savings account found for this member" } };
      }

      account.balance += amount;
      const tx = {
        id: nextId("txn"),
        account_id: account.id,
        type: "deposit",
        amount,
        channel: channel || "web",
        created_at: new Date().toISOString(),
      };
      transactions.push(tx);

      return { status: 201, body: { contribution: tx, new_balance: account.balance } };
    },
  },
];
