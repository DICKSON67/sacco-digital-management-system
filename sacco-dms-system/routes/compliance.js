const { auditLog, sasraSnapshot, sasraReports, nextId } = require("../data/store");

function reportToCsv(report) {
  const lines = [
    "field,value",
    `report_id,${report.id}`,
    `period,${report.period}`,
    `capital_adequacy_ratio,${report.capital_adequacy_ratio}`,
    `liquidity_ratio,${report.liquidity_ratio}`,
    `npl_ratio,${report.npl_ratio}`,
    `generated_at,${report.generated_at}`,
    `submitted_at,${report.submitted_at || ""}`,
  ];
  return lines.join("\n");
}

module.exports = [
  {
    method: "GET",
    pattern: "/compliance/ratios",
    roles: ["officer"],
    handler: () => ({ status: 200, body: { ratios: sasraSnapshot }, audit: false }),
  },
  {
    method: "GET",
    pattern: "/compliance/audit-log",
    roles: ["officer"],
    handler: (req) => {
      const limit = Number(req.query.limit) || 20;
      const page = auditLog.slice(-limit).reverse();
      return { status: 200, body: { entries: page, total: auditLog.length }, audit: false };
    },
  },
  {
    method: "POST",
    pattern: "/compliance/sasra-report/generate",
    roles: ["officer"],
    handler: () => {
      const report = {
        id: nextId("report"),
        period: new Date().toISOString().slice(0, 10),
        ...sasraSnapshot,
        generated_at: new Date().toISOString(),
        submitted_at: null, // would be set once pushed to the SASRA portal
      };
      sasraReports.push(report);
      return { status: 201, body: { report } };
    },
  },
  {
    method: "GET",
    pattern: "/compliance/sasra-reports",
    roles: ["officer"],
    handler: () => ({
      status: 200,
      body: { reports: [...sasraReports].reverse() },
      audit: false,
    }),
  },
  {
    method: "GET",
    pattern: "/compliance/sasra-reports/:id/download",
    roles: ["officer"],
    handler: (req) => {
      const report = sasraReports.find((r) => r.id === req.params.id);
      if (!report) return { status: 404, body: { error: "Report not found" } };
      return {
        status: 200,
        contentType: "text/csv",
        filename: `sasra-report-${report.period}.csv`,
        rawBody: reportToCsv(report),
      };
    },
  },
];
