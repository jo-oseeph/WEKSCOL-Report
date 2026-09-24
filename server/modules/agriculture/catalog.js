const reportMetadata = {
  "open-requests": {
    id: "open-requests",
    name: "Open Request Log",
    description: "Customer care requests that are still open or in progress.",
    variants: ["summary", "detailed"],
  },
  "resolved-requests": {
    id: "resolved-requests",
    name: "Resolved Request Log",
    description: "Customer care requests resolved through field action.",
    variants: ["summary", "detailed"],
  },
  "farmer-requests": {
    id: "farmer-requests",
    name: "Farmers Request",
    description: "Farmer request history grouped by farmer and request type.",
    variants: ["summary", "detailed"],
  },
  "cane-supply": {
    id: "cane-supply",
    name: "Cane Supply",
    description: "Cane supply details and summaries by unit, sector, zone, section and month.",
    variants: ["detailed", "summary"],
    summaryGroups: ["unit", "sector", "zone", "section", "month"],
  },
  "daily-weighment": {
    id: "daily-weighment",
    name: "Daily Weighment Report",
    description: "Daily weighment details and summaries by unit, sector, zone, section and month.",
    variants: ["detailed", "summary"],
    summaryGroups: ["unit", "sector", "zone", "section", "month"],
  },
  overdue: {
    id: "overdue",
    name: "Investment Overdue Report",
    description: "Agriculture investment details and summaries by unit, sector, zone and section.",
    variants: ["detailed", "summary"],
    summaryGroups: ["unit", "sector", "zone", "section"],
  },
};

export const agricultureModule = {
  id: "agriculture",
  name: "Agriculture",
  description: "Field operations, farmer services and cane development reports.",
  subcategories: [
    {
      id: "leads-collection",
      name: "Leads Collection",
      reports: [
        reportMetadata["open-requests"],
        reportMetadata["resolved-requests"],
        reportMetadata["farmer-requests"],
      ],
    },
    {
      id: "harvesting",
      name: "Harvesting",
      reports: [reportMetadata["cane-supply"], reportMetadata["daily-weighment"]],
    },
    {
      id: "investment",
      name: "Investment",
      reports: [reportMetadata.overdue],
    },
  ],
};

export default agricultureModule;