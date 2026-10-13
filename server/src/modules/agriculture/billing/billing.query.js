import { executeWarehouseQuery } from "../../../db/warehouseDb/connection.js";

const GROUP_COLUMNS = {
  unit: ["Sup_Unit_name"],
  sector: ["Sup_Unit_name", "Sup_Sector_Name"],
  zone: ["Sup_Unit_name", "Sup_Sector_Name", "Sup_Zone_Name"],
  section: ["Sup_Unit_name", "Sup_Sector_Name", "Sup_Zone_Name", "Sup_Section_Name"],
};

const REPORT_RULES = {
  "billing-total-supply": "total",
  "billing-general-summary": "general-summary",
  "billing-fully-billed": "Fully billed",
  "billing-partially-billed": "Partially billed",
  "billing-overbilled": "Over billed",
  "billing-not-billed": "Not billed",
};

const SUPPLY_SECTOR = `CASE
  WHEN vw.Region_Name = 'KABRAS CENTRAL' THEN CASE WHEN vw.Zone_Name IN ('CENTRAL ZONE-B','EASTERN ZONE') THEN 'KABRAS B' ELSE 'KABRAS A' END
  WHEN vw.Region_Name IN ('MISIKHU','NAITIRI','KITALE','BUSIA','NZOIA','MAGUT','BUTERE') THEN vw.Region_Name
  WHEN vw.Region_Name IN ('MOI UNIVERSITY','TURBO') THEN 'SELIA'
  WHEN vw.Region_Name IN ('DOROFU','DOROFU KHALABA') THEN 'KHALABA'
  WHEN vw.Region_Name IN ('KABRAS WEST','KABRAS NORTH') THEN 'KABRAS A'
  WHEN vw.Region_Name IN ('KAKAMEGA','BUKURA','KABRAS SOUTH','KAIMOSI','KABRAS') THEN 'KABRAS B'
  WHEN vw.Region_Name = 'SIAYA' THEN 'LAKE AGRO'
  WHEN vw.Region_Name IN ('MIWANI','KERICHO','CHEMELIL') THEN 'NYANDO'
  WHEN vw.Region_Name IN ('Eastern','Northern','Southern','Western') THEN vw.Region_Name
  WHEN vw.Region_Name = 'Central' THEN 'Nzoia Nucleus'
  ELSE 'NOT MAPPED'
END`;

const RECEIVING_SECTOR = SUPPLY_SECTOR.replaceAll("vw.", "VW.");

function predicates(clauses, joiner = "WHERE") {
  return clauses.length ? `${joiner} ${clauses.join(" AND ")}` : "";
}

function billingSql() {
  return `WITH base AS (
    SELECT DISTINCT
      DCD.SCSS_SLIP_NO AS CCS_Slip,
      DCD.NUMBER AS Weigh_No,
      TRY_CONVERT(DATE, DCD.GROSS_DT1) AS GROSS_DT1,
      DCD.PL_Number AS Sup_Field_No,
      MBP.First_Name AS Sup_Farmer_Name,
      MBP.ID_Number AS Sup_Farmer_Id,
      TRY_CONVERT(DECIMAL(18,4), BPLA.Measured_Cane_Area) AS Sup_Field_Area,
      vw.PlantName2 AS Sup_Unit_name,
      ${SUPPLY_SECTOR} AS Sup_Sector_Name,
      vw.Region_Name AS Sup_Region_Name,
      vw.Zone_Name AS Sup_Zone_Name,
      vw.Section_Name AS Sup_Section_Name,
      vw.SubLocation AS Sup_SubLocation,
      LTRIM(RTRIM(REPLACE(REPLACE(vw.Village_Name, CHAR(13), ''), CHAR(10), ''))) AS Sup_Village_Name,
      CAST(ISNULL(TRY_CONVERT(DECIMAL(18,2), DCD.NET_WT), 0) / 1000 AS DECIMAL(18,3)) AS Net_Wt
    FROM DT_CCSDATA DCD
    JOIN MD_HARVEST_PERMIT MP ON DCD.DT_Harvest_Permit_ID = MP.MD_Harvest_Permit_ID
    JOIN DT_BUS_PARTNER_LOCATION_ATTRIBUTES BPLOA ON BPLOA.LeadOpportunity_ID = REPLACE(DCD.PL_Number, 'fn-', '')
    JOIN DT_BUS_PARTNER_LAND_ATTRIBUTES BPLA ON BPLA.Land_Attributes_Id = BPLOA.Land_Attributes_Id
    JOIN MD_BUS_PARTNER_MASTER MBP ON MBP.Bus_Partner_ID = BPLA.Bus_Partner_ID
    JOIN MD_Village_Related_Data vw ON vw.Village_ID = BPLOA.Village_ID
    JOIN MD_MATERIAL_MASTER MM ON MM.Material_Master_ID = DCD.Material_Master_ID
    WHERE MM.Description LIKE '%SEED%'
      AND DCD.ISACTIVE = 1
      AND MBP.Is_Active = 1
      AND DCD.NUMBER IS NOT NULL
      AND DCD.cancel_flag = 0
      AND DCD.SCSS_SLIP_NO IS NOT NULL
      AND ISNULL(DCD.IS_CRushed, 0) <> 3
  ),
  slip AS (
    SELECT x.*
    FROM (
      SELECT b.*, SUM(b.Net_Wt) OVER (PARTITION BY b.CCS_Slip) AS Net_Weight,
        COUNT(*) OVER (PARTITION BY b.CCS_Slip) AS Weighments,
        MIN(b.GROSS_DT1) OVER (PARTITION BY b.CCS_Slip) AS Slip_Date,
        ROW_NUMBER() OVER (PARTITION BY b.CCS_Slip ORDER BY b.Weigh_No) AS pick
      FROM base b
    ) x
    WHERE x.pick = 1
  ),
  slip_billed AS (
    SELECT dim.CCSNo AS CCS_Slip,
      SUM(ISNULL(TRY_CONVERT(DECIMAL(18,4), dim.Delivered_Qty), 0)) AS Slip_Billed_Qty_Raw
    FROM dt_investment_material dim
    WHERE dim.CostType = 'MAT' AND dim.CCSNo IN (SELECT CCS_Slip FROM slip)
    GROUP BY dim.CCSNo
  ),
  status AS (
    SELECT s.*,
      CAST(ROUND(ISNULL(sb.Slip_Billed_Qty_Raw, 0), 2) AS DECIMAL(18,2)) AS Slip_Billed_Qty,
      CAST(ROUND(s.Net_Weight, 2) AS DECIMAL(18,2)) - CAST(ROUND(ISNULL(sb.Slip_Billed_Qty_Raw, 0), 2) AS DECIMAL(18,2)) AS Billed_Diff,
      CASE
        WHEN ROUND(ISNULL(sb.Slip_Billed_Qty_Raw, 0), 2) <= 0 THEN 'Not billed'
        WHEN ROUND(s.Net_Weight, 2) - ROUND(sb.Slip_Billed_Qty_Raw, 2) < -0.05 THEN 'Over billed'
        WHEN ROUND(s.Net_Weight, 2) - ROUND(sb.Slip_Billed_Qty_Raw, 2) <= 0 THEN 'Fully billed'
        ELSE 'Partially billed'
      END AS Billing_Status
    FROM slip s LEFT JOIN slip_billed sb ON sb.CCS_Slip = s.CCS_Slip
  ),
  billed AS (
    SELECT dim.CCSNo AS CCS_Slip, dim.DN_Number, CAST(dim.DN_Date AS DATE) AS DN_Date,
      dim.field_no AS Rec_Field_No, TRY_CONVERT(DECIMAL(18,4), dim.Delivered_Qty) AS Delivered_Qty,
      dim.Actual_Rate AS SC_Actual_Rate, dim.Actual_cost AS SC_Actual_Cost,
      tz.TZ_Actual_Rate, tz.TZ_Actual_Cost, RBP.First_Name AS Rec_Farmer_Name,
      RBP.ID_Number AS Rec_Farmer_Id, VW.PlantName2 AS Rec_Unit_name,
      ${RECEIVING_SECTOR} AS Rec_Sector_Name, VW.Zone_Name AS Rec_Zone_Name,
      VW.Section_Name AS Rec_Section_Name, VW.SubLocation AS Rec_SubLocation,
      LTRIM(RTRIM(REPLACE(REPLACE(VW.Village_Name, CHAR(13), ''), CHAR(10), ''))) AS Rec_Village_Name,
      TRY_CONVERT(DECIMAL(18,4), BPLA.Measured_Cane_Area) AS Rec_Field_Area
    FROM dt_investment_material dim
    OUTER APPLY (
      SELECT TOP 1 dim2.Actual_Rate AS TZ_Actual_Rate, dim2.Actual_cost AS TZ_Actual_Cost
      FROM dt_investment_material dim2
      WHERE dim2.CostType = 'TZ' AND dim2.CCSNo = dim.CCSNo
      ORDER BY CASE WHEN dim2.DN_Number = dim.DN_Number THEN 0 ELSE 1 END,
        CASE WHEN REPLACE(dim2.field_no, 'fn-', '') = REPLACE(dim.field_no, 'fn-', '') THEN 0 ELSE 1 END,
        dim2.DN_Date, dim2.DN_Number
    ) tz
    LEFT JOIN DT_BUS_PARTNER_LAND_ATTRIBUTES BPLA ON REPLACE(dim.field_no, 'fn-', '') = BPLA.LeadOpportunity_ID
    LEFT JOIN DT_BUS_PARTNER_LOCATION_ATTRIBUTES BPLOA ON BPLOA.Land_Attributes_ID = BPLA.Land_Attributes_ID
    LEFT JOIN MD_BUS_PARTNER_MASTER RBP ON RBP.Bus_Partner_ID = BPLA.Bus_Partner_ID
    LEFT JOIN MD_Village_Related_Data VW ON VW.VILLAGE_ID = BPLOA.VILLAGE_ID
    WHERE dim.CostType = 'MAT' AND dim.CCSNo IN (SELECT CCS_Slip FROM slip)
  ),
  detailed AS (
    SELECT st.CCS_Slip, st.Slip_Date AS GROSS_DT1, st.Billing_Status,
      st.Sup_Field_No, st.Sup_Farmer_Name, st.Sup_Farmer_Id, st.Sup_Field_Area,
      st.Sup_Unit_name, st.Sup_Sector_Name, st.Sup_Zone_Name, st.Sup_Section_Name,
      st.Sup_SubLocation, st.Sup_Village_Name, b.DN_Number, b.DN_Date,
      b.Rec_Field_No, b.Rec_Farmer_Name, b.Rec_Farmer_Id, b.Rec_Field_Area,
      b.Rec_Unit_name, b.Rec_Sector_Name, b.Rec_Zone_Name, b.Rec_Section_Name,
      b.Rec_SubLocation, b.Rec_Village_Name, st.Net_Weight, st.Slip_Billed_Qty,
      b.Delivered_Qty, st.Billed_Diff, b.SC_Actual_Rate, b.SC_Actual_Cost,
      b.TZ_Actual_Rate, b.TZ_Actual_Cost,
      CAST(ISNULL(TRY_CONVERT(DECIMAL(18,2), b.SC_Actual_Cost), 0)
        - ISNULL(b.Delivered_Qty, 0) * ISNULL(TRY_CONVERT(DECIMAL(18,4), b.SC_Actual_Rate), 0) AS DECIMAL(18,2)) AS SC_Cost_Check,
      CAST(ISNULL(TRY_CONVERT(DECIMAL(18,2), b.TZ_Actual_Cost), 0)
        - ISNULL(b.Delivered_Qty, 0) * ISNULL(TRY_CONVERT(DECIMAL(18,4), b.TZ_Actual_Rate), 0) AS DECIMAL(18,2)) AS TZ_Cost_Check,
      DATEDIFF(DAY, st.Slip_Date, GETDATE()) AS Age_Days
    FROM status st LEFT JOIN billed b ON b.CCS_Slip = st.CCS_Slip
  )
  `;
}

function totalDetailed(clauses) {
  return `${billingSql()} SELECT CCS_Slip, GROSS_DT1, Sup_Field_No, Sup_Farmer_Name, Sup_Farmer_Id,
    Sup_Field_Area, Sup_Unit_name, Sup_Sector_Name, Sup_Region_Name, Sup_Zone_Name, Sup_Section_Name,
    Sup_SubLocation, Sup_Village_Name, Weighments, Net_Weight
    FROM status ${predicates(clauses)}
    ORDER BY Sup_Unit_name, Sup_Sector_Name, Sup_Zone_Name, Sup_Section_Name, Sup_SubLocation, Sup_Village_Name, GROSS_DT1, CCS_Slip`;
}

function statusDetailed(status, clauses) {
  const columns = status === "Not billed"
    ? `d.CCS_Slip, d.GROSS_DT1, d.Billing_Status,
      d.Sup_Field_No, d.Sup_Farmer_Name, d.Sup_Farmer_Id, d.Sup_Field_Area,
      d.Sup_Unit_name, d.Sup_Sector_Name, d.Sup_Zone_Name, d.Sup_Section_Name,
      d.Sup_SubLocation, d.Sup_Village_Name, d.Net_Weight, d.Slip_Billed_Qty,
      d.Billed_Diff, d.Age_Days`
    : `d.CCS_Slip, d.GROSS_DT1, d.Billing_Status,
      d.Sup_Field_No, d.Sup_Farmer_Name, d.Sup_Farmer_Id, d.Sup_Field_Area,
      d.Sup_Unit_name, d.Sup_Sector_Name, d.Sup_Zone_Name, d.Sup_Section_Name,
      d.Sup_SubLocation, d.Sup_Village_Name, d.DN_Number, d.DN_Date,
      d.Rec_Field_No, d.Rec_Farmer_Name, d.Rec_Farmer_Id, d.Rec_Field_Area,
      d.Rec_Unit_name, d.Rec_Sector_Name, d.Rec_Zone_Name, d.Rec_Section_Name,
      d.Rec_SubLocation, d.Rec_Village_Name, d.Net_Weight, d.Slip_Billed_Qty,
      d.Delivered_Qty, d.Billed_Diff, d.SC_Actual_Rate, d.SC_Actual_Cost,
      d.TZ_Actual_Rate, d.TZ_Actual_Cost, d.SC_Cost_Check, d.TZ_Cost_Check,
      CASE WHEN ABS(d.SC_Cost_Check) > 30 OR ABS(d.TZ_Cost_Check) > 30 THEN 'CHECK' ELSE 'OK' END AS Cost_Flag`;
  return `${billingSql()} SELECT ${columns}
    FROM detailed d ${predicates([...clauses, "d.Billing_Status = @billingStatus"])}
    ORDER BY d.Sup_Unit_name, d.Sup_Sector_Name, d.Sup_Zone_Name, d.Sup_Section_Name,
      d.Sup_SubLocation, d.Sup_Village_Name, d.GROSS_DT1, d.CCS_Slip, d.DN_Number`;
}

function summary(status, group, clauses) {
  const columns = GROUP_COLUMNS[group];
  const groupSql = columns.map((column) => `[${column}]`).join(", ");
  const billed = status !== "total" && status !== "Not billed";
  const source = status === "total" ? "status" : "detailed";
  const quantity = billed ? "Delivered_Qty" : "Net_Weight";
  const label = billed ? "Total Billed (Tonnes)" : status === "Not billed" ? "Total Not Billed (Tonnes)" : "Total Supplied (Tonnes)";
  const statusClause = status === "total" ? [] : ["Billing_Status = @billingStatus"];
  return `${billingSql()} SELECT ${groupSql}, SUM(${quantity}) AS [${label}], COUNT(DISTINCT CCS_Slip) AS [Total CCS Slips]
    FROM ${source} ${predicates([...clauses, ...statusClause])}
    GROUP BY ${groupSql} ORDER BY ${groupSql}`;
}

function generalSummary(group, clauses) {
  const columns = GROUP_COLUMNS[group];
  const groupSql = columns.map((column) => `[${column}]`).join(", ");
  return `${billingSql()} SELECT ${groupSql},
    SUM(Net_Weight) AS [Total Supply (Tonnes)],
    SUM(CASE WHEN Billing_Status = 'Fully billed' THEN Net_Weight ELSE 0 END) AS [Fully Billed (Tonnes)],
    SUM(CASE WHEN Billing_Status = 'Partially billed' THEN Net_Weight ELSE 0 END) AS [Partially Billed (Tonnes)],
    SUM(CASE WHEN Billing_Status = 'Over billed' THEN Net_Weight ELSE 0 END) AS [Over Billed (Tonnes)],
    SUM(CASE WHEN Billing_Status = 'Not billed' THEN Net_Weight ELSE 0 END) AS [Not Billed (Tonnes)]
    FROM status ${predicates(clauses)}
    GROUP BY ${groupSql} ORDER BY ${groupSql}`;
}

export async function runBillingQuery({ reportId, variant, group, clauses, parameters }) {
  const status = REPORT_RULES[reportId];
  const boundParameters = { dateFrom: null, dateTo: null, ...parameters };
  let sql;
  if (variant === "detailed") {
    if (status === "total") sql = totalDetailed(clauses);
    else {
      boundParameters.billingStatus = status;
      sql = statusDetailed(status, clauses);
    }
  } else {
    if (status === "general-summary") sql = generalSummary(group, clauses);
    else {
    if (status !== "total") boundParameters.billingStatus = status;
    sql = summary(status, group, clauses);
    }
  }
  return executeWarehouseQuery(sql, boundParameters);
}

export async function loadBillingFilters() {
  return executeWarehouseQuery(
    `SELECT DISTINCT PlantName2 AS unit, ${SUPPLY_SECTOR.replaceAll("vw.", "")} AS sector,
      Zone_Name AS zone, Section_Name AS section
     FROM vW_Village_Related_Data vw
     ORDER BY unit, sector, zone, section`,
  );
}