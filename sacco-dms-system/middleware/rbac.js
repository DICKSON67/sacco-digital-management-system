// Checks the authenticated actor's role against the roles a route allows.
// Routes with no `roles` array are open to any authenticated member.
function authorize(actor, allowedRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(actor.role);
}

module.exports = { authorize };
