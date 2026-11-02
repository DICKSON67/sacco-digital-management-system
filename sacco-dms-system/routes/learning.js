const { courses, courseProgress, events } = require("../data/store");

// "YYYY-MM-DD" for today in the server's own time zone
function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

module.exports = [
  {
    method: "GET",
    pattern: "/learning/courses",
    handler: (req) => {
      const list = [...courses.values()].map((c) => {
        const progress = courseProgress.get(`${req.actor.id}:${c.id}`);
        return { ...c, percent_complete: progress ? progress.percent_complete : 0 };
      });
      return { status: 200, body: { courses: list }, audit: false };
    },
  },
  {
    method: "PATCH",
    pattern: "/learning/courses/:id/progress",
    handler: (req) => {
      const course = courses.get(req.params.id);
      if (!course) return { status: 404, body: { error: "Unknown course" } };
      const { percent } = req.body || {};
      if (typeof percent !== "number" || percent < 0 || percent > 100) {
        return { status: 400, body: { error: "percent must be a number between 0 and 100" } };
      }
      const key = `${req.actor.id}:${course.id}`;
      courseProgress.set(key, { member_id: req.actor.id, course_id: course.id, percent_complete: percent });
      return { status: 200, body: { progress: courseProgress.get(key) } };
    },
  },
  {
    // Upcoming business events (today and later), soonest first
    method: "GET",
    pattern: "/learning/events",
    handler: () => {
      const upcoming = [...events.values()]
        .filter((e) => e.date >= today())
        .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
      return { status: 200, body: { events: upcoming }, audit: false };
    },
  },
];
