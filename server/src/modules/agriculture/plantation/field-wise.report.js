export default {
  id: "field-wise",
  name: "Field-Wise Report",
  description: "Field-level plantation delivery details and month-wise field summaries.",
  categoryId: "agriculture",
  subcategoryId: "plantation",
  queryModule: "plantation",
  variants: ["detailed", "summary"],
  variantLabels: {
    detailed: "Field-Wise Report",
    summary: "Summary: Month-Wise",
  },
  summaryGroups: ["unit"],
  params: [
    { name: "unit", type: "string", sql: "Unit_name = @unit" },
    { name: "sector", type: "string", sql: "Sector_Name = @sector" },
    { name: "zone", type: "string", sql: "Zone_Name = @zone" },
    { name: "section", type: "string", sql: "Section_Name = @section" },
    { name: "dateFrom", type: "date", sql: "Delivery_Date >= @dateFrom" },
    { name: "dateTo", type: "date", sql: "Delivery_Date < DATEADD(DAY, 1, @dateTo)" },
  ],
};