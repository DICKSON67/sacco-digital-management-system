const http = require("http");
const fs = require("fs");
const path = require("path");
const { logger } = require("./middleware/logger");
const { authenticate } = require("./middleware/auth");
const { authorize } = require("./middleware/rbac");
const { writeAudit } = require("./middleware/audit");
const { save } = require("./data/store");
const routes = require("./routes");

const PORT = process.env.PORT || 4000;

function send(res, status, body) {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(json);
}

// The web frontend (public/) is served from the same origin as the API,
// so the browser needs no CORS configuration to call these endpoints.
const STATIC_FILES = {
  "/": { file: "public/index.html", type: "text/html" },
  "/styles.css": { file: "public/styles.css", type: "text/css" },
  "/app.js": { file: "public/app.js", type: "application/javascript" },
};

// Anything dropped into public/images is served automatically, so adding a
// new picture never requires editing this file.
const IMAGE_TYPES = {
  ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
};
const IMAGES_DIR = path.join(__dirname, "public", "images");

function serveImage(req, res) {
  if (req.method !== "GET" || !req.pathname.startsWith("/images/")) return false;
  const filePath = path.join(IMAGES_DIR, path.basename(decodeURIComponent(req.pathname)));
  const type = IMAGE_TYPES[path.extname(filePath).toLowerCase()];
  // path.basename strips any ../ so requests can't escape the images folder.
  if (!type) { res.writeHead(404); res.end("Not found"); return true; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "public, max-age=3600" });
    res.end(data);
  });
  return true;
}

function serveStatic(req, res) {
  if (serveImage(req, res)) return true;
  const entry = STATIC_FILES[req.pathname];
  if (!entry || req.method !== "GET") return false;
  const filePath = path.join(__dirname, entry.file);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end("Failed to load frontend asset");
    }
    res.writeHead(200, { "Content-Type": entry.type });
    res.end(data);
  });
  return true;
}

const server = http.createServer((req, res) => {
  const start = Date.now();
  const url = new URL(req.url, `http://${req.headers.host}`);
  req.query = Object.fromEntries(url.searchParams);
  req.pathname = url.pathname;

  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    // ---- 0. static frontend files ----
    if (serveStatic(req, res)) return;

    // ---- 1. parse body ----
    try {
      req.body = raw ? JSON.parse(raw) : {};
    } catch {
      return send(res, 400, { error: "Invalid JSON body" });
    }

    // ---- 2. log ----
    logger(req);

    // ---- 3. route match ----
    const match = routes.match(req.method, req.pathname);
    if (!match) return send(res, 404, { error: `No route for ${req.method} ${req.pathname}` });

    const { handler, params, roles, public: isPublic } = match;
    req.params = params;

    // ---- 4. authenticate ----
    if (!isPublic) {
      const authResult = authenticate(req);
      if (!authResult.ok) return send(res, 401, { error: authResult.error });
      req.actor = authResult.actor;

      // ---- 5. authorize ----
      if (!authorize(req.actor, roles)) {
        return send(res, 403, { error: "Forbidden — your role cannot access this endpoint" });
      }
    }

    // ---- 6. handle ----
    let result;
    try {
      result = handler(req);
    } catch (err) {
      console.error(err);
      return send(res, 500, { error: "Internal server error" });
    }

    // ---- 7. audit (mutating / sensitive routes only) ----
    if (!isPublic && result.audit !== false) {
      writeAudit({
        actor_id: req.actor.id,
        action: `${req.method} ${req.pathname}`,
        ip_address: req.socket.remoteAddress,
        metadata: { status: result.status || 200 },
      });
    }

    // Persist after any change (POST, PATCH, ...). Reads never trigger a save.
    if (req.method !== "GET" && (result.status || 200) < 400 && req.pathname !== "/auth/login") {
      try { save(); } catch (err) { console.error("Could not save data:", err.message); }
    }

    // A route can return `rawBody` + `contentType`/`filename` instead of
    // `body` to trigger a real file download (used by the SASRA report
    // export) rather than a JSON response.
    if (result.rawBody !== undefined) {
      res.writeHead(result.status || 200, {
        "Content-Type": result.contentType || "text/plain",
        "Content-Disposition": `attachment; filename="${result.filename || "download.txt"}"`,
      });
      res.end(result.rawBody);
    } else {
      send(res, result.status || 200, result.body);
    }
    console.log(`  → ${result.status || 200} (${Date.now() - start}ms)`);
  });
});

server.listen(PORT, () => {
  console.log(`SACCO Digital Management System API listening on http://localhost:${PORT}`);
  console.log(`Try: POST /auth/login  { "email": "achieng@saccodms.co.ke", "password": "Teacher@123" }`);
});

module.exports = server;
