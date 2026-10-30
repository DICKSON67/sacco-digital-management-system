// Every request is logged with a timestamp before anything else runs.
// In production this would ship to ELK/CloudWatch rather than stdout.
function logger(req) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.pathname}`);
}

module.exports = { logger };
