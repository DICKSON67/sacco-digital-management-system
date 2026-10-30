const { courses, courseProgress } = require("../data/store");

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
];
