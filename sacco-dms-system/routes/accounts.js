const { accounts, transactions, nextId } = require("../data/store");

module.exports = [
  {
    method: "GET",
    pattern: "/accounts/me",
    handler: (req) => {
      const mine = [...accounts.values()].filter((a) => a.member_id === req.actor.id);
      return { status: 200, body: { accounts: mine }, audit: false };
    },
  },
  {
    method: "POST",
    pattern: "/accounts/:id/deposit",
    handler: (req) => {
      const account = accounts.get(req.params.id);
      if (!account || account.member_id !== req.actor.id) {
        return { status: 404, body: { error: "Account not found" } };
      }
      const { amount, channel } = req.body || {};
      if (!amount || amount <= 0) {
        return { status: 400, body: { error: "amount must be a positive number" } };
      }
      account.balance += amount;
      const tx = {
        id: nextId("txn"),
        account_id: account.id,
        type: "deposit",
        amount,
        channel: channel || "app",
        created_at: new Date().toISOString(),
      };
      transactions.push(tx);
      return { status: 201, body: { transaction: tx, new_balance: account.balance } };
    },
  },
];
