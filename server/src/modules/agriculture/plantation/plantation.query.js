import { executeWarehouseQuery } from "../../../db/warehouseDb/connection.js";

const SECTOR_SQL = `CASE
  WHEN vw.Region_Name = 'KABRAS CENTRAL' THEN
    CASE WHEN vw.Zone_Name IN ('CENTRAL ZONE-B','EASTERN ZONE') THEN 'KABRAS B' ELSE 'KABRAS A' END
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

function hasValue(value) {
  return value !== undefined && value !== null && value !== "" && value !== "all";
}

function sourcePredicates(parameters) {
  const conditions = [
    "dccs.WeigmentRpt_Dt >= COALESCE(@dateFrom, CONVERT(date, '20260101'))",
    "dccs.WeigmentRpt_Dt < COALESCE(DATEADD(DAY, 1, @dateTo), DATEADD(DAY, 1, CONVERT(date, GETDATE())))",
    "mm.Material_Group_ID = 2",
    "dim.CostType = 'MAT'",
  ];

  if (hasValue(parameters.unit)) conditions.push("vw.PlantName2 = @unit");
  if (hasValue(parameters.sector)) conditions.push(`(${SECTOR_SQL}) = @sector`);
  if (hasValue(parameters.zone)) conditions.push("vw.Zone_Name = @zone");
  if (hasValue(parameters.section)) conditions.push("vw.Section_Name = @section");

  if (hasValue(parameters.identifierSearch)) {
    conditions.push(`(
      REPLACE(UPPER(LTRIM(RTRIM(CONVERT(VARCHAR(100), RBP.ID_Number)))), 'FN-', '') = @identifierSearch
      OR REPLACE(UPPER(LTRIM(RTRIM(CONVERT(VARCHAR(100), dim.field_no)))), 'FN-', '') = @identifierSearch
    )`);
  }

  return conditions.join("\n      AND ");
}

function baseCcsSql(parameters, { includeFarmer } = {}) {
  const needsFarmerJoin = includeFarmer || hasValue(parameters.identifierSearch);
  const farmerSelect = includeFarmer
    ? `
      RBP.First_Name AS Rec_Farmer_Name,
      RBP.ID_Number AS Rec_Farmer_Id,`
    : "";
  const farmerJoin = needsFarmerJoin
    ? `
    INNER JOIN MD_BUS_PARTNER_MASTER RBP
      ON RBP.Bus_Partner_ID = BPLA.Bus_Partner_ID`
    : "";

  return `
    SELECT
      dim.field_no AS Rec_Field_No,
      dim.Delivered_Qty,
      dccs.WeigmentRpt_Dt,
      CAST(dccs.WeigmentRpt_Dt AS DATE) AS Delivery_Date,${farmerSelect}
      VW.PlantName2 AS Unit_name,
      ${SECTOR_SQL} AS Sector_Name,
      VW.Region_Name,
      VW.Zone_Name,
      VW.Section_Name,
      VW.SubLocation,
      VW.Village_Name,
      BPLA.Measured_Cane_Area
    FROM DT_CCSDATA dccs
    JOIN dt_investment_material dim
      ON dim.ccsno = dccs.scss_slip_no
    JOIN MD_MATERIAL_MASTER mm
      ON mm.Material_Master_ID = dccs.material_master_id
    INNER JOIN DT_BUS_PARTNER_LAND_ATTRIBUTES BPLA
      ON REPLACE(dim.field_no, 'fn-', '') = BPLA.LeadOpportunity_ID
    JOIN DT_BUS_PARTNER_LOCATION_ATTRIBUTES BPLOA
      ON BPLOA.Land_Attributes_ID = BPLA.Land_Attributes_ID${farmerJoin}
    INNER JOIN MD_Village_Related_Data VW
      ON VW.VILLAGE_ID = BPLOA.VILLAGE_ID
    WHERE ${sourcePredicates(parameters)}`;
}

function detailedSql(parameters) {
  return `
    WITH ccs_base AS (
      ${baseCcsSql(parameters, { includeFarmer: true })}
    ),
    ccs_field AS (
      SELECT
        Rec_Field_No,
        Delivery_Date,
        Rec_Farmer_Id,
        Rec_Farmer_Name,
        Region_Name,
        Sector_Name,
        Zone_Name,
        Section_Name,
        SubLocation,
        Village_Name,
        Unit_name,
        Measured_Cane_Area,
        SUM(Delivered_Qty) AS Total_Delivered_Qty
      FROM ccs_base
      GROUP BY
        Rec_Field_No,
        Delivery_Date,
        Rec_Farmer_Id,
        Rec_Farmer_Name,
        Region_Name,
        Sector_Name,
        Zone_Name,
        Section_Name,
        SubLocation,
        Village_Name,
        Unit_name,
        Measured_Cane_Area
    ),
    field_master AS (
      SELECT
        'FN-' + CAST(v.LeadOpportunity_ID AS VARCHAR(50)) AS Lead_Number,
        v.Contract_Number,
        v.Current_Crop_Cycle,
        v.Cordinates,
        CAST(v.Actual_Date_Of_Plant_Ratoon AS DATE) AS Actual_Date_Of_Plant_Ratoon
      FROM dbo.VW_BP_LOC_ATTR_NEW v
    )
    SELECT
      cf.Rec_Field_No,
      cf.Rec_Farmer_Id,
      cf.Rec_Farmer_Name,
      cf.Unit_name,
      cf.Sector_Name,
      cf.Region_Name,
      cf.Zone_Name,
      cf.Section_Name,
      cf.SubLocation,
      cf.Village_Name,
      fm.Contract_Number,
      fm.Current_Crop_Cycle,
      fm.Cordinates,
      fm.Actual_Date_Of_Plant_Ratoon,
      DATEDIFF(MONTH, fm.Actual_Date_Of_Plant_Ratoon, GETDATE()) AS Age,
      cf.Delivery_Date,
      cf.Measured_Cane_Area,
      cf.Total_Delivered_Qty
    FROM ccs_field cf
    LEFT JOIN field_master fm
      ON fm.Lead_Number = cf.Rec_Field_No
    ORDER BY cf.Delivery_Date, cf.Rec_Field_No`;
}

function summarySql(parameters) {
  return `
    WITH base AS (
      ${baseCcsSql(parameters)}
    ),
    by_field_month AS (
      SELECT
        Rec_Field_No,
        DATEFROMPARTS(YEAR(WeigmentRpt_Dt), MONTH(WeigmentRpt_Dt), 1) AS Month_Sort,
        Region_Name,
        Sector_Name,
        Zone_Name,
        Section_Name,
        SubLocation,
        Unit_name,
        MAX(TRY_CAST(Measured_Cane_Area AS DECIMAL(18,3))) AS Measured_Cane_Area
      FROM base
      GROUP BY
        Rec_Field_No,
        DATEFROMPARTS(YEAR(WeigmentRpt_Dt), MONTH(WeigmentRpt_Dt), 1),
        Region_Name,
        Sector_Name,
        Zone_Name,
        Section_Name,
        SubLocation,
        Unit_name
    ),
    first_delivery AS (
      SELECT
        Rec_Field_No,
        MIN(Month_Sort) AS First_Month
      FROM by_field_month
      GROUP BY Rec_Field_No
    )
    SELECT
      LEFT(DATENAME(MONTH, b.Month_Sort), 3) + ' ' + CONVERT(VARCHAR(4), YEAR(b.Month_Sort)) AS Delivery_Month,
      b.Unit_name,
      b.Sector_Name,
      b.Region_Name,
      b.Zone_Name,
      b.Section_Name,
      b.SubLocation,
      COUNT(*) AS No_of_Fields,
      SUM(b.Measured_Cane_Area) AS Total_Acreage
    FROM by_field_month b
    INNER JOIN first_delivery f
      ON f.Rec_Field_No = b.Rec_Field_No
      AND f.First_Month = b.Month_Sort
    GROUP BY
      b.Month_Sort,
      b.Unit_name,
      b.Sector_Name,
      b.Region_Name,
      b.Zone_Name,
      b.Section_Name,
      b.SubLocation
    ORDER BY
      b.Month_Sort,
      b.Unit_name,
      b.Sector_Name,
      b.Region_Name,
      b.Zone_Name,
      b.Section_Name,
      b.SubLocation`;
}

export async function runPlantationQuery({ variant, parameters }) {
  const boundParameters = { dateFrom: null, dateTo: null, ...parameters };
  const text = variant === "detailed"
    ? detailedSql(boundParameters)
    : summarySql(boundParameters);
  return executeWarehouseQuery(text, boundParameters);
}

export async function loadPlantationFilters() {
  return executeWarehouseQuery(
    `SELECT DISTINCT
       PlantName2 AS unit,
       ${SECTOR_SQL} AS sector,
       Zone_Name AS zone,
       Section_Name AS section
     FROM vW_Village_Related_Data vw
     ORDER BY unit, sector, zone, section`,
  );
}