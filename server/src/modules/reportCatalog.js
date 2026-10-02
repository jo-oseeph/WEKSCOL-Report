//

export function visibleReportCatalog(catalog, user) {
  const isAdmin = user?.role === "admin";
  const allowedReportIds = isAdmin ? null : new Set(user?.permissions || []);
  const reports = [...catalog.reports.values()].filter(
    (report) => isAdmin || allowedReportIds.has(report.id),
  );
  const visibleReportIds = new Set(reports.map((report) => report.id));
  const categories = catalog.categories
    .map((category) => ({
      ...category,
      subcategories: category.subcategories
        .map((subcategory) => ({
          ...subcategory,
          reports: subcategory.reports.filter((report) => visibleReportIds.has(report.id)),
        }))
        .filter((subcategory) => subcategory.reports.length > 0),
    }));

  return { categories, reports };
}