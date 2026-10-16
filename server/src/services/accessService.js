const blockedStatuses = new Set(["pending", "rejected", "suspended"]);

const createAccessService = ({ accessRepository, catalogRepository, reportCatalog }) => {
  const reports = [...reportCatalog.values()];
  const reportIds = new Set(reports.map((report) => String(report.id)));
  const subcategoryReportIds = new Map();
  for (const report of reports) {
    const ids = subcategoryReportIds.get(report.subcategoryId) || [];
    ids.push(String(report.id));
    subcategoryReportIds.set(report.subcategoryId, ids);
  }

  async function activeReportIds() {
    const states = await catalogRepository.getStates();
    return new Set(reports
      .filter((report) => states.get(String(report.id))?.is_active !== false)
      .map((report) => String(report.id)));
  }

  async function getEffectiveAccess(user) {
    if (!user || blockedStatuses.has(user.status)) return [];
    const activeIds = await activeReportIds();
    if (user.role === "admin") return reports.map((report) => String(report.id)).sort();
    const grants = await accessRepository.getForUser(user.id);
    const effective = new Set();
    for (const subcategoryId of grants.subcategories) {
      for (const reportId of subcategoryReportIds.get(subcategoryId) || []) effective.add(reportId);
    }
    for (const override of grants.overrides) {
      if (override.effect === "allow") effective.add(override.reportId);
      if (override.effect === "deny") effective.delete(override.reportId);
    }
    return [...effective].filter((reportId) => activeIds.has(reportId)).sort();
  }

  async function canAccess(user, reportId) {
    if (!reportIds.has(String(reportId))) return false;
    return (await getEffectiveAccess(user)).includes(String(reportId));
  }

  async function getUserAccess(userId) {
    return accessRepository.getForUser(userId);
  }

  function validateAccessSelection({ subcategoryIds = [], overrides = [] }) {
    const validSubcategories = new Set(
      reports.map((report) => report.subcategoryId).filter(Boolean),
    );
    if (!Array.isArray(subcategoryIds) || subcategoryIds.some((id) => !validSubcategories.has(String(id)))) {
      throw Object.assign(new Error("One or more selected subcategories do not exist."), { statusCode: 400 });
    }
    if (!Array.isArray(overrides)) {
      throw Object.assign(new Error("Report overrides must be an array."), { statusCode: 400 });
    }
    const normalized = overrides.map((override) => ({
      reportId: String(override?.reportId || ""),
      effect: override?.effect,
    }));
    if (normalized.some((override) => !reportIds.has(override.reportId) || !["allow", "deny"].includes(override.effect))) {
      throw Object.assign(new Error("One or more report overrides are invalid."), { statusCode: 400 });
    }
    return {
      subcategoryIds: [...new Set(subcategoryIds.map(String))],
      overrides: [...new Map(normalized.map((item) => [item.reportId, item])).values()],
    };
  }

  return { getEffectiveAccess, canAccess, getUserAccess, activeReportIds, validateAccessSelection, reportIds };
};

export default createAccessService;