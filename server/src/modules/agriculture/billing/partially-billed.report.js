export default {
  id: "billing-partially-billed",
  name: "Partially Billed",
  description: "Supply slips that have billing but remain below their weighed quantity.",
  categoryId: "agriculture",
  subcategoryId: "billing",
  queryModule: "billing",
  variants: ["detailed", "summary"],
  variantLabels: { detailed: "Detailed Report", summary: "Summary Report" },
  summaryGroups: ["unit", "sector", "zone", "section"],
  params: [
    { name: "unit", type: "string", sql: "Sup_Unit_name = @unit" },
    { name: "sector", type: "string", sql: "Sup_Sector_Name = @sector" },
    { name: "zone", type: "string", sql: "Sup_Zone_Name = @zone" },
    { name: "section", type: "string", sql: "Sup_Section_Name = @section" },
    { name: "dateFrom", type: "date", sql: "GROSS_DT1 >= @dateFrom" },
    { name: "dateTo", type: "date", sql: "GROSS_DT1 < DATEADD(DAY, 1, @dateTo)" },
  ],
};