// Dummy static data for the WEKSCOL Report prototype.
// Structure: Category -> Subcategory -> Report

const extraFilters = {
  department: {
    name: "department",
    label: "Department",
    type: "select",
    options: ["All", "Nucleus Estate", "Outgrowers", "Head Office"],
  },
  status: {
    name: "status",
    label: "Status",
    type: "select",
    options: ["All", "Pending", "Approved", "Completed"],
  },
};

function buildResults(columns, rowCount, rowFactory) {
  const rows = [];
  for (let i = 1; i <= rowCount; i++) {
    rows.push(rowFactory(i));
  }
  return { columns, rows };
}

function makeReport(name, description, params, results) {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    name,
    description,
    parameters: params,
    results,
  };
}

export const reportCategories = [
  {
    id: "agriculture",
    name: "Agriculture",
    description: "Field operations, land preparation and cane development reports.",
    subcategories: [
      {
        id: "leads-collection",
        name: "Leads Collection",
        reports: [
          { id: "open-requests", name: "Open Requests Log", description: "Customer care requests that are still open or in progress.", parameters: [], results: { columns: [], rows: [] } },
          { id: "resolved-requests", name: "Resolved Requests Log", description: "Customer care requests resolved through field action.", parameters: [], results: { columns: [], rows: [] } },
          { id: "regional-summary", name: "Regional Summary", description: "Request volume, resolution and pending rates by region.", parameters: [], results: { columns: [], rows: [] } },
          { id: "farmer-request-history", name: "Farmer Request History", description: "Request history grouped by farmer.", parameters: [], results: { columns: [], rows: [] } },
        ],
      },
      {
        id: "farmer-recruitment",
        name: "Farmer Recruitment",
        reports: [
          makeReport(
            "Contracted Farmer Area",
            "Summary of contracted farmers and the total area committed to cane production.",
            [extraFilters.status],
            buildResults(
              ["Farmer No.", "Farmer Name", "Zone", "Contracted Area (ha)", "Status"],
              6,
              (i) => [`FRM-${1000 + i}`, `Farmer ${i}`, ["Zone A", "Zone B", "Zone C"][i % 3], `${(i * 3.2).toFixed(1)}`, ["Active", "Pending", "Active"][i % 3]]
            )
          ),
          makeReport(
            "Field Missing E-Contract",
            "Identifies contracted farmer fields that do not have a corresponding electronic contract.",
            [],
            buildResults(
              ["Field ID", "Farmer Name", "Zone", "Area (ha)", "Contract Status"],
              6,
              (i) => [`FLD-${2000 + i}`, `Farmer ${i}`, ["Zone A", "Zone B", "Zone C"][i % 3], `${(i * 1.8).toFixed(1)}`, "Missing E-Contract"]
            )
          ),
          makeReport(
            "Contract Signing List",
            "List of farmer contracts and their current signing progress.",
            [extraFilters.status],
            buildResults(
              ["Contract No.", "Farmer Name", "Zone", "Signing Status", "Signing Date"],
              6,
              (i) => [`CTR-${3000 + i}`, `Farmer ${i}`, ["Zone A", "Zone B", "Zone C"][i % 3], ["Signed", "Pending", "Awaiting Review"][i % 3], `2025-0${(i % 9) + 1}-1${i}`]
            )
          ),
          makeReport(
            "Grower Master Data",
            "Master list of registered growers and their key registration details.",
            [],
            buildResults(
              ["Grower No.", "Grower Name", "National ID", "Phone Number", "Zone"],
              6,
              (i) => [`GRW-${4000 + i}`, `Grower ${i}`, `ID${100000 + i}`, `0712 000 ${String(i).padStart(3, "0")}`, ["Zone A", "Zone B", "Zone C"][i % 3]]
            )
          ),
          makeReport(
            "Farmer Field Register Report",
            "Register of farmer fields, ownership details and registered production area.",
            [],
            buildResults(
              ["Field ID", "Farmer Name", "Village", "Area (ha)", "Crop Year"],
              6,
              (i) => [`FLD-${5000 + i}`, `Farmer ${i}`, ["Village A", "Village B", "Village C"][i % 3], `${(i * 2.1).toFixed(1)}`, "2025/2026"]
            )
          ),
        ],
      },
      {
        id: "land-preparation",
        name: "Land Preparation",
        reports: [
          makeReport(
            "Land Preparation Service List",
            "List of land preparation services requested and scheduled for farmer fields.",
            [extraFilters.status],
            buildResults(
              ["Service No.", "Farmer Name", "Field ID", "Service Type", "Status"],
              6,
              (i) => [`LPS-${1000 + i}`, `Farmer ${i}`, `FLD-${6000 + i}`, ["Ploughing", "Harrowing", "Ridging"][i % 3], ["Requested", "Scheduled", "Completed"][i % 3]]
            )
          ),
          makeReport(
            "Seed Cane Request List",
            "List of seed cane requests submitted for land preparation and planting activities.",
            [extraFilters.status],
            buildResults(
              ["Request No.", "Farmer Name", "Zone", "Quantity (Tons)", "Status"],
              6,
              (i) => [`SCR-${2000 + i}`, `Farmer ${i}`, ["Zone A", "Zone B", "Zone C"][i % 3], `${i * 4}`, ["Submitted", "Approved", "Pending"][i % 3]]
            )
          ),
          makeReport(
            "Fertilizer Request List",
            "List of fertilizer requests raised for registered farmer fields.",
            [extraFilters.status],
            buildResults(
              ["Request No.", "Farmer Name", "Fertilizer Type", "Quantity (Bags)", "Status"],
              6,
              (i) => [`FTR-${3000 + i}`, `Farmer ${i}`, ["DAP", "CAN", "NPK"][i % 3], `${i * 8}`, ["Submitted", "Approved", "Pending"][i % 3]]
            )
          ),
          makeReport(
            "Seed Cane Approved",
            "Approved seed cane requests ready for issue to farmers.",
            [],
            buildResults(
              ["Approval No.", "Farmer Name", "Zone", "Approved Quantity (Tons)", "Approval Date"],
              6,
              (i) => [`SCA-${4000 + i}`, `Farmer ${i}`, ["Zone A", "Zone B", "Zone C"][i % 3], `${i * 4}`, `2025-0${(i % 9) + 1}-1${i}`]
            )
          ),
          makeReport(
            "Goods Issue by Seed Cane",
            "Goods issued to farmers against approved seed cane requests.",
            [],
            buildResults(
              ["Issue No.", "Farmer Name", "Seed Cane Variety", "Quantity (Tons)", "Issue Date"],
              6,
              (i) => [`GIS-${5000 + i}`, `Farmer ${i}`, ["KEN 82-247", "CO 421", "N14"][i % 3], `${i * 3}`, `2025-0${(i % 9) + 1}-2${i}`]
            )
          ),
          makeReport(
            "Goods Issue by Fertilizer",
            "Goods issued to farmers against approved fertilizer requests.",
            [],
            buildResults(
              ["Issue No.", "Farmer Name", "Fertilizer Type", "Quantity (Bags)", "Issue Date"],
              6,
              (i) => [`GIF-${6000 + i}`, `Farmer ${i}`, ["DAP", "CAN", "NPK"][i % 3], `${i * 6}`, `2025-0${(i % 9) + 1}-2${i}`]
            )
          ),
          makeReport(
            "Fertilizer Approved",
            "Approved fertilizer requests ready for issue to farmers.",
            [],
            buildResults(
              ["Approval No.", "Farmer Name", "Fertilizer Type", "Approved Quantity (Bags)", "Approval Date"],
              6,
              (i) => [`FPA-${7000 + i}`, `Farmer ${i}`, ["DAP", "CAN", "NPK"][i % 3], `${i * 7}`, `2025-0${(i % 9) + 1}-2${i}`]
            )
          ),
        ],
      },
      {
        id: "growth-crop-monitoring",
        name: "Growth Crop Monitoring",
        reports: [
          makeReport(
            "Age-Wise Cane Analysis",
            "Analysis of cane fields grouped by crop age and production area.",
            [],
            buildResults(
              ["Age Group", "Field Count", "Area (ha)", "Estimated Yield (Tons)"],
              6,
              (i) => [`${6 + i}-${7 + i} Months`, `${i * 12}`, `${(i * 18.5).toFixed(1)}`, `${i * 145}`]
            )
          ),
          makeReport(
            "Month-Wise Cane Planting",
            "Monthly summary of cane planting activity and area planted.",
            [],
            buildResults(
              ["Month", "Fields Planted", "Area Planted (ha)", "Zone"],
              6,
              (i) => [`2025-${String(i).padStart(2, "0")}`, `${i * 8}`, `${(i * 12.4).toFixed(1)}`, ["Zone A", "Zone B", "Zone C"][i % 3]]
            )
          ),
          makeReport(
            "Month-Wise Cane Harvesting",
            "Monthly summary of cane fields harvested and tonnage delivered.",
            [],
            buildResults(
              ["Month", "Fields Harvested", "Area Harvested (ha)", "Tonnage (Tons)"],
              6,
              (i) => [`2025-${String(i).padStart(2, "0")}`, `${i * 6}`, `${(i * 9.2).toFixed(1)}`, `${i * 110}`]
            )
          ),
          makeReport(
            "Month-Wise Cane Supply",
            "Monthly summary of cane supplied to the factory by production zone.",
            [],
            buildResults(
              ["Month", "Zone", "Supplied Fields", "Supply (Tons)"],
              6,
              (i) => [`2025-${String(i).padStart(2, "0")}`, ["Zone A", "Zone B", "Zone C"][i % 3], `${i * 5}`, `${i * 125}`]
            )
          ),
          makeReport(
            "Cane Available to Harvest",
            "Identifies mature cane fields currently available for harvesting.",
            [],
            buildResults(
              ["Field ID", "Farmer Name", "Age (Months)", "Area (ha)", "Zone"],
              6,
              (i) => [`FLD-${8000 + i}`, `Farmer ${i}`, `${12 + i}`, `${(i * 2.8).toFixed(1)}`, ["Zone A", "Zone B", "Zone C"][i % 3]]
            )
          ),
          makeReport(
            "Contracted but Not Planted",
            "Contracted farmer fields that have not yet been recorded as planted.",
            [],
            buildResults(
              ["Field ID", "Farmer Name", "Contracted Area (ha)", "Zone", "Contract Date"],
              6,
              (i) => [`FLD-${9000 + i}`, `Farmer ${i}`, `${(i * 3.1).toFixed(1)}`, ["Zone A", "Zone B", "Zone C"][i % 3], `2025-0${(i % 9) + 1}-1${i}`]
            )
          ),
        ],
      },
      {
        id: "harvesting-process",
        name: "Harvesting Process",
        reports: [
          makeReport(
            "Yield Assessment",
            "Field-level yield assessment results used to support harvest planning.",
            [],
            buildResults(
              ["Assessment No.", "Field ID", "Farmer Name", "Estimated Yield (Tons)", "Assessment Date"],
              6,
              (i) => [`YLD-${1000 + i}`, `FLD-${10000 + i}`, `Farmer ${i}`, `${i * 42}`, `2025-0${(i % 9) + 1}-1${i}`]
            )
          ),
          makeReport(
            "Harvest Plan",
            "Planned harvest activities by field, farmer and scheduled date.",
            [extraFilters.status],
            buildResults(
              ["Plan No.", "Field ID", "Farmer Name", "Planned Date", "Status"],
              6,
              (i) => [`HPL-${2000 + i}`, `FLD-${11000 + i}`, `Farmer ${i}`, `2025-0${(i % 9) + 1}-2${i}`, ["Planned", "Approved", "Completed"][i % 3]]
            )
          ),
          makeReport(
            "Harvest Permit",
            "Harvest permits issued for approved cane harvesting activities.",
            [],
            buildResults(
              ["Permit No.", "Field ID", "Farmer Name", "Permit Date", "Expiry Date"],
              6,
              (i) => [`HPR-${3000 + i}`, `FLD-${12000 + i}`, `Farmer ${i}`, `2025-0${(i % 9) + 1}-1${i}`, `2025-0${(i % 9) + 2}-1${i}`]
            )
          ),
          makeReport(
            "Harvest CCS",
            "Harvested cane tonnage and commercial cane sugar results by field.",
            [],
            buildResults(
              ["Harvest No.", "Field ID", "Cane Harvested (Tons)", "CCS %", "Harvest Date"],
              6,
              (i) => [`HCS-${4000 + i}`, `FLD-${13000 + i}`, `${i * 48}`, `${(10 + i * 0.4).toFixed(1)}`, `2025-0${(i % 9) + 1}-2${i}`]
            )
          ),
          makeReport(
            "CCS Reconciliation",
            "Reconciliation of harvested cane, delivered tonnage and commercial cane sugar.",
            [],
            buildResults(
              ["Reconciliation No.", "Field ID", "Delivered (Tons)", "Factory Weight (Tons)", "Variance (Tons)"],
              6,
              (i) => [`CCR-${5000 + i}`, `FLD-${14000 + i}`, `${i * 46}`, `${i * 45}`, `${i}`]
            )
          ),
          makeReport(
            "Harvest Plan Tracking",
            "Progress tracking for fields included in the harvest plan.",
            [],
            buildResults(
              ["Plan No.", "Field ID", "Planned Date", "Actual Date", "Progress"],
              6,
              (i) => [`HPT-${6000 + i}`, `FLD-${15000 + i}`, `2025-0${(i % 9) + 1}-1${i}`, `2025-0${(i % 9) + 1}-2${i}`, ["Not Started", "In Progress", "Complete"][i % 3]]
            )
          ),
          makeReport(
            "CCS Tracking",
            "Tracks commercial cane sugar performance across harvested fields.",
            [],
            buildResults(
              ["Tracking No.", "Field ID", "Cane Delivered (Tons)", "CCS %", "Status"],
              6,
              (i) => [`CCT-${7000 + i}`, `FLD-${16000 + i}`, `${i * 52}`, `${(10.2 + i * 0.3).toFixed(1)}`, ["Pending", "Verified", "Reconciled"][i % 3]]
            )
          ),
        ],
      },
      {
        id: "management-report-1",
        name: "Management Report 1",
        reports: [
          makeReport(
            "Variety-Wise Plantation Report",
            "Cane plantation performance summarized by cane variety.",
            [],
            buildResults(
              ["Variety", "Fields Planted", "Area Planted (ha)", "Planting Month"],
              6,
              (i) => [["KEN 82-247", "CO 421", "N14"][i % 3], `${i * 7}`, `${(i * 11.5).toFixed(1)}`, `2025-${String(i).padStart(2, "0")}`]
            )
          ),
          makeReport(
            "Month-Wise Cane Acreage Position",
            "Monthly position of cane acreage by production zone.",
            [],
            buildResults(
              ["Month", "Zone", "Planted Area (ha)", "Harvested Area (ha)"],
              6,
              (i) => [`2025-${String(i).padStart(2, "0")}`, ["Zone A", "Zone B", "Zone C"][i % 3], `${(i * 21.4).toFixed(1)}`, `${(i * 8.6).toFixed(1)}`]
            )
          ),
          makeReport(
            "Cane Acreage with Tonnage",
            "Cane acreage and estimated tonnage by field and production zone.",
            [],
            buildResults(
              ["Field ID", "Zone", "Area (ha)", "Estimated Tonnage (Tons)"],
              6,
              (i) => [`FLD-${17000 + i}`, ["Zone A", "Zone B", "Zone C"][i % 3], `${(i * 3.4).toFixed(1)}`, `${i * 58}`]
            )
          ),
          makeReport(
            "Yield Assessment (Established vs Actual)",
            "Compares established yield expectations against actual field yields.",
            [],
            buildResults(
              ["Field ID", "Established Yield (Tons)", "Actual Yield (Tons)", "Variance (Tons)"],
              6,
              (i) => [`FLD-${18000 + i}`, `${i * 55}`, `${i * 49}`, `${i * -6}`]
            )
          ),
          makeReport(
            "Variety and Crop Type-Wise Yield",
            "Yield comparison by cane variety and crop type.",
            [],
            buildResults(
              ["Variety", "Crop Type", "Area (ha)", "Yield (Tons)"],
              6,
              (i) => [["KEN 82-247", "CO 421", "N14"][i % 3], ["Plant", "Ratoon"][i % 2], `${(i * 9.3).toFixed(1)}`, `${i * 140}`]
            )
          ),
          makeReport(
            "Month-Wise Yield",
            "Monthly yield performance across harvested cane fields.",
            [],
            buildResults(
              ["Month", "Area Harvested (ha)", "Yield (Tons)", "Yield per Hectare"],
              6,
              (i) => [`2025-${String(i).padStart(2, "0")}`, `${(i * 14.2).toFixed(1)}`, `${i * 160}`, `${(i * 11.3).toFixed(1)}`]
            )
          ),
          makeReport(
            "Revenue Area-Wise Cane Supply",
            "Revenue and cane supply summarized by production area.",
            [],
            buildResults(
              ["Area", "Cane Supplied (Tons)", "Revenue (KES)", "Average Price (KES/Ton)"],
              6,
              (i) => [["Zone A", "Zone B", "Zone C"][i % 3], `${i * 175}`, `${(i * 875000).toLocaleString()}`, `${5000 + i * 100}`]
            )
          ),
          makeReport(
            "Transport-Wise Cane Area and Supply",
            "Cane area served and tonnage supplied by transport provider.",
            [],
            buildResults(
              ["Transport Provider", "Area Served (ha)", "Cane Supplied (Tons)", "Trips"],
              6,
              (i) => [`Transporter ${i}`, `${(i * 16.5).toFixed(1)}`, `${i * 220}`, `${i * 14}`]
            )
          ),
          makeReport(
            "Month-Wise Investment Field Yield Report",
            "Monthly comparison of field investment and resulting cane yield.",
            [],
            buildResults(
              ["Month", "Investment (KES)", "Area Supported (ha)", "Yield (Tons)"],
              6,
              (i) => [`2025-${String(i).padStart(2, "0")}`, `${(i * 125000).toLocaleString()}`, `${(i * 18.2).toFixed(1)}`, `${i * 190}`]
            )
          ),
          makeReport(
            "Year-Wise Activity-Wise Investment Issue and Recovery Report",
            "Annual summary of investment issued and recovered by field activity.",
            [],
            buildResults(
              ["Year", "Activity", "Investment Issued (KES)", "Investment Recovered (KES)", "Balance (KES)"],
              6,
              (i) => [`${2020 + i}`, ["Land Preparation", "Planting", "Fertilizer"][i % 3], `${(i * 450000).toLocaleString()}`, `${(i * 380000).toLocaleString()}`, `${(i * 70000).toLocaleString()}`]
            )
          ),
        ],
      },
      {
        id: "lead-to-service",
        name: "Lead to Service",
        reports: [
          makeReport(
            "Lead Report",
            "Summary of farmer land lease agreements currently active with the company.",
            [extraFilters.status],
            buildResults(
              ["Lease No.", "Farmer Name", "Zone", "Acreage", "Status"],
              6,
              (i) => [`LSE-${1000 + i}`, `Farmer ${i}`, ["Zone A", "Zone B", "Zone C"][i % 3], `${(i * 2.4).toFixed(1)} ha`, ["Active", "Pending", "Active"][i % 3]]
            )
          ),
          makeReport(
            "Business Partner Conversion",
            "Tracks conversion of prospective leads into registered business partners (outgrowers).",
            [],
            buildResults(
              ["Lead ID", "Name", "Stage", "Zone", "Conversion Date"],
              6,
              (i) => [`LD-${200 + i}`, `Prospect ${i}`, ["New", "Qualified", "Converted"][i % 3], ["Zone A", "Zone B"][i % 2], `2025-0${(i % 9) + 1}-1${i}`]
            )
          ),
          makeReport(
            "Field Scouting",
            "Field scouting visit records for pest, disease and crop condition monitoring.",
            [],
            buildResults(
              ["Field ID", "Scout Officer", "Zone", "Condition", "Visit Date"],
              6,
              (i) => [`FLD-${300 + i}`, `Officer ${i}`, ["Zone A", "Zone B", "Zone C"][i % 3], ["Good", "Fair", "Needs Attention"][i % 3], `2025-0${(i % 9) + 1}-0${i}`]
            )
          ),
          makeReport(
            "E-Contracting",
            "Digital cane supply contracts signed with outgrowers and nucleus farmers.",
            [extraFilters.status],
            buildResults(
              ["Contract No.", "Farmer Name", "Tonnage (Est.)", "Status", "Signed Date"],
              6,
              (i) => [`ECT-${400 + i}`, `Farmer ${i}`, `${i * 12} MT`, ["Signed", "Draft", "Signed"][i % 3], `2025-0${(i % 9) + 1}-2${i % 8}`]
            )
          ),
        ],
      },
      {
        id: "activity-completion",
        name: "Activity Completion",
        reports: [
          makeReport(
            "Land Preparation Report",
            "Progress of land clearing, ploughing and harrowing activities per field.",
            [],
            buildResults(
              ["Field ID", "Activity", "% Complete", "Zone", "Last Updated"],
              5,
              (i) => [`FLD-${500 + i}`, ["Ploughing", "Harrowing", "Ridging"][i % 3], `${(i * 17) % 100}%`, ["Zone A", "Zone B"][i % 2], `2025-0${(i % 9) + 1}-1${i}`]
            )
          ),
          makeReport(
            "Planting Activity Report",
            "Tracks cane planting progress against seasonal planting targets.",
            [],
            buildResults(
              ["Field ID", "Variety", "Area Planted", "Target", "Zone"],
              5,
              (i) => [`FLD-${600 + i}`, ["KEN 82-247", "CO 421", "N14"][i % 3], `${i * 3} ha`, `${i * 4} ha`, ["Zone A", "Zone C"][i % 2]]
            )
          ),
          makeReport(
            "Fertilizer Application Report",
            "Fertilizer application schedules and completion status by field.",
            [extraFilters.status],
            buildResults(
              ["Field ID", "Fertilizer Type", "Qty Applied (kg)", "Status", "Zone"],
              5,
              (i) => [`FLD-${700 + i}`, ["DAP", "CAN", "NPK"][i % 3], `${i * 150}`, ["Completed", "In Progress"][i % 2], ["Zone A", "Zone B"][i % 2]]
            )
          ),
          makeReport(
            "Harvest Readiness Report",
            "Identifies fields approaching harvest maturity for scheduling purposes.",
            [],
            buildResults(
              ["Field ID", "Age (Months)", "Estimated Yield", "Zone", "Ready Date"],
              5,
              (i) => [`FLD-${800 + i}`, `${12 + i}`, `${i * 8} MT/ha`, ["Zone B", "Zone C"][i % 2], `2025-1${i % 2}-0${i}`]
            )
          ),
        ],
      },
    ],
  },
  {
    id: "transport",
    name: "Transport",
    description: "Cane haulage, fleet, logistics and dispatch reports.",
    subcategories: [
      {
        id: "cane-haulage",
        name: "Cane Haulage",
        reports: [
          makeReport(
            "Daily Haulage Report",
            "Daily summary of cane tonnage hauled from field to factory.",
            [],
            buildResults(
              ["Trip No.", "Truck No.", "Tonnage", "Origin Zone", "Date"],
              6,
              (i) => [`TRP-${100 + i}`, `KDA ${100 + i}Z`, `${i * 9} MT`, ["Zone A", "Zone B"][i % 2], `2025-06-0${i}`]
            )
          ),
          makeReport(
            "Truck Utilization Report",
            "Utilization rates of the haulage fleet against available capacity.",
            [],
            buildResults(
              ["Truck No.", "Trips", "Capacity Used", "Idle Hours"],
              6,
              (i) => [`KDA ${100 + i}Z`, `${i * 2}`, `${(i * 13) % 100}%`, `${i}h`]
            )
          ),
          makeReport(
            "Route Efficiency Report",
            "Compares planned versus actual route times for haulage trips.",
            [],
            buildResults(
              ["Route", "Planned Time", "Actual Time", "Variance"],
              5,
              (i) => [`Route ${i}`, `${i + 1}h 00m`, `${i + 1}h ${i * 5}m`, `+${i * 5}m`]
            )
          ),
        ],
      },
      {
        id: "fleet-management",
        name: "Fleet Management",
        reports: [
          makeReport(
            "Vehicle Maintenance Report",
            "Scheduled and completed maintenance records for transport vehicles.",
            [extraFilters.status],
            buildResults(
              ["Vehicle No.", "Maintenance Type", "Status", "Last Service"],
              5,
              (i) => [`KDA ${200 + i}Z`, ["Service", "Tyre Change", "Inspection"][i % 3], ["Completed", "Scheduled"][i % 2], `2025-0${i}-1${i}`]
            )
          ),
          makeReport(
            "Fuel Consumption Report",
            "Fuel usage per vehicle against distance covered.",
            [],
            buildResults(
              ["Vehicle No.", "Distance (km)", "Fuel Used (L)", "L/100km"],
              5,
              (i) => [`KDA ${200 + i}Z`, `${i * 120}`, `${i * 38}`, `${(31 + i).toFixed(1)}`]
            )
          ),
          makeReport(
            "Driver Performance Report",
            "Driver trip counts, punctuality and safety incident summary.",
            [],
            buildResults(
              ["Driver", "Trips", "On-Time %", "Incidents"],
              5,
              (i) => [`Driver ${i}`, `${i * 4}`, `${90 + i}%`, `${i % 2}`]
            )
          ),
        ],
      },
      {
        id: "logistics-dispatch",
        name: "Logistics & Dispatch",
        reports: [
          makeReport(
            "Daily Dispatch Report",
            "Products dispatched to customers and distributors per day.",
            [],
            buildResults(
              ["Dispatch No.", "Customer", "Product", "Qty (MT)"],
              5,
              (i) => [`DSP-${600 + i}`, `Customer ${i}`, ["Sugar 50kg", "Molasses"][i % 2], `${i * 6}`]
            )
          ),
          makeReport(
            "Dispatch Delay Report",
            "Flags dispatch orders that exceeded the standard turnaround time.",
            [],
            buildResults(
              ["Dispatch No.", "Customer", "Delay (Hrs)", "Reason"],
              5,
              (i) => [`DSP-${700 + i}`, `Customer ${i}`, `${i * 2}h`, ["Truck Availability", "Documentation"][i % 2]]
            )
          ),
          makeReport(
            "Stock Movement Report",
            "Inbound and outbound stock movement across warehouses.",
            [],
            buildResults(
              ["Warehouse", "Product", "Inbound (MT)", "Outbound (MT)"],
              5,
              (i) => [`WH-${i}`, ["Sugar", "Molasses", "Bagasse"][i % 3], `${i * 12}`, `${i * 9}`]
            )
          ),
          makeReport(
            "Warehouse Utilization Report",
            "Storage capacity utilization by warehouse location.",
            [],
            buildResults(
              ["Warehouse", "Capacity (MT)", "Used (MT)", "Utilization %"],
              5,
              (i) => [`WH-${i}`, `${i * 500}`, `${i * 340}`, `${(i * 68) % 100}%`]
            )
          ),
        ],
      },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    description: "Payables, receivables, ledger, commercial control and procurement reports.",
    subcategories: [
      {
        id: "accounts-payable",
        name: "Accounts Payable",
        reports: [
          makeReport(
            "Vendor Payment Report",
            "Summary of payments made to vendors within a selected period.",
            [extraFilters.status],
            buildResults(
              ["Voucher No.", "Vendor", "Amount (KES)", "Status"],
              6,
              (i) => [`VCH-${900 + i}`, `Vendor ${i}`, `${(i * 45210).toLocaleString()}`, ["Paid", "Pending"][i % 2]]
            )
          ),
          makeReport(
            "Outstanding Invoices Report",
            "Lists supplier invoices that remain unpaid, grouped by ageing bracket.",
            [],
            buildResults(
              ["Invoice No.", "Vendor", "Amount (KES)", "Days Outstanding"],
              5,
              (i) => [`INV-${300 + i}`, `Vendor ${i}`, `${(i * 22150).toLocaleString()}`, `${i * 15}`]
            )
          ),
        ],
      },
      {
        id: "accounts-receivable",
        name: "Accounts Receivable",
        reports: [
          makeReport(
            "Customer Statement Report",
            "Account statement showing invoices, receipts and running balance per customer.",
            [],
            buildResults(
              ["Customer", "Invoice No.", "Amount (KES)", "Balance"],
              5,
              (i) => [`Customer ${i}`, `INV-${400 + i}`, `${(i * 31500).toLocaleString()}`, `${(i * 5200).toLocaleString()}`]
            )
          ),
          makeReport(
            "Aging Report",
            "Receivables grouped into 30/60/90-day ageing buckets.",
            [],
            buildResults(
              ["Customer", "0-30 Days", "31-60 Days", "61-90 Days", "90+ Days"],
              5,
              (i) => [`Customer ${i}`, `${i * 1200}`, `${i * 800}`, `${i * 300}`, `${i * 100}`]
            )
          ),
        ],
      },
      {
        id: "general-ledger",
        name: "General Ledger",
        reports: [
          makeReport(
            "Trial Balance Report",
            "Debit and credit balances across all general ledger accounts.",
            [],
            buildResults(
              ["Account Code", "Account Name", "Debit (KES)", "Credit (KES)"],
              5,
              (i) => [`GL-${1000 + i}`, `Account ${i}`, `${(i * 15000).toLocaleString()}`, `${(i * 9000).toLocaleString()}`]
            )
          ),
          makeReport(
            "Journal Entry Report",
            "List of journal entries posted within a selected period.",
            [],
            buildResults(
              ["JE No.", "Description", "Amount (KES)", "Posted By"],
              5,
              (i) => [`JE-${500 + i}`, `Adjustment ${i}`, `${(i * 7400).toLocaleString()}`, `User ${i}`]
            )
          ),
        ],
      },
      {
        id: "commercial-control",
        name: "Commercial Control",
        reports: [
          makeReport(
            "Sales Summary Report",
            "High-level sales volumes and revenue summary across products.",
            [],
            buildResults(
              ["Product", "Qty Sold (MT)", "Revenue (KES)", "Zone"],
              5,
              (i) => [["Sugar 50kg", "Molasses", "Bagasse"][i % 3], `${i * 40}`, `${(i * 520000).toLocaleString()}`, ["Zone A", "Zone B"][i % 2]]
            )
          ),
          makeReport(
            "Customer Sales Report",
            "Sales performance broken down by individual customer accounts.",
            [],
            buildResults(
              ["Customer", "Orders", "Total Value (KES)"],
              5,
              (i) => [`Customer ${i}`, `${i * 3}`, `${(i * 61000).toLocaleString()}`]
            )
          ),
          makeReport(
            "Price List Report",
            "Current approved price list for finished products.",
            [extraFilters.status],
            buildResults(
              ["Product", "Unit Price (KES)", "Effective Date", "Status"],
              5,
              (i) => [["Sugar 50kg", "Sugar 25kg", "Molasses"][i % 3], `${5200 + i * 100}`, `2025-0${i}-01`, "Active"]
            )
          ),
          makeReport(
            "Discount Analysis Report",
            "Discounts issued to customers and their impact on net revenue.",
            [],
            buildResults(
              ["Customer", "Discount %", "Amount Discounted (KES)"],
              5,
              (i) => [`Customer ${i}`, `${i * 2}%`, `${(i * 8300).toLocaleString()}`]
            )
          ),
        ],
      },
      {
        id: "procurement",
        name: "Procurement",
        reports: [
          makeReport(
            "Open Purchase Orders Report",
            "Purchase orders that have been raised but not yet fully delivered.",
            [extraFilters.status],
            buildResults(
              ["PO No.", "Supplier", "Amount (KES)", "Status"],
              5,
              (i) => [`PO-${800 + i}`, `Supplier ${i}`, `${(i * 76000).toLocaleString()}`, ["Open", "Partially Received"][i % 2]]
            )
          ),
          makeReport(
            "PO Approval Status Report",
            "Tracks purchase orders through the internal approval workflow.",
            [],
            buildResults(
              ["PO No.", "Requested By", "Approval Stage", "Status"],
              5,
              (i) => [`PO-${900 + i}`, `User ${i}`, ["Level 1", "Level 2", "Final"][i % 3], ["Pending", "Approved"][i % 2]]
            )
          ),
          makeReport(
            "Supplier Performance Report",
            "Delivery timeliness and quality rating per supplier.",
            [],
            buildResults(
              ["Supplier", "On-Time Delivery %", "Quality Rating"],
              5,
              (i) => [`Supplier ${i}`, `${85 + i}%`, `${(3 + (i % 2)).toFixed(1)} / 5`]
            )
          ),
          makeReport(
            "Supplier Contract Report",
            "Active and expiring supplier contract agreements.",
            [extraFilters.status],
            buildResults(
              ["Contract No.", "Supplier", "Expiry Date", "Status"],
              5,
              (i) => [`SC-${100 + i}`, `Supplier ${i}`, `2025-1${i % 2}-0${i}`, ["Active", "Expiring Soon"][i % 2]]
            )
          ),
        ],
      },
    ],
  },
  {
    id: "factory",
    name: "Factory",
    description: "Sugar production and quality control reports.",
    subcategories: [
      {
        id: "production",
        name: "Production",
        reports: [
          makeReport(
            "Daily Production Report",
            "Daily sugar output, cane crushed and production efficiency.",
            [],
            buildResults(
              ["Date", "Cane Crushed (MT)", "Sugar Produced (MT)", "Efficiency %"],
              5,
              (i) => [`2025-06-0${i}`, `${i * 320}`, `${i * 34}`, `${(i * 9 + 50) % 100}%`]
            )
          ),
          makeReport(
            "Sugar Recovery Report",
            "Recovery rate of sugar extracted per tonne of cane crushed.",
            [],
            buildResults(
              ["Date", "Cane Crushed (MT)", "Recovery Rate %"],
              5,
              (i) => [`2025-06-0${i}`, `${i * 300}`, `${(9 + i * 0.2).toFixed(2)}%`]
            )
          ),
          makeReport(
            "Milling Efficiency Report",
            "Performance metrics for each milling train in the factory.",
            [],
            buildResults(
              ["Mill No.", "Throughput (MT/hr)", "Downtime (Hrs)", "Efficiency %"],
              5,
              (i) => [`Mill ${i}`, `${i * 45}`, `${i}h`, `${(i * 7 + 60) % 100}%`]
            )
          ),
        ],
      },
      {
        id: "quality-control",
        name: "Quality Control",
        reports: [
          makeReport(
            "Quality Inspection Report",
            "Product quality inspection results against set standards.",
            [extraFilters.status],
            buildResults(
              ["Batch No.", "Product", "Result", "Status"],
              5,
              (i) => [`BATCH-${i}`, "Sugar 50kg", ["Pass", "Pass", "Review"][i % 3], ["Approved", "Pending"][i % 2]]
            )
          ),
          makeReport(
            "Sucrose Content Report",
            "Laboratory readings of sucrose content per production batch.",
            [],
            buildResults(
              ["Batch No.", "Sucrose %", "Purity %", "Sampled At"],
              5,
              (i) => [`BATCH-${i}`, `${(98 + i * 0.1).toFixed(1)}%`, `${(99 + i * 0.05).toFixed(2)}%`, `2025-06-0${i}`]
            )
          ),
        ],
      },
    ],
  },
  {
    id: "hr",
    name: "Human Resource",
    description: "Payroll and workforce management reports.",
    subcategories: [
      {
        id: "payroll",
        name: "Payroll",
        reports: [
          makeReport(
            "Monthly Payroll Report",
            "Consolidated payroll costs across departments for the selected month.",
            [extraFilters.department],
            buildResults(
              ["Employee No.", "Department", "Gross Pay (KES)", "Net Pay (KES)"],
              5,
              (i) => [`EMP-${2000 + i}`, ["Nucleus Estate", "Head Office", "Outgrowers"][i % 3], `${(i * 42000).toLocaleString()}`, `${(i * 35000).toLocaleString()}`]
            )
          ),
          makeReport(
            "Overtime Report",
            "Overtime hours worked and cost incurred by department.",
            [extraFilters.department],
            buildResults(
              ["Employee No.", "Department", "OT Hours", "OT Cost (KES)"],
              5,
              (i) => [`EMP-${2100 + i}`, ["Nucleus Estate", "Head Office"][i % 2], `${i * 4}`, `${(i * 1800).toLocaleString()}`]
            )
          ),
        ],
      },
      {
        id: "workforce",
        name: "Workforce",
        reports: [
          makeReport(
            "Staff Attendance Report",
            "Daily attendance and absenteeism summary by department.",
            [extraFilters.department],
            buildResults(
              ["Employee No.", "Department", "Days Present", "Days Absent"],
              5,
              (i) => [`EMP-${2200 + i}`, ["Nucleus Estate", "Outgrowers"][i % 2], `${20 - i}`, `${i}`]
            )
          ),
          makeReport(
            "Leave Balance Report",
            "Remaining annual leave balances per employee.",
            [extraFilters.department],
            buildResults(
              ["Employee No.", "Department", "Leave Days Used", "Leave Days Remaining"],
              5,
              (i) => [`EMP-${2300 + i}`, ["Head Office", "Nucleus Estate"][i % 2], `${i * 2}`, `${21 - i * 2}`]
            )
          ),
        ],
      },
    ],
  },
];

// Flat helper used by the Overview page for "recently used" style widgets.
export const recentlyUsedReports = [
  { name: "Daily Production Report", category: "Factory", lastRun: "Today, 08:12 AM" },
  { name: "Daily Haulage Report", category: "Transport", lastRun: "Today, 07:40 AM" },
  { name: "Vendor Payment Report", category: "Finance", lastRun: "Yesterday, 04:55 PM" },
  { name: "Sales Summary Report", category: "Finance", lastRun: "Yesterday, 02:10 PM" },
  { name: "Staff Attendance Report", category: "HR", lastRun: "2 days ago" },
];

export function getTotalReportCount() {
  return reportCategories.reduce((total, category) => {
    const subReportCount = category.subcategories.reduce(
      (sum, sub) => sum + sub.reports.length,
      0
    );
    return total + subReportCount;
  }, 0);
}

export function getTotalSubcategoryCount() {
  return reportCategories.reduce((total, category) => total + category.subcategories.length, 0);
}

