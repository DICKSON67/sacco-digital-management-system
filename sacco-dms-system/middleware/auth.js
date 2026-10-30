const { tokens, members } = require("../data/store");

// Real deployment: short-lived JWT issued after biometric/OTP verification
// (see architecture doc §7). Here we use a simple opaque token map so the
// prototype has no external dependencies.
function authenticate(req) {
  const header = req.headers["authorization"] || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return { ok: false, error: "Missing or malformed Authorization header. Use: Bearer <token>" };
  }

  const memberId = tokens.get(token);
  if (!memberId) {
    return { ok: false, error: "Invalid or expired token" };
  }

  const actor = members.get(memberId);
  if (!actor) {
    return { ok: false, error: "Token refers to an unknown member" };
  }

  return { ok: true, actor };
}

module.exports = { authenticate };
