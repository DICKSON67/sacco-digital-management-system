const { auditLog, nextId } = require("../data/store");

// In production this insert happens inside the SAME database transaction as
// the business write (architecture doc §5), and the table is append-only at
// the DB permission level — no service account can UPDATE or DELETE it.
function writeAudit({ actor_id, action, ip_address, metadata }) {
  auditLog.push({
    id: nextId("audit"),
    actor_id: actor_id || null,
    action,
    ip_address: ip_address || "unknown",
    metadata: metadata || {},
    created_at: new Date().toISOString(),
  });
}

module.exports = { writeAudit };
