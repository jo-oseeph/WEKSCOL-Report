import agricultureModule from "./agriculture/catalog.js";

const emptyModule = (id, name, description) => ({
  id,
  name,
  description,
  subcategories: [],
});

export const reportModules = [
  agricultureModule,
  emptyModule("transport", "Transport", "Cane haulage, fleet, logistics and dispatch reports."),
  emptyModule("finance", "Finance", "Payables, receivables, ledger and commercial reports."),
  emptyModule("hr", "Human Resource", "Payroll and workforce management reports."),
];

// Returns the nested category, subcategory, and report catalog.
export function getReportModuleCatalog() {
  return reportModules;
}

// Returns all catalog reports as a flat list with their category identifiers.
export function getFlatReportCatalog() {
  return reportModules.flatMap((module) => module.subcategories.flatMap((subcategory) =>
    subcategory.reports.map((report) => ({
      ...report,
      categoryId: module.id,
      subcategoryId: subcategory.id,
    })),
  ));
}
