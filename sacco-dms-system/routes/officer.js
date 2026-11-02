const { members, courses, courseProgress, events, nextId } = require("../data/store");

// System administrator routes. The administrator looks after the learning content
// and business events that members see, and can view the list of users. The
// administrator does not approve loans or members: that stays with officers.

const text = (v, max) => String(v ?? "").trim().slice(0, max);

function validDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(d + "T00:00:00Z");
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

module.exports = [
  // ---- users (read only) -------------------------------------------------------
  {
    method: "GET",
    pattern: "/admin/users",
    roles: ["admin"],
    handler: () => {
      const users = [...members.values()].map((m) => ({
        id: m.id, full_name: m.full_name, email: m.email, phone: m.phone || null,
        role: m.role, sector: m.sector, kyc_status: m.kyc_status, created_at: m.created_at || null,
      }));
      return { status: 200, body: { users }, audit: false };
    },
  },

  // ---- learning content --------------------------------------------------------
  {
    method: "POST",
    pattern: "/admin/courses",
    roles: ["admin"],
    handler: (req) => {
      const b = req.body || {};
      const title = text(b.title, 120);
      const duration = Number(b.duration_minutes);
      const link = text(b.link, 300);
      if (title.length < 3) return { status: 400, body: { error: "title must be at least 3 characters" } };
      if (!Number.isFinite(duration) || duration < 1 || duration > 600) {
        return { status: 400, body: { error: "duration_minutes must be a number between 1 and 600" } };
      }
      if (link && !/^https?:\/\/\S+$/i.test(link)) {
        return { status: 400, body: { error: "link must start with http:// or https://" } };
      }
      const course = {
        id: nextId("course"), title, duration_minutes: Math.round(duration),
        description: text(b.description, 300), content: text(b.content, 5000), link,
        created_by: req.actor.id, created_at: new Date().toISOString(),
      };
      courses.set(course.id, course);
      return { status: 201, body: { course } };
    },
  },
  {
    method: "DELETE",
    pattern: "/admin/courses/:id",
    roles: ["admin"],
    handler: (req) => {
      if (!courses.has(req.params.id)) return { status: 404, body: { error: "Course not found" } };
      courses.delete(req.params.id);
      for (const key of [...courseProgress.keys()]) {
        if (key.endsWith(":" + req.params.id)) courseProgress.delete(key);
      }
      return { status: 200, body: { deleted: req.params.id } };
    },
  },

  // ---- business events ---------------------------------------------------------
  {
    method: "GET",
    pattern: "/admin/events",
    roles: ["admin"],
    handler: () => ({
      status: 200,
      body: { events: [...events.values()].sort((a, b) => a.date.localeCompare(b.date)) },
      audit: false,
    }),
  },
  {
    method: "POST",
    pattern: "/admin/events",
    roles: ["admin"],
    handler: (req) => {
      const b = req.body || {};
      const title = text(b.title, 120);
      const date = text(b.date, 10);
      const time = text(b.time, 5);
      if (title.length < 3) return { status: 400, body: { error: "title must be at least 3 characters" } };
      if (!validDate(date)) return { status: 400, body: { error: "date must be a real date in the form YYYY-MM-DD" } };
      if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        return { status: 400, body: { error: "time must be in the form HH:MM (24 hour)" } };
      }
      const event = {
        id: nextId("event"), title, date, time,
        location: text(b.location, 120), description: text(b.description, 500),
        created_by: req.actor.id, created_at: new Date().toISOString(),
      };
      events.set(event.id, event);
      return { status: 201, body: { event } };
    },
  },
  {
    method: "DELETE",
    pattern: "/admin/events/:id",
    roles: ["admin"],
    handler: (req) => {
      if (!events.has(req.params.id)) return { status: 404, body: { error: "Event not found" } };
      events.delete(req.params.id);
      return { status: 200, body: { deleted: req.params.id } };
    },
  },
];
