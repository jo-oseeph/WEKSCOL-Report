export function visibleReportCatalog(catalog, user, allowedReportIds, activeReportIds) {
  const isAdmin = user?.role === "admin";
  const allowed = isAdmin ? null : new Set(allowedReportIds || user?.permissions || []);
  const active = activeReportIds ? new Set(activeReportIds) : null;
  const reports = [...catalog.reports.values()].filter(
    (report) => (isAdmin || allowed.has(report.id)) && (isAdmin || !active || active.has(report.id)),
  );
  const visibleReportIds = new Set(reports.map((report) => report.id));

  const categories = catalog.categories
    .map((category) => ({
      ...category,
      subcategories: category.subcategories
        .map((subcategory) => ({
          ...subcategory,
          reports: subcategory.reports.filter((report) => visibleReportIds.has(report.id)),
          groups: (subcategory.groups || [])
            .map((group) => ({
              ...group,
              reports: group.reports.filter((report) => visibleReportIds.has(report.id)),
            }))
            .filter((group) => group.reports.length > 0),
        })),
    }));

  return { categories, reports };
}