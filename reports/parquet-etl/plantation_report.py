
"""
Extract the fully billed validation quality-check datasets from SQL Server
and save field-wise and month-wise results as separate Parquet files.
"""

import os
from pathlib import Path

import pandas as pd
import pyodbc


OUTPUT_DIR = Path(__file__).resolve().parent / "data"

FIELD_WISE_PATH = OUTPUT_DIR / "field_wise.parquet"
MONTH_WISE_PATH = OUTPUT_DIR / "month_wise.parquet"


FIELD_WISE_SQL = r"""
WITH ccs_base AS (
    SELECT
           dim.field_no AS Rec_Field_No
          ,dim.Delivered_Qty
          ,dccs.WeigmentRpt_Dt
          ,RBP.First_Name AS Rec_Farmer_Name
          ,RBP.ID_Number AS Rec_Farmer_Id
          ,VW.PlantName2 AS Unit_name
          ,CASE
               WHEN vw.Region_Name = 'KABRAS CENTRAL' THEN
                   CASE
                       WHEN vw.Zone_Name IN (
                           'CENTRAL ZONE-B', 'EASTERN ZONE'
                       ) THEN 'KABRAS B'
                       ELSE 'KABRAS A'
                   END
               WHEN vw.Region_Name IN (
                   'MISIKHU', 'NAITIRI', 'KITALE', 'BUSIA',
                   'NZOIA', 'MAGUT', 'BUTERE'
               ) THEN vw.Region_Name
               WHEN vw.Region_Name IN ('MOI UNIVERSITY', 'TURBO')
                   THEN 'SELIA'
               WHEN vw.Region_Name IN ('DOROFU', 'DOROFU KHALABA')
                   THEN 'KHALABA'
               WHEN vw.Region_Name IN ('KABRAS WEST', 'KABRAS NORTH')
                   THEN 'KABRAS A'
               WHEN vw.Region_Name IN (
                   'KAKAMEGA', 'BUKURA', 'KABRAS SOUTH',
                   'KAIMOSI', 'KABRAS'
               ) THEN 'KABRAS B'
               WHEN vw.Region_Name = 'SIAYA' THEN 'LAKE AGRO'
               WHEN vw.Region_Name IN ('MIWANI', 'KERICHO', 'CHEMELIL')
                   THEN 'NYANDO'
               WHEN vw.Region_Name = 'Eastern' THEN 'Eastern'
               WHEN vw.Region_Name = 'Northern' THEN 'Northern'
               WHEN vw.Region_Name = 'Southern' THEN 'Southern'
               WHEN vw.Region_Name = 'Western' THEN 'Western'
               WHEN vw.Region_Name = 'Central' THEN 'Nzoia Nucleus'
               ELSE 'NOT MAPPED'
           END AS Sector_Name
          ,VW.Region_Name
          ,VW.Zone_Name
          ,VW.Section_Name
          ,VW.SubLocation
          ,VW.Village_Name
          ,BPLA.Measured_Cane_Area
    FROM DT_CCSDATA dccs
    JOIN dt_investment_material dim
        ON dim.ccsno = dccs.scss_slip_no
    OUTER APPLY (
        SELECT TOP 1 dim2.ccsno
        FROM DT_CCSDATA dccs2
        JOIN dt_investment_material dim2
            ON dim2.ccsno = dccs2.scss_slip_no
        JOIN MD_MATERIAL_MASTER mm2
            ON mm2.Material_Master_ID = dccs2.material_master_id
        INNER JOIN DT_BUS_PARTNER_LAND_ATTRIBUTES BPLA
            ON BPLA.LeadOpportunity_ID =
               REPLACE(dim2.field_no, 'fn-', '')
        INNER JOIN MD_BUS_PARTNER_MASTER RBP
            ON RBP.Bus_Partner_ID = BPLA.Bus_Partner_ID
        WHERE mm2.Material_Group_ID = 2
          AND dim2.CostType = 'TZ'
          AND dim2.ccsno = dim.CCSNo
    ) AS tz
    JOIN MD_MATERIAL_MASTER mm
        ON mm.Material_Master_ID = dccs.material_master_id
    INNER JOIN DT_BUS_PARTNER_LAND_ATTRIBUTES BPLA
        ON REPLACE(dim.field_no, 'fn-', '') =
           BPLA.LeadOpportunity_ID
    JOIN DT_BUS_PARTNER_LOCATION_ATTRIBUTES BPLOA
        ON BPLOA.Land_Attributes_ID = BPLA.Land_Attributes_ID
    INNER JOIN MD_BUS_PARTNER_MASTER RBP
        ON RBP.Bus_Partner_ID = BPLA.Bus_Partner_ID
    INNER JOIN MD_Village_Related_Data VW
        ON VW.VILLAGE_ID = BPLOA.VILLAGE_ID
    INNER JOIN MD_Village_Related_Data VWw
        ON VWw.VILLAGE_ID = dccs.VILLAGE_ID
    WHERE mm.Material_Group_ID = 2
      AND dim.CostType = 'MAT'
      AND dccs.WeigmentRpt_Dt >= '2026-01-01'
      AND dccs.WeigmentRpt_Dt <= GETDATE()
),
ccs_field AS (
    SELECT
           Rec_Field_No
          ,CAST(WeigmentRpt_Dt AS DATE) AS Delivery_Date
          ,Rec_Farmer_Id
          ,Rec_Farmer_Name
          ,Region_Name
          ,Sector_Name
          ,Zone_Name
          ,Section_Name
          ,SubLocation
          ,Village_Name
          ,Unit_name
          ,Measured_Cane_Area
          ,SUM(Delivered_Qty) AS Total_Delivered_Qty
    FROM ccs_base
    GROUP BY
           Rec_Field_No
          ,CAST(WeigmentRpt_Dt AS DATE)
          ,Rec_Farmer_Id
          ,Rec_Farmer_Name
          ,Region_Name
          ,Sector_Name
          ,Zone_Name
          ,Section_Name
          ,SubLocation
          ,Village_Name
          ,Unit_name
          ,Measured_Cane_Area
),
field_master AS (
    SELECT
           Lead_Number
          ,Contract_Number
          ,Current_Crop_Cycle
          ,Cordinates
          ,Actual_Date_Of_Plant_Ratoon
    FROM (
        SELECT
               'FN-' + CAST(
                   v.LeadOpportunity_ID AS VARCHAR(50)
               ) AS Lead_Number
              ,v.Contract_Number
              ,v.Current_Crop_Cycle
              ,v.Cordinates
              ,CAST(
                   v.Actual_Date_Of_Plant_Ratoon AS DATE
               ) AS Actual_Date_Of_Plant_Ratoon
              ,ROW_NUMBER() OVER (
                   PARTITION BY v.LeadOpportunity_ID
                   ORDER BY
                       v.Actual_Date_Of_Plant_Ratoon DESC,
                       v.Contract_Number DESC
               ) AS rn
        FROM dbo.VW_BP_LOC_ATTR_NEW v
    ) x
    WHERE rn = 1
)
SELECT
       cf.Rec_Field_No
      ,cf.Rec_Farmer_Id
      ,cf.Rec_Farmer_Name
      ,cf.Unit_name
      ,cf.Sector_Name
      ,cf.Region_Name
      ,cf.Zone_Name
      ,cf.Section_Name
      ,cf.SubLocation
      ,cf.Village_Name
      ,fm.Contract_Number
      ,fm.Current_Crop_Cycle
      ,fm.Cordinates
      ,fm.Actual_Date_Of_Plant_Ratoon
      ,DATEDIFF(
           MONTH,
           fm.Actual_Date_Of_Plant_Ratoon,
           GETDATE()
       ) AS Age
      ,cf.Delivery_Date
      ,cf.Measured_Cane_Area
      ,cf.Total_Delivered_Qty
FROM ccs_field cf
LEFT JOIN field_master fm
    ON fm.Lead_Number = cf.Rec_Field_No
ORDER BY
    cf.Delivery_Date,
    cf.Rec_Field_No;
"""


MONTH_WISE_SQL = r"""
WITH base AS (
    SELECT
           dim.field_no AS Rec_Field_No
          ,dim.Delivered_Qty
          ,dccs.WeigmentRpt_Dt
          ,VW.PlantName2 AS Unit_name
          ,CASE
               WHEN vw.Region_Name = 'KABRAS CENTRAL' THEN
                   CASE
                       WHEN vw.Zone_Name IN (
                           'CENTRAL ZONE-B', 'EASTERN ZONE'
                       ) THEN 'KABRAS B'
                       ELSE 'KABRAS A'
                   END
               WHEN vw.Region_Name IN (
                   'MISIKHU', 'NAITIRI', 'KITALE', 'BUSIA',
                   'NZOIA', 'MAGUT', 'BUTERE'
               ) THEN vw.Region_Name
               WHEN vw.Region_Name IN ('MOI UNIVERSITY', 'TURBO')
                   THEN 'SELIA'
               WHEN vw.Region_Name IN ('DOROFU', 'DOROFU KHALABA')
                   THEN 'KHALABA'
               WHEN vw.Region_Name IN ('KABRAS WEST', 'KABRAS NORTH')
                   THEN 'KABRAS A'
               WHEN vw.Region_Name IN (
                   'KAKAMEGA', 'BUKURA', 'KABRAS SOUTH',
                   'KAIMOSI', 'KABRAS'
               ) THEN 'KABRAS B'
               WHEN vw.Region_Name = 'SIAYA' THEN 'LAKE AGRO'
               WHEN vw.Region_Name IN ('MIWANI', 'KERICHO', 'CHEMELIL')
                   THEN 'NYANDO'
               WHEN vw.Region_Name = 'Eastern' THEN 'Eastern'
               WHEN vw.Region_Name = 'Northern' THEN 'Northern'
               WHEN vw.Region_Name = 'Southern' THEN 'Southern'
               WHEN vw.Region_Name = 'Western' THEN 'Western'
               WHEN vw.Region_Name = 'Central' THEN 'Nzoia Nucleus'
               ELSE 'NOT MAPPED'
           END AS Sector_Name
          ,VW.Region_Name
          ,VW.Zone_Name
          ,VW.Section_Name
          ,VW.SubLocation
          ,BPLA.Measured_Cane_Area
    FROM DT_CCSDATA dccs
    JOIN dt_investment_material dim
        ON dim.ccsno = dccs.scss_slip_no
    OUTER APPLY (
        SELECT TOP 1 dim2.ccsno
        FROM DT_CCSDATA dccs2
        JOIN dt_investment_material dim2
            ON dim2.ccsno = dccs2.scss_slip_no
        JOIN MD_MATERIAL_MASTER mm2
            ON mm2.Material_Master_ID = dccs2.material_master_id
        INNER JOIN DT_BUS_PARTNER_LAND_ATTRIBUTES BPLA
            ON BPLA.LeadOpportunity_ID =
               REPLACE(dim2.field_no, 'fn-', '')
        INNER JOIN MD_BUS_PARTNER_MASTER RBP
            ON RBP.Bus_Partner_ID = BPLA.Bus_Partner_ID
        WHERE mm2.Material_Group_ID = 2
          AND dim2.CostType = 'TZ'
          AND dim2.ccsno = dim.CCSNo
    ) AS tz
    JOIN MD_MATERIAL_MASTER mm
        ON mm.Material_Master_ID = dccs.material_master_id
    INNER JOIN DT_BUS_PARTNER_LAND_ATTRIBUTES BPLA
        ON REPLACE(dim.field_no, 'fn-', '') =
           BPLA.LeadOpportunity_ID
    JOIN DT_BUS_PARTNER_LOCATION_ATTRIBUTES BPLOA
        ON BPLOA.Land_Attributes_ID = BPLA.Land_Attributes_ID
    INNER JOIN MD_BUS_PARTNER_MASTER RBP
        ON RBP.Bus_Partner_ID = BPLA.Bus_Partner_ID
    INNER JOIN MD_Village_Related_Data VW
        ON VW.VILLAGE_ID = BPLOA.VILLAGE_ID
    INNER JOIN MD_Village_Related_Data VWw
        ON VWw.VILLAGE_ID = dccs.VILLAGE_ID
    WHERE mm.Material_Group_ID = 2
      AND dim.CostType = 'MAT'
      AND dccs.WeigmentRpt_Dt >= '2026-01-01'
      AND dccs.WeigmentRpt_Dt <= GETDATE()
),
by_field AS (
    SELECT
           Rec_Field_No
          ,DATEFROMPARTS(
               YEAR(WeigmentRpt_Dt),
               MONTH(WeigmentRpt_Dt),
               1
           ) AS Month_Sort
          ,FORMAT(
               WeigmentRpt_Dt, 'MMM yyyy'
           ) AS Delivery_Month
          ,Region_Name
          ,Sector_Name
          ,Zone_Name
          ,Section_Name
          ,SubLocation
          ,Unit_name
          ,SUM(
               TRY_CAST(
                   Delivered_Qty AS DECIMAL(18,3)
               )
           ) AS Total_Delivered_Qty
          ,MAX(
               TRY_CAST(
                   Measured_Cane_Area AS DECIMAL(18,3)
               )
           ) AS Measured_Cane_Area
    FROM base
    GROUP BY
           Rec_Field_No
          ,DATEFROMPARTS(
               YEAR(WeigmentRpt_Dt),
               MONTH(WeigmentRpt_Dt),
               1
           )
          ,FORMAT(WeigmentRpt_Dt, 'MMM yyyy')
          ,Region_Name
          ,Sector_Name
          ,Zone_Name
          ,Section_Name
          ,SubLocation
          ,Unit_name
),
ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY Rec_Field_No
               ORDER BY Month_Sort
           ) AS rn
    FROM by_field
)
SELECT
       Delivery_Month
      ,Unit_name
      ,Sector_Name
      ,Region_Name
      ,Zone_Name
      ,Section_Name
      ,SubLocation
      ,COUNT(*) AS No_of_Fields
      ,SUM(Measured_Cane_Area) AS Total_Acreage
FROM ranked
WHERE rn = 1
GROUP BY
       Month_Sort
      ,Delivery_Month
      ,Unit_name
      ,Sector_Name
      ,Region_Name
      ,Zone_Name
      ,Section_Name
      ,SubLocation
ORDER BY
       Month_Sort
      ,Unit_name
      ,Sector_Name
      ,Region_Name
      ,Zone_Name
      ,Section_Name
      ,SubLocation;
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
            "Missing required environment variables: "
            + ", ".join(missing)
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
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Connecting to SQL Server...")

    with get_connection() as conn:
        print("Running field-wise validation query...")

        field_df = pd.read_sql(FIELD_WISE_SQL, conn)
        field_df.to_parquet(FIELD_WISE_PATH, index=False)

        print(
            f"Saved {len(field_df):,} rows to "
            f"{FIELD_WISE_PATH}"
        )

        print("Running month-wise validation query...")

        month_df = pd.read_sql(MONTH_WISE_SQL, conn)
        month_df.to_parquet(MONTH_WISE_PATH, index=False)

        print(
            f"Saved {len(month_df):,} rows to "
            f"{MONTH_WISE_PATH}"
        )

    print("Both validation datasets have been refreshed.")


if __name__ == "__main__":
    main()
