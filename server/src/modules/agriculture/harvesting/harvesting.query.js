import { executeWarehouseQuery } from "../../../db/warehouseDb/connection.js";
import { httpError } from "../../../shared/errors.js";

const GROUP_COLUMNS = {
  unit: ["Unit"],
  sector: ["Unit", "Sector_Name"],
  zone: ["Unit", "Sector_Name", "Zone_Name"],
  section: ["Unit", "Sector_Name", "Zone_Name", "Section_Name"],
};

const SECTOR_SQL = `
  CASE
    WHEN vw.Region_Name = 'KABRAS CENTRAL' THEN
      CASE
        WHEN vw.Zone_Name IN ('CENTRAL ZONE-B', 'EASTERN ZONE') THEN 'KABRAS B'
        ELSE 'KABRAS A'
      END
    WHEN vw.Region_Name IN (
      'MISIKHU',
      'NAITIRI',
      'KITALE',
      'BUSIA',
      'NZOIA',
      'MAGUT',
      'BUTERE'
    ) THEN vw.Region_Name
    WHEN vw.Region_Name IN ('MOI UNIVERSITY', 'TURBO') THEN 'SELIA'
    WHEN vw.Region_Name IN ('DOROFU', 'DOROFU KHALABA') THEN 'KHALABA'
    WHEN vw.Region_Name IN ('KABRAS WEST', 'KABRAS NORTH') THEN 'KABRAS A'
    WHEN vw.Region_Name IN (
      'KAKAMEGA',
      'BUKURA',
      'KABRAS SOUTH',
      'KAIMOSI',
      'KABRAS'
    ) THEN 'KABRAS B'
    WHEN vw.Region_Name = 'SIAYA' THEN 'LAKE AGRO'
    WHEN vw.Region_Name IN ('MIWANI', 'KERICHO', 'CHEMELIL') THEN 'NYANDO'
    WHEN vw.Region_Name IN ('Eastern', 'Northern', 'Southern', 'Western')
      THEN vw.Region_Name
    WHEN vw.Region_Name = 'Central' THEN 'Nzoia Nucleus'
    ELSE 'NOT MAPPED'
  END`;

const CRUSH_DATE_SQL = `
  CAST(
    DATEADD(
      HOUR,
      -6,
      TRY_CONVERT(DATETIME, DCD.GROSS_DT1)
        + ISNULL(
          TRY_CONVERT(
            DATETIME,
            STUFF(
              RIGHT('0000' + CAST(DCD.GROSS_TM1 AS VARCHAR(4)), 4),
              3,
              0,
              ':'
            )
          ),
          0
        )
    ) AS DATE
  )`;

function baseSql() {
  return `
    WITH base AS (
      SELECT DISTINCT
        DCD.SCSS_SLIP_NO AS CCS_Slip_No,
        DCD.NUMBER AS Weigh_No,
        CASE
          WHEN vw.Region_Name IN ('NAITIRI', 'MISIKHU', 'KITALE')
            THEN 'WKS-NAITIRI'
          WHEN vw.Region_Name = 'BUSIA' THEN 'WKS-OLEPITO'
          ELSE 'WKS-KABRAS'
        END AS Unit,
        ${SECTOR_SQL} AS Sector_Name,
        vw.Zone_Name,
        vw.Section_Name,
        vw.Region_Name,
        vw.Village_Name,
        vw.SubLocation,
        MBP.Bus_Partner_ID AS Farmer_ID,
        MBP.First_Name AS Farmer_Name,
        MBP.ID_Number AS Farmer_Id_Number,
        REPLACE(DCD.PL_Number, 'fn-', '') AS Field_No,
        TRY_CONVERT(DECIMAL(18, 4), BPLA.Measured_Cane_Area) AS Field_Area,
        ${CRUSH_DATE_SQL} AS Crush_Date,
        DATEFROMPARTS(
          YEAR(${CRUSH_DATE_SQL}),
          MONTH(${CRUSH_DATE_SQL}),
          1
        ) AS Crush_Month,
        CAST(
          ISNULL(TRY_CONVERT(DECIMAL(18, 2), DCD.GROSS_WT1), 0) / 1000
          AS DECIMAL(18, 3)
        ) AS Gross_Wt,
        CAST(
          ISNULL(TRY_CONVERT(DECIMAL(18, 2), DCD.GROSS_WT2), 0) / 1000
          AS DECIMAL(18, 3)
        ) AS Tare_Wt,
        CAST(
          ISNULL(TRY_CONVERT(DECIMAL(18, 2), DCD.TRASH_WT), 0) / 1000
          AS DECIMAL(18, 3)
        ) AS Ext_Mtr,
        CAST(
          ISNULL(TRY_CONVERT(DECIMAL(18, 2), DCD.NET_WT), 0) / 1000
          AS DECIMAL(18, 3)
        ) AS Net_Wt,
        DCD.VEH_NUMBER AS Vehicle_Number,
        DCD.TRAILER_NUMBER AS Trailer_Number,
        DCD.CON_NAME AS Transporter_Name,
        DCD.DRV_NAME AS Driver_Name,
        DCD.CANE_TYPE AS Cane_Type,
        DCD.IsMobileWeighbridge AS IsMobileWeighbridge
      FROM DT_CCSDATA DCD
      JOIN MD_HARVEST_PERMIT MP
        ON DCD.DT_Harvest_Permit_ID = MP.MD_Harvest_Permit_ID
      JOIN DT_BUS_PARTNER_LOCATION_ATTRIBUTES BPLOA
        ON BPLOA.LeadOpportunity_ID = REPLACE(DCD.PL_Number, 'fn-', '')
      JOIN DT_BUS_PARTNER_LAND_ATTRIBUTES BPLA
        ON BPLA.Land_Attributes_Id = BPLOA.Land_Attributes_Id
      JOIN MD_BUS_PARTNER_MASTER MBP
        ON MBP.Bus_Partner_ID = BPLA.Bus_Partner_ID
      JOIN MD_Village_Related_Data vw
        ON vw.Village_ID = BPLOA.Village_ID
      WHERE DCD.ISACTIVE = 1
        AND MBP.Is_Active = 1
        AND DCD.NUMBER IS NOT NULL
        AND DCD.cancel_flag = 0
        AND DCD.SCSS_SLIP_NO IS NOT NULL
        AND ISNULL(DCD.IS_CRushed, 0) <> 3
        AND (
          TRY_CONVERT(DATETIME, DCD.GROSS_DT1)
          + ISNULL(
            TRY_CONVERT(
              DATETIME,
              STUFF(
                RIGHT('0000' + CAST(DCD.GROSS_TM1 AS VARCHAR(4)), 4),
                3,
                0,
                ':'
              )
            ),
            0
          )
        ) BETWEEN TRY_CONVERT(DATETIME, '2025-01-01 06:00:00')
          AND TRY_CONVERT(
            DATETIME,
            CONVERT(VARCHAR(10), DATEADD(DAY, 1, GETDATE()), 120)
              + ' 05:59:59'
          )
    )`;
}

function predicates(clauses, conjunction = "WHERE") {
  return clauses.length ? `${conjunction} ${clauses.join(" AND ")}` : "";
}

function groupColumns(group) {
  return (GROUP_COLUMNS[group] || GROUP_COLUMNS.unit)
    .map((name) => `[${name}]`)
    .join(", ");
}

function detailedSql(clauses) {
  return `${baseSql()}
    SELECT
      Unit,
      Sector_Name,
      Zone_Name,
      Section_Name,
      Crush_Date,
      Crush_Month,
      CCS_Slip_No,
      Weigh_No,
      Farmer_Name,
      Farmer_Id_Number,
      Field_No,
      Field_Area,
      Gross_Wt,
      Tare_Wt,
      Ext_Mtr,
      Net_Wt,
      Vehicle_Number,
      Trailer_Number,
      Transporter_Name,
      Driver_Name,
      Cane_Type,
      IsMobileWeighbridge
    FROM base
    ${predicates(clauses)}
    ORDER BY
      Crush_Date,
      Unit,
      Sector_Name,
      Zone_Name,
      Section_Name,
      Weigh_No;`;
}

function dailyWeighmentDetailedSql(clauses) {
  return `
    WITH daily_weighment AS (
      SELECT DISTINCT
        1 AS Response,
        'Daily Weighment Details' AS Message,
        CONVERT(VARCHAR(10), TRY_CONVERT(DATE, DCD.GROSS_DT1), 23) AS GROSS_DT1,
        DCD.NUMBER AS Weigh_No,
        MP.Permit_No AS Permit_No,
        DCD.SCSS_SLIP_NO AS CCS_Slip_No,
        MBP.First_Name AS Farmer_Name,
        MBP.ID_Number AS Farmer_Id,
        DCD.PL_Number AS field_number,
        vw.Region_Name,
        CASE
          WHEN vw.Region_Name = 'KABRAS CENTRAL' THEN
            CASE
              WHEN vw.Zone_Name IN ('CENTRAL ZONE-B', 'EASTERN ZONE') THEN 'KABRAS B'
              ELSE 'KABRAS A'
            END
          WHEN vw.Region_Name IN (
            'MISIKHU',
            'NAITIRI',
            'KITALE',
            'BUSIA',
            'NZOIA',
            'MAGUT',
            'BUTERE'
          ) THEN vw.Region_Name
          WHEN vw.Region_Name IN ('MOI UNIVERSITY', 'TURBO') THEN 'SELIA'
          WHEN vw.Region_Name IN ('DOROFU', 'DOROFU KHALABA') THEN 'KHALABA'
          WHEN vw.Region_Name IN ('KABRAS WEST', 'KABRAS NORTH') THEN 'KABRAS A'
          WHEN vw.Region_Name IN (
            'KAKAMEGA',
            'BUKURA',
            'KABRAS SOUTH',
            'KAIMOSI',
            'KABRAS'
          ) THEN 'KABRAS B'
          WHEN vw.Region_Name = 'SIAYA' THEN 'LAKE AGRO'
          WHEN vw.Region_Name IN ('MIWANI', 'KERICHO', 'CHEMELIL') THEN 'NYANDO'
          WHEN vw.Region_Name IN ('Eastern', 'Northern', 'Southern', 'Western')
            THEN vw.Region_Name
          WHEN vw.Region_Name = 'Central' THEN 'Nzoia Nucleus'
          ELSE 'NOT MAPPED'
        END AS Sector_Name,
        vw.ZONE_NAME AS Zone,
        vw.SubLocation,
        vw.Village_Name,
        HCON.First_Name + ' ' + ISNULL(HCON.Last_Name, '') AS Harvester_Name,
        DCD.CON_CODE AS ID,
        DCD.VEH_NUMBER + ' / ' + DCD.TRAILER_NUMBER AS Tractor_Trailer,
        DCD.DRV_NAME + ' / ' + Drv.Id_Number AS Driver_Name,
        Drv.Id_Number AS Driver_Id,
        BPLA.Measured_Cane_Area,
        MM.Description AS Material_Desc,
        CAST(
          ISNULL(TRY_CONVERT(DECIMAL(18, 2), DCD.GROSS_WT1), 0) / 1000
          AS DECIMAL(18, 3)
        ) AS Gross_Wt,
        CAST(
          ISNULL(TRY_CONVERT(DECIMAL(18, 2), DCD.GROSS_WT2), 0) / 1000
          AS DECIMAL(18, 3)
        ) AS Tare_Wt,
        CAST(
          ISNULL(TRY_CONVERT(DECIMAL(18, 2), DCD.TRASH_WT), 0) / 1000
          AS DECIMAL(18, 3)
        ) AS Ext_Mtr,
        CAST(
          ISNULL(TRY_CONVERT(DECIMAL(18, 2), DCD.NET_WT), 0) / 1000
          AS DECIMAL(18, 3)
        ) AS Net_Wt,
        CASE
          WHEN LEN(CAST(DCD.GROSS_TM1 AS VARCHAR)) = 3 THEN
            LEFT(CAST(DCD.GROSS_TM1 AS VARCHAR), 1) + ':'
              + RIGHT(CAST(DCD.GROSS_TM1 AS VARCHAR), 2)
          WHEN LEN(CAST(DCD.GROSS_TM1 AS VARCHAR)) = 4 THEN
            LEFT(CAST(DCD.GROSS_TM1 AS VARCHAR), 2) + ':'
              + RIGHT(CAST(DCD.GROSS_TM1 AS VARCHAR), 2)
          ELSE NULL
        END AS In_Time,
        CASE
          WHEN LEN(CAST(DCD.GROSS_TM2 AS VARCHAR)) = 3 THEN
            LEFT(CAST(DCD.GROSS_TM2 AS VARCHAR), 1) + ':'
              + RIGHT(CAST(DCD.GROSS_TM2 AS VARCHAR), 2)
          WHEN LEN(CAST(DCD.GROSS_TM2 AS VARCHAR)) = 4 THEN
            LEFT(CAST(DCD.GROSS_TM2 AS VARCHAR), 2) + ':'
              + RIGHT(CAST(DCD.GROSS_TM2 AS VARCHAR), 2)
          ELSE NULL
        END AS Out_Time,
        CASE
          WHEN BPLA.IS_SYNCH = 1 THEN 'Synched'
          ELSE 'UnSynched'
        END AS Is_Synch,
        CASE
          WHEN MBP.Is_Company = 0 THEN
            CASE
              WHEN MBP.Is_Verified = 0 THEN 'Initial'
              WHEN MBP.Is_Verified = 1 THEN 'Verified'
              WHEN MBP.Is_Verified = 2 THEN 'IPRS Error'
              WHEN MBP.Is_Verified = 3 THEN 'Pending'
            END
          WHEN MBP.Is_Company = 1 THEN 'NOT APPLICABLE'
        END AS Iprs_Status,
        CASE
          WHEN MBP.Is_Company = 0 THEN 'Individual'
          WHEN MBP.Is_Company = 1 THEN 'Company'
        END AS BP_Type,
        MBP.Contact_No,
        MSM.Name AS Loading_Station,
        MP.Cane_Age AS CANE_AGE,
        DCD.CON_NAME AS Transporter_Name,
        L1.Id_Number AS Loader1_ID_No,
        L2.Id_Number AS Loader2_ID_No,
        MTZ.Zone AS Tranport_Zone,
        vw.Distance,
        DCD.FUEL_QTY,
        FD.Fuel_Dispensed,
        vw.Section_Name,
        ISNULL(DCD.IsMobileWeighbridge, 0) AS IsMobileWeighbridge,
        CASE
          WHEN ISNULL(DCD.IsMobileWeighbridge, 0) = 1
            THEN 'Mobile Weighbridge'
          ELSE 'Static Weighbridge'
        END AS Weighbridge_Type,
        CASE WHEN DCD.IsExcess = 1 THEN 'Excess' ELSE 'Normal' END AS SlipType,
        VWV.veh_type,
        SUBSTRING(
          DCD.SCSS_SLIP_NO,
          CHARINDEX('-', DCD.SCSS_SLIP_NO) + 1,
          LEN(DCD.SCSS_SLIP_NO)
        ) + '/' + CONVERT(NVARCHAR, MP.Estimated_Load) AS SR_NO,
        CASE
          WHEN vw.Region_Name IN ('NAITIRI', 'MISIKHU', 'KITALE')
            THEN 'WKS-NAITIRI'
          WHEN vw.Region_Name = 'BUSIA' THEN 'WKS-OLEPITO'
          ELSE 'WKS-KABRAS'
        END AS Unit,
        ${CRUSH_DATE_SQL} AS Crush_Date,
        vw.Zone_Name
      FROM DT_CCSDATA DCD
      JOIN MD_HARVEST_PERMIT MP
        ON DCD.DT_Harvest_Permit_ID = MP.MD_Harvest_Permit_ID
      LEFT JOIN MD_STORAGE_MASTER MSM
        ON DCD.C_CODE = MSM.LG_CENTER_CODE
      JOIN DT_BUS_PARTNER_LOCATION_ATTRIBUTES BPLOA
        ON BPLOA.LeadOpportunity_ID = REPLACE(DCD.PL_Number, 'fn-', '')
      JOIN DT_BUS_PARTNER_LAND_ATTRIBUTES BPLA
        ON BPLA.Land_Attributes_Id = BPLOA.Land_Attributes_Id
      JOIN MD_BUS_PARTNER_MASTER MBP
        ON MBP.Bus_Partner_ID = BPLA.Bus_Partner_ID
      JOIN MD_Village_Related_Data vw
        ON vw.Village_ID = BPLOA.Village_ID
      LEFT JOIN dt_ccs_contractor_mapping map
        ON map.ccs_no = DCD.SCSS_SLIP_NO
      LEFT JOIN MD_CONTRACTOR HCON
        ON HCON.Contractor_ID = map.harvester_contractor_id
      LEFT JOIN MD_MATERIAL_MASTER MM
        ON MM.Material_Master_ID = DCD.Material_Master_ID
      LEFT JOIN MD_HR_PARTNER_MASTER Drv
        ON TRY_CONVERT(BIGINT, DCD.DRV_Code) = Drv.Hr_Partner_id
      LEFT JOIN MD_HR_PARTNER_MASTER L1
        ON TRY_CONVERT(BIGINT, DCD.LOADER1_CODE) = L1.Hr_Partner_id
      LEFT JOIN MD_HR_PARTNER_MASTER L2
        ON TRY_CONVERT(BIGINT, DCD.LOADER2_CODE) = L2.Hr_Partner_id
      LEFT JOIN vw_transportZone MTZ
        ON MTZ.PurchaseCentre_Or_Region_ID = vw.Region_ID
        AND MTZ.RangeFrom <= ISNULL(TRY_CONVERT(DECIMAL(18, 2), vw.Distance), 0)
        AND MTZ.RangeTo >= ISNULL(TRY_CONVERT(DECIMAL(18, 2), vw.Distance), 0)
        AND MTZ.Material_ID = DCD.Material_Master_ID
      LEFT JOIN Fuel_Dispense_Pending FD
        ON FD.Token_No = DCD.NUMBER
        AND DCD.SCSS_SLIP_NO = FD.CCS_NO
        AND ISNULL(FD.IS_CANCEL, 0) = 0
      LEFT JOIN VW_INTG_VEHICLE VWV
        ON VWV.veh_number = DCD.VEH_NUMBER
      WHERE DCD.ISACTIVE = 1
        AND MBP.Is_Active = 1
        AND DCD.NUMBER IS NOT NULL
        AND DCD.cancel_flag = 0
        AND DCD.SCSS_SLIP_NO IS NOT NULL
        AND ISNULL(DCD.IS_CRushed, 0) <> 3
    )
    SELECT
      Response,
      Message,
      GROSS_DT1,
      Weigh_No,
      Permit_No,
      CCS_Slip_No,
      Farmer_Name,
      Farmer_Id,
      field_number,
      Region_Name,
      Sector_Name,
      Zone,
      SubLocation,
      Village_Name,
      Harvester_Name,
      ID,
      Tractor_Trailer,
      Driver_Name,
      Driver_Id,
      Measured_Cane_Area,
      Material_Desc,
      Gross_Wt,
      Tare_Wt,
      Ext_Mtr,
      Net_Wt,
      In_Time,
      Out_Time,
      Is_Synch,
      Iprs_Status,
      BP_Type,
      Contact_No,
      Loading_Station,
      CANE_AGE,
      Transporter_Name,
      Loader1_ID_No,
      Loader2_ID_No,
      Tranport_Zone,
      Distance,
      FUEL_QTY,
      Fuel_Dispensed,
      Section_Name,
      IsMobileWeighbridge,
      Weighbridge_Type,
      SlipType,
      veh_type,
      SR_NO
    FROM daily_weighment
    ${predicates(clauses)}
    ORDER BY
      Crush_Date,
      Unit,
      Sector_Name,
      Zone_Name,
      Section_Name,
      Weigh_No;`;
}

function summarySql(clauses, group) {
  const groups = groupColumns(group);

  return `${baseSql()}
    , flagged AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY Field_No
          ORDER BY Weigh_No
        ) AS rn
      FROM base
      ${predicates(clauses)}
    )
    SELECT
      ${groups},
      COUNT(DISTINCT Farmer_ID) AS [Number of Farmers],
      COUNT(DISTINCT Field_No) AS [Number of Fields],
      SUM(CASE WHEN rn = 1 THEN Field_Area ELSE 0 END) AS [Field Area],
      SUM(Net_Wt) AS [Net Weight],
      COUNT(DISTINCT CCS_Slip_No) AS [Number of CCS],
      SUM(Net_Wt) / NULLIF(COUNT(DISTINCT CCS_Slip_No), 0) AS [Bundle Weight]
    FROM flagged
    GROUP BY ${groups}
    ORDER BY ${groups};`;
}

function caneGroupSelect(group) {
  if (group === "sector") {
    return "Unit, Sector_Name AS [Sector Name]";
  }

  if (group === "zone") {
    return "Unit, Sector_Name AS [Sector Name], Zone_Name AS [Zone Name]";
  }

  if (group === "section") {
    return "Unit, Sector_Name AS [Sector Name], Zone_Name AS [Zone Name], Section_Name AS [Section Name]";
  }

  return "Unit";
}

function caneGroupColumns(group) {
  if (group === "sector") return "Unit, Sector_Name";
  if (group === "zone") return "Unit, Sector_Name, Zone_Name";
  if (group === "section") return "Unit, Sector_Name, Zone_Name, Section_Name";
  return "Unit";
}

function caneMonthlySummarySql(clauses, group) {
  const select = caneGroupSelect(group);
  const columns = caneGroupColumns(group);

  return `${baseSql()}
    SELECT
      ${select},
      CONVERT(VARCHAR(10), Crush_Month, 23) AS [Month],
      SUM(Net_Wt) AS [Net Weight]
    FROM base
    ${predicates(clauses)}
    GROUP BY ${columns}, Crush_Month
    ORDER BY Crush_Month, ${columns};`;
}

function monthDetails(monthStart) {
  const date = new Date(`${monthStart}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function caneDailyPivotSql(clauses, group, monthStart) {
  const dayCount = monthDetails(monthStart);
  const dayColumns = Array.from(
    { length: dayCount },
    (_, index) => `[${index + 1}]`,
  ).join(", ");
  const groups =
    group === "sector"
      ? "Unit, Sector_Name AS [Sector Name]"
      : group === "zone"
        ? "Unit, Sector_Name AS [Sector Name], Zone_Name AS [Zone Name]"
        : group === "section"
          ? "Unit, Sector_Name AS [Sector Name], Zone_Name AS [Zone Name], Section_Name AS [Section Name]"
          : "Unit";
  const sourceGroups =
    group === "sector"
      ? "Unit, Sector_Name"
      : group === "zone"
        ? "Unit, Sector_Name, Zone_Name"
        : group === "section"
          ? "Unit, Sector_Name, Zone_Name, Section_Name"
          : "Unit";

  return `${baseSql()}
    , month_base AS (
      SELECT *
      FROM base
      WHERE Crush_Date >= @dateFrom
        AND Crush_Date < DATEADD(MONTH, 1, @dateFrom)
        ${clauses.length ? `AND ${clauses.join(" AND ")}` : ""}
    )
    , daily_pivot AS (
      SELECT *
      FROM (
        SELECT
          ${sourceGroups},
          DAY(Crush_Date) AS Day_No,
          Net_Wt
        FROM month_base
      ) AS source_rows
      PIVOT (
        SUM(Net_Wt)
        FOR Day_No IN (${dayColumns})
      ) AS pivoted_rows
    )
    SELECT
      ${groups},
      ${dayColumns}
    FROM daily_pivot
    ORDER BY ${sourceGroups};`;
}

function orderedPivotResult(result, group) {
  const hierarchy =
    group === "sector"
      ? ["Unit", "Sector Name"]
      : group === "zone"
        ? ["Unit", "Sector Name", "Zone Name"]
        : group === "section"
          ? ["Unit", "Sector Name", "Zone Name", "Section Name"]
          : ["Unit"];
  const columns = [
    ...hierarchy.filter((column) => result.columns.includes(column)),
    ...result.columns.filter((column) => !hierarchy.includes(column)),
  ];

  return {
    columns,
    rows: result.rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column, row[column]])),
    ),
  };
}

export async function runHarvestingQuery({
  reportId,
  variant,
  group,
  clauses,
  parameters,
}) {
  const boundParameters = { dateFrom: null, dateTo: null, ...parameters };
  let text;

  if (reportId === "daily-weighment" && variant === "summary") {
    text = summarySql(clauses, group);
  } else if (reportId === "daily-weighment" && variant === "detailed") {
    text = dailyWeighmentDetailedSql(clauses);
  } else if (reportId === "cane-supply" && variant === "summary") {
    text = caneMonthlySummarySql(clauses, group);
  } else if (reportId === "cane-supply" && variant === "detailed") {
    const monthStart =
      parameters.dateFrom || new Date().toISOString().slice(0, 7) + "-01";
    const dateFrom = parameters.dateFrom
      ? new Date(`${parameters.dateFrom}T00:00:00Z`)
      : null;
    const dateTo = parameters.dateTo
      ? new Date(`${parameters.dateTo}T00:00:00Z`)
      : null;

    if (
      dateFrom &&
      dateTo &&
      (dateFrom.getUTCFullYear() !== dateTo.getUTCFullYear() ||
        dateFrom.getUTCMonth() !== dateTo.getUTCMonth())
    ) {
      throw httpError(
        "Cane Supply Daily Detailed requires Date From and Date To to be in the same month.",
        400,
      );
    }

    const year = Number(monthStart.slice(0, 4));
    const month = Number(monthStart.slice(5, 7));
    const nextMonth = new Date(Date.UTC(year, month, 1))
      .toISOString()
      .slice(0, 10);

    boundParameters.dateFrom = monthStart;
    boundParameters.dateTo = nextMonth;
    text = caneDailyPivotSql(
      clauses.filter(
        (clause) =>
          !clause.startsWith("Crush_Date >=") &&
          !clause.startsWith("Crush_Date <"),
      ),
      group,
      monthStart,
    );
  } else {
    text = detailedSql(clauses);
  }

  const result = await executeWarehouseQuery(text, boundParameters);

  return reportId === "cane-supply" && variant === "detailed"
    ? orderedPivotResult(result, group)
    : result;
}

export async function loadHarvestingFilters() {
  return executeWarehouseQuery(`
    SELECT DISTINCT
      CASE
        WHEN vw.Region_Name IN ('NAITIRI', 'MISIKHU', 'KITALE')
          THEN 'WKS-NAITIRI'
        WHEN vw.Region_Name = 'BUSIA' THEN 'WKS-OLEPITO'
        ELSE 'WKS-KABRAS'
      END AS unit,
      ${SECTOR_SQL} AS sector,
      Zone_Name AS zone,
      Section_Name AS section
    FROM MD_Village_Related_Data vw
    WHERE PlantName2 IS NOT NULL
    ORDER BY unit, sector, zone, section
  `);
}