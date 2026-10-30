const crypto = require("crypto");

// Passwords are never stored. Only a salted scrypt hash is kept, in the form
//   scrypt$<salt hex>$<hash hex>
// scrypt is built into Node.js, so no extra package is needed.

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function isHashed(value) {
  return typeof value === "string" && value.startsWith("scrypt$");
}

function verifyPassword(password, stored) {
  if (!isHashed(stored)) return false;
  const [, saltHex, hashHex] = stored.split("$");
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, verifyPassword, isHashed };
