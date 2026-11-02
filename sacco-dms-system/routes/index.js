const allRoutes = [
  ...require("./auth"),
  ...require("./members"),
  ...require("./accounts"),
  ...require("./contributions"),
  ...require("./loans"),
  ...require("./investments"),
  ...require("./learning"),
  ...require("./partners"),
  ...require("./compliance"),
  ...require("./officer"),
  ...require("./admin"),
];

function toSegments(pathname) {
  return pathname.split("/").filter(Boolean);
}

// Matches a request to a route definition, extracting :params along the way.
// A hand-rolled matcher keeps this dependency-free; a real deployment would
// use the router built into NestJS/Express/whatever framework is chosen.
function match(method, pathname) {
  const reqSegments = toSegments(pathname);

  for (const route of allRoutes) {
    if (route.method !== method) continue;
    const routeSegments = toSegments(route.pattern);
    if (routeSegments.length !== reqSegments.length) continue;

    const params = {};
    let matched = true;

    for (let i = 0; i < routeSegments.length; i++) {
      const rs = routeSegments[i];
      const qs = reqSegments[i];
      if (rs.startsWith(":")) {
        params[rs.slice(1)] = decodeURIComponent(qs);
      } else if (rs !== qs) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return { handler: route.handler, params, roles: route.roles, public: !!route.public };
    }
  }
  return null;
}

module.exports = { match };
