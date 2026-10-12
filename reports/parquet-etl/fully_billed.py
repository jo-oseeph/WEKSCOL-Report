"""
Extract the fully billed validation quality-check dataset from SQL Server
and save the final result as a separate Parquet file.
"""

import os
from pathlib import Path

import pandas as pd
import pyodbc

OUTPUT_PATH = (
    Path(__file__).resolve().parent
    / "data"
    / "fully_billed.parquet"
)

BUILD_SQL = r"""
WITH base AS (
    SELECT DISTINCT
        DCD.SCSS_SLIP_NO                          AS CCS_Slip,
        DCD.NUMBER                                AS Weigh_No,
        TRY_CONVERT(DATE, DCD.GROSS_DT1)          AS GROSS_DT1,
        DCD.PL_Number                             AS Sup_Field_No,
        MBP.First_Name                            AS Sup_Farmer_Name,
        MBP.ID_Number                             AS Sup_Farmer_Id,
        TRY_CONVERT(DECIMAL(18,4), BPLA.Measured_Cane_Area) AS Sup_Field_Area,
        vw.PlantName2                             AS Sup_Unit_name,
        CASE
            WHEN vw.Region_Name = 'KABRAS CENTRAL' THEN
                CASE WHEN vw.Zone_Name IN ('CENTRAL ZONE-B','EASTERN ZONE') THEN 'KABRAS B' ELSE 'KABRAS A' END
            WHEN vw.Region_Name IN ('MISIKHU','NAITIRI','KITALE','BUSIA','NZOIA','MAGUT','BUTERE') THEN vw.Region_Name
            WHEN vw.Region_Name IN ('MOI UNIVERSITY','TURBO') THEN 'SELIA'
            WHEN vw.Region_Name IN ('DOROFU','DOROFU KHALABA') THEN 'KHALABA'
            WHEN vw.Region_Name IN ('KABRAS WEST','KABRAS NORTH') THEN 'KABRAS A'
            WHEN vw.Region_Name IN ('KAKAMEGA','BUKURA','KABRAS SOUTH','KAIMOSI','KABRAS') THEN 'KABRAS B'
            WHEN vw.Region_Name = 'SIAYA' THEN 'LAKE AGRO'
            WHEN vw.Region_Name IN ('MIWANI','KERICHO','CHEMELIL') THEN 'NYANDO'
            WHEN vw.Region_Name = 'Eastern'  THEN 'Eastern'
            WHEN vw.Region_Name = 'Northern' THEN 'Northern'
            WHEN vw.Region_Name = 'Southern' THEN 'Southern'
            WHEN vw.Region_Name = 'Western'  THEN 'Western'
            WHEN vw.Region_Name = 'Central'  THEN 'Nzoia Nucleus'
            ELSE 'NOT MAPPED'
        END                                       AS Sup_Sector_Name,
        vw.Zone_Name                              AS Sup_Zone_Name,
        vw.Section_Name                           AS Sup_Section_Name,
        vw.SubLocation                            AS Sup_SubLocation,
        LTRIM(RTRIM(REPLACE(REPLACE(vw.Village_Name, CHAR(13), ''), CHAR(10), ''))) AS Sup_Village_Name,
        CAST(ISNULL(TRY_CONVERT(DECIMAL(18,2), DCD.NET_WT), 0) / 1000 AS DECIMAL(18,3)) AS Net_Wt
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
    JOIN MD_MATERIAL_MASTER MM
        ON MM.Material_Master_ID = DCD.Material_Master_ID
    WHERE MM.Description LIKE '%SEED%'
      AND DCD.ISACTIVE = 1
      AND MBP.Is_Active = 1
      AND DCD.NUMBER IS NOT NULL
      AND DCD.cancel_flag = 0
      AND DCD.SCSS_SLIP_NO IS NOT NULL
      AND ISNULL(DCD.IS_CRushed, 0) <> 3
      AND (TRY_CONVERT(DATETIME, DCD.GROSS_DT1) +
           ISNULL(TRY_CONVERT(DATETIME, STUFF(RIGHT('0000' + CAST(DCD.GROSS_TM1 AS VARCHAR(4)), 4), 3, 0, ':')), 0))
          BETWEEN TRY_CONVERT(DATETIME, '2026-01-01 06:00:00')
              AND TRY_CONVERT(DATETIME, CONVERT(VARCHAR(10), DATEADD(DAY, 1, GETDATE()), 120) + ' 05:59:59')
),

slip AS (
    SELECT x.*
    FROM (
        SELECT
            b.*,
            SUM(b.Net_Wt)    OVER (PARTITION BY b.CCS_Slip)                     AS Net_Weight,
            MIN(b.GROSS_DT1) OVER (PARTITION BY b.CCS_Slip)                     AS Slip_Date,
            ROW_NUMBER()     OVER (PARTITION BY b.CCS_Slip ORDER BY b.Weigh_No) AS pick
        FROM base b
    ) x
    WHERE x.pick = 1
),

slip_billed AS (
    SELECT
        dim.CCSNo AS CCS_Slip,
        SUM(ISNULL(TRY_CONVERT(DECIMAL(18,4), dim.Delivered_Qty), 0)) AS Slip_Billed_Qty_Raw
    FROM dt_investment_material dim
    WHERE dim.CostType = 'MAT'
      AND dim.CCSNo IN (SELECT CCS_Slip FROM slip)
    GROUP BY dim.CCSNo
),

status AS (
    SELECT
        s.*,
        CAST(ROUND(sb.Slip_Billed_Qty_Raw, 2) AS DECIMAL(18,2))                                                  AS Slip_Billed_Qty,
        CAST(ROUND(s.Net_Weight, 2) AS DECIMAL(18,2)) - CAST(ROUND(sb.Slip_Billed_Qty_Raw, 2) AS DECIMAL(18,2)) AS Billed_Diff,
        CASE
            WHEN ROUND(sb.Slip_Billed_Qty_Raw, 2) <= 0 THEN 'Not billed'
            WHEN ROUND(s.Net_Weight, 2) - ROUND(sb.Slip_Billed_Qty_Raw, 2) < -0.05 THEN 'Over billed'
            WHEN ROUND(s.Net_Weight, 2) - ROUND(sb.Slip_Billed_Qty_Raw, 2) <= 0 THEN 'Fully billed'
            ELSE 'Partially billed'
        END AS Billing_Status
    FROM slip s
    JOIN slip_billed sb ON sb.CCS_Slip = s.CCS_Slip
),

billed AS (
    SELECT
        dim.CCSNo                                  AS CCS_Slip,
        dim.DN_Number,
        CAST(dim.DN_Date AS DATE)                  AS DN_Date,
        dim.field_no                               AS Rec_Field_No,
        TRY_CONVERT(DECIMAL(18,4), dim.Delivered_Qty) AS Delivered_Qty,
        dim.Actual_Rate                            AS SC_Actual_Rate,
        dim.Actual_cost                            AS SC_Actual_Cost,
        tz.TZ_Actual_Rate,
        tz.TZ_Actual_Cost,
        RBP.First_Name                             AS Rec_Farmer_Name,
        RBP.ID_Number                              AS Rec_Farmer_Id,
        VW.PlantName2                              AS Rec_Unit_name,
        CASE
            WHEN VW.Region_Name = 'KABRAS CENTRAL' THEN
                CASE WHEN VW.Zone_Name IN ('CENTRAL ZONE-B','EASTERN ZONE') THEN 'KABRAS B' ELSE 'KABRAS A' END
            WHEN VW.Region_Name IN ('MISIKHU','NAITIRI','KITALE','BUSIA','NZOIA','MAGUT','BUTERE') THEN VW.Region_Name
            WHEN VW.Region_Name IN ('MOI UNIVERSITY','TURBO') THEN 'SELIA'
            WHEN VW.Region_Name IN ('DOROFU','DOROFU KHALABA') THEN 'KHALABA'
            WHEN VW.Region_Name IN ('KABRAS WEST','KABRAS NORTH') THEN 'KABRAS A'
            WHEN VW.Region_Name IN ('KAKAMEGA','BUKURA','KABRAS SOUTH','KAIMOSI','KABRAS') THEN 'KABRAS B'
            WHEN VW.Region_Name = 'SIAYA' THEN 'LAKE AGRO'
            WHEN VW.Region_Name IN ('MIWANI','KERICHO','CHEMELIL') THEN 'NYANDO'
            WHEN VW.Region_Name = 'Eastern'  THEN 'Eastern'
            WHEN VW.Region_Name = 'Northern' THEN 'Northern'
            WHEN VW.Region_Name = 'Southern' THEN 'Southern'
            WHEN VW.Region_Name = 'Western'  THEN 'Western'
            WHEN VW.Region_Name = 'Central'  THEN 'Nzoia Nucleus'
            ELSE 'NOT MAPPED'
        END                                        AS Rec_Sector_Name,
        VW.Zone_Name                               AS Rec_Zone_Name,
        VW.Section_Name                            AS Rec_Section_Name,
        VW.SubLocation                             AS Rec_SubLocation,
        LTRIM(RTRIM(REPLACE(REPLACE(VW.Village_Name, CHAR(13), ''), CHAR(10), ''))) AS Rec_Village_Name,
        TRY_CONVERT(DECIMAL(18,4), BPLA.Measured_Cane_Area) AS Rec_Field_Area
    FROM dt_investment_material dim
    OUTER APPLY (
        -- transport (TZ) row: same DN first, then same receiver field
        SELECT TOP 1
            dim2.Actual_Rate AS TZ_Actual_Rate,
            dim2.Actual_cost AS TZ_Actual_Cost
        FROM dt_investment_material dim2
        WHERE dim2.CostType = 'TZ'
          AND dim2.CCSNo = dim.CCSNo
        ORDER BY
            CASE WHEN dim2.DN_Number = dim.DN_Number THEN 0 ELSE 1 END,
            CASE WHEN REPLACE(dim2.field_no, 'fn-', '') = REPLACE(dim.field_no, 'fn-', '') THEN 0 ELSE 1 END,
            dim2.DN_Date, dim2.DN_Number
    ) AS tz
    LEFT JOIN DT_BUS_PARTNER_LAND_ATTRIBUTES BPLA
        ON REPLACE(dim.field_no, 'fn-', '') = BPLA.LeadOpportunity_ID
    LEFT JOIN DT_BUS_PARTNER_LOCATION_ATTRIBUTES BPLOA
        ON BPLOA.Land_Attributes_ID = BPLA.Land_Attributes_ID
    LEFT JOIN MD_BUS_PARTNER_MASTER RBP
        ON RBP.Bus_Partner_ID = BPLA.Bus_Partner_ID
    LEFT JOIN MD_Village_Related_Data VW
        ON VW.VILLAGE_ID = BPLOA.VILLAGE_ID
    WHERE dim.CostType = 'MAT'
      AND dim.CCSNo IN (SELECT CCS_Slip FROM slip)
),

checked AS (
    SELECT
        st.CCS_Slip, st.Slip_Date AS GROSS_DT1, st.Billing_Status,
        st.Sup_Field_No, st.Sup_Farmer_Name, st.Sup_Farmer_Id, st.Sup_Field_Area,
        st.Sup_Unit_name, st.Sup_Sector_Name, st.Sup_Zone_Name, st.Sup_Section_Name,
        st.Sup_SubLocation, st.Sup_Village_Name,
        b.DN_Number, b.DN_Date, b.Rec_Field_No, b.Rec_Farmer_Name, b.Rec_Farmer_Id, b.Rec_Field_Area,
        b.Rec_Unit_name, b.Rec_Sector_Name, b.Rec_Zone_Name, b.Rec_Section_Name,
        b.Rec_SubLocation, b.Rec_Village_Name,
        st.Net_Weight, st.Slip_Billed_Qty, b.Delivered_Qty, st.Billed_Diff,
        b.SC_Actual_Rate, b.SC_Actual_Cost, b.TZ_Actual_Rate, b.TZ_Actual_Cost,
        CAST(ISNULL(TRY_CONVERT(DECIMAL(18,2), b.SC_Actual_Cost), 0)
             - ISNULL(b.Delivered_Qty, 0) * ISNULL(TRY_CONVERT(DECIMAL(18,4), b.SC_Actual_Rate), 0) AS DECIMAL(18,2)) AS SC_Cost_Check,
        CAST(ISNULL(TRY_CONVERT(DECIMAL(18,2), b.TZ_Actual_Cost), 0)
             - ISNULL(b.Delivered_Qty, 0) * ISNULL(TRY_CONVERT(DECIMAL(18,4), b.TZ_Actual_Rate), 0) AS DECIMAL(18,2)) AS TZ_Cost_Check
    FROM status st
    JOIN billed b ON b.CCS_Slip = st.CCS_Slip
    WHERE st.Billing_Status = 'Fully billed'
)

SELECT
    c.*,
    CASE WHEN ABS(c.SC_Cost_Check) > 30 OR ABS(c.TZ_Cost_Check) > 30 THEN 'CHECK' ELSE 'OK' END AS Cost_Flag
FROM checked c
ORDER BY c.Sup_Unit_name, c.Sup_Sector_Name, c.Sup_Zone_Name, c.Sup_Section_Name,
         c.Sup_SubLocation, c.Sup_Village_Name, c.GROSS_DT1, c.CCS_Slip, c.DN_Number;
"""


def get_connection():
    server = os.environ.get("SQL_SERVER")
    database = os.environ.get("SQL_DATABASE")
    username = os.environ.get("SQL_USERNAME")
    password = os.environ.get("SQL_PASSWORD")

    missing = [
        name
        for name, value in {
            "SQL_SERVER": server,
            "SQL_DATABASE": database,
            "SQL_USERNAME": username,
            "SQL_PASSWORD": password,
        }.items()
        if not value
    ]

    if missing:
        raise RuntimeError(
            "Missing required environment variables: " + ", ".join(missing)
        )

    connection_string = (
        "DRIVER={ODBC Driver 18 for SQL Server};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
        "Encrypt=yes;"
        "TrustServerCertificate=yes;"
        "Connection Timeout=30;"
    )

    return pyodbc.connect(connection_string)


def main():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print("connecting to SQL Server...")

    with get_connection() as conn:
        print("building fully billed quality-check temp tables...")

        print("running fully billed validation...")

        df = pd.read_sql(BUILD_SQL, conn)

    df.to_parquet(OUTPUT_PATH, index=False)

    print(f"wrote {len(df):,} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
