"""
Runs the full extraction in ONE pyodbc session (temp tables only live
for the connection that created them) and writes the result to a
parquet file. This is the only thing that actually does the SQL work.
"""

import os
import sys
from pathlib import Path

import pyodbc
import pandas as pd

OUT_PARQUET = Path(__file__).parent / "data" / "report_base.parquet"

# steps 1-7: build the temp tables
BUILD_SQL = """
DROP TABLE IF EXISTS #FERT;
DROP TABLE IF EXISTS #HDR;
DROP TABLE IF EXISTS #POH;
DROP TABLE IF EXISTS #POM;
DROP TABLE IF EXISTS #BASE;
DROP TABLE IF EXISTS #PGI;
DROP TABLE IF EXISTS #VW2;

SELECT
       A.SERVICE_REQUEST_HEADER_ID
      ,A.Item_ID
      ,A.Qty
      ,A.AgricultureApprovedQty
      ,A.FinanceApprovedQty
      ,A.Created_On
INTO #FERT
FROM DT_SERVICE_REQUEST_MATERIAL A
WHERE
      A.Created_On >= '20260101'
  AND A.Is_Active = 1;

CREATE CLUSTERED INDEX IX_FERT_HEADER ON #FERT (SERVICE_REQUEST_HEADER_ID);
CREATE INDEX IX_FERT_ITEM ON #FERT (Item_ID);

SELECT
       MH.SERVICE_REQUEST_HEADER_ID
      ,MH.ID_Number
      ,MH.Field_Number
      ,REPLACE(MH.Field_Number,'FN-','') AS Lead_no
      ,MH.E_Contract_ID
INTO #HDR
FROM MD_SERVICE_REQUEST_HEADER MH
INNER JOIN (SELECT DISTINCT SERVICE_REQUEST_HEADER_ID FROM #FERT) F
    ON MH.SERVICE_REQUEST_HEADER_ID = F.SERVICE_REQUEST_HEADER_ID;

CREATE CLUSTERED INDEX IX_HDR_HEADER ON #HDR (SERVICE_REQUEST_HEADER_ID);
CREATE INDEX IX_HDR_LEAD ON #HDR (Lead_no);
CREATE INDEX IX_HDR_CONTRACT ON #HDR (E_Contract_ID);

SELECT DISTINCT
       F.Process_Order_Header_ID
      ,F.E_Contract_ID
INTO #POH
FROM MD_PROCESS_ORDER_HEADER F
INNER JOIN (SELECT DISTINCT E_Contract_ID FROM #HDR WHERE E_Contract_ID IS NOT NULL) H
    ON F.E_Contract_ID = H.E_Contract_ID;

CREATE CLUSTERED INDEX IX_POH_HEADER ON #POH (Process_Order_Header_ID);
CREATE INDEX IX_POH_CONTRACT ON #POH (E_Contract_ID);

SELECT
       G.Process_Order_Header_ID
      ,G.Item_ID
      ,G.Process_Order_Material_ID
INTO #POM
FROM DT_PROCESS_ORDER_MATERIAL G
INNER JOIN #POH F ON G.Process_Order_Header_ID = F.Process_Order_Header_ID
INNER JOIN (SELECT DISTINCT Item_ID FROM #FERT) I ON G.Item_ID = I.Item_ID;

CREATE CLUSTERED INDEX IX_POM_HEADER_ITEM ON #POM (Process_Order_Header_ID, Item_ID);
CREATE INDEX IX_POM_ID ON #POM (Process_Order_Material_ID);

SELECT DISTINCT
       LeadOpportunity_ID
      ,Current_Crop_Cycle
      ,Planned_Date_Of_PC_Ratoon
      ,Actual_Date_Of_Plant_Ratoon
      ,Contract_Number
      ,Is_Synch
      ,Is_Company
INTO #VW2
FROM VW_BP_LOC_ATTR_NEW;

CREATE INDEX IX_VW2_LEAD ON #VW2 (LeadOpportunity_ID);

SELECT
       H.Field_Number
      ,CASE WHEN D.Is_overlaped = 0 THEN 'NO OVERLAP'
            WHEN D.Is_overlaped = 1 THEN 'FULL OVERLAP'
            WHEN D.Is_overlaped = -1 THEN 'INITIAL'
            WHEN D.Is_overlaped = 2 THEN 'PARTIAL OVERLAP'
            ELSE 'UNKNOWN' END AS OVERLAP
      ,H.ID_Number
      ,CASE WHEN C.Is_Verified = 2 THEN 'IPRS ERROR'
            WHEN C.Is_Verified = 1 THEN 'VERIFIED'
            WHEN C.Is_Verified = 0 THEN 'COMPANY'
            ELSE 'UNKNOWN' END AS IPRS
      ,C.First_Name
      ,MM.Description
      ,F.Qty AS Qty_Requested
      ,F.AgricultureApprovedQty AS Qty_Agri
      ,F.FinanceApprovedQty AS Qty_Fin
      ,E.Measured_Cane_Area
      ,F.Created_On
      ,G.Process_Order_Material_ID
      ,VW.Region_Name
      ,VW.Zone_Name
      ,VW.Section_Name
      ,VW.SubLocation
      ,VW.PlantName2 AS Unit_name
      ,VW.Village_Name
      ,VW2.Current_Crop_Cycle
      ,VW2.Planned_Date_Of_PC_Ratoon
      ,VW2.Actual_Date_Of_Plant_Ratoon
      ,VW2.Contract_Number
      ,VW2.Is_Synch
      ,VW2.Is_Company
INTO #BASE
FROM #FERT F
INNER JOIN #HDR H ON F.SERVICE_REQUEST_HEADER_ID = H.SERVICE_REQUEST_HEADER_ID
INNER JOIN MD_BUS_PARTNER_MASTER C ON H.ID_Number = C.ID_Number
INNER JOIN DT_BUS_PARTNER_LOCATION_ATTRIBUTES D ON H.Lead_no = D.LeadOpportunity_ID
INNER JOIN DT_BUS_PARTNER_Land_ATTRIBUTES E ON H.Lead_no = E.LeadOpportunity_ID
LEFT JOIN #POH POH ON H.E_Contract_ID = POH.E_Contract_ID
LEFT JOIN #POM G ON POH.Process_Order_Header_ID = G.Process_Order_Header_ID AND F.Item_ID = G.Item_ID
LEFT JOIN MD_MATERIAL_MASTER MM ON F.Item_ID = MM.Material_Master_ID
LEFT JOIN vW_Village_Related_Data VW ON D.village_id = VW.Village_ID
LEFT JOIN #VW2 VW2 ON H.Lead_no = VW2.LeadOpportunity_ID;

CREATE INDEX IX_BASE_POM ON #BASE (Process_Order_Material_ID);

SELECT
       P.Process_Order_Material_ID
      ,P.GoodsID
      ,P.Delivered_Qty AS Qty_Delivered
      ,P.Allocated_Qty AS Qty_Allocated
      ,1 AS NO_OF_PGIs
      ,P.CreatedON
INTO #PGI
FROM DT_GoodsIssue_PO P
INNER JOIN (SELECT DISTINCT Process_Order_Material_ID FROM #BASE WHERE Process_Order_Material_ID IS NOT NULL) X
    ON P.Process_Order_Material_ID = X.Process_Order_Material_ID
WHERE P.CreatedON >= '20260101';

CREATE CLUSTERED INDEX IX_PGI_POM ON #PGI (Process_Order_Material_ID);
CREATE INDEX IX_PGI_GOODSID ON #PGI (GoodsID);
"""

# step 8: the final result that gets exported
FINAL_SQL = """
SELECT
       B.Field_Number
      ,B.OVERLAP
      ,B.ID_Number
      ,B.IPRS
      ,B.First_Name
      ,B.Description
      ,B.Region_Name
      ,CASE
           WHEN B.Region_Name = 'KABRAS CENTRAL' THEN
               CASE WHEN B.Zone_Name IN ('CENTRAL ZONE-B','EASTERN ZONE') THEN 'KABRAS B' ELSE 'KABRAS A' END
           WHEN B.Region_Name IN ('MISIKHU','NAITIRI','KITALE','BUSIA','NZOIA','MAGUT','BUTERE') THEN B.Region_Name
           WHEN B.Region_Name IN ('MOI UNIVERSITY','TURBO') THEN 'SELIA'
           WHEN B.Region_Name IN ('DOROFU','DOROFU KHALABA') THEN 'KHALABA'
           WHEN B.Region_Name IN ('KABRAS WEST','KABRAS NORTH') THEN 'KABRAS A'
           WHEN B.Region_Name IN ('KAKAMEGA','BUKURA','KABRAS SOUTH','KAIMOSI','KABRAS') THEN 'KABRAS B'
           WHEN B.Region_Name = 'SIAYA' THEN 'LAKE AGRO'
           WHEN B.Region_Name IN ('MIWANI','KERICHO','CHEMELIL') THEN 'NYANDO'
           WHEN B.Region_Name = 'Eastern' THEN 'Eastern'
           WHEN B.Region_Name = 'Northern' THEN 'Northern'
           WHEN B.Region_Name = 'Southern' THEN 'Southern'
           WHEN B.Region_Name = 'Western' THEN 'Western'
           WHEN B.Region_Name = 'Central' THEN 'Nzoia Nucleus'
           ELSE 'NOT MAPPED'
       END AS Sector_Name
      ,B.Zone_Name
      ,B.Section_Name
      ,B.SubLocation
      ,B.Unit_name
      ,B.Village_Name
      ,CASE
           WHEN B.Qty_Fin > 0 THEN 'Finance Approved'
           WHEN B.Qty_Agri > 0 THEN 'Agri Approved'
           WHEN B.Qty_Fin = 0 AND B.Qty_Agri > 0 THEN 'Pending Finance Approval'
           WHEN B.Qty_Agri = 0 THEN 'Pending Agriculture Approval'
           ELSE 'Pending'
       END AS [Approval Status]
      ,B.Measured_Cane_Area
      ,1 AS No_of_SR
      ,B.Qty_Requested
      ,B.Qty_Agri
      ,B.Qty_Fin
      ,P.Qty_Allocated
      ,P.Qty_Delivered
      ,P.NO_OF_PGIs
      ,B.Qty_Requested - ISNULL(P.Qty_Delivered,0) AS Qty_Pending
      ,DATEDIFF(DAY,B.Created_On,GETDATE()) AS Ageing_Days
      ,B.Created_On AS Min_Created_On
      ,B.Created_On AS Max_Created_On
      ,B.Current_Crop_Cycle
      ,B.Planned_Date_Of_PC_Ratoon
      ,B.Actual_Date_Of_Plant_Ratoon
      ,B.Contract_Number
      ,B.Is_Synch
      ,B.Is_Company
FROM #BASE B
LEFT JOIN #PGI P ON B.Process_Order_Material_ID = P.Process_Order_Material_ID
ORDER BY B.Region_Name, Sector_Name, B.Field_Number, B.Process_Order_Material_ID, P.GoodsID
OPTION (RECOMPILE);
"""


def get_connection():
    server = os.environ["SQL_SERVER"]
    database = os.environ["SQL_DATABASE"]
    username = os.environ["SQL_USERNAME"]
    password = os.environ["SQL_PASSWORD"]
    driver = os.environ.get("SQL_DRIVER", "{ODBC Driver 18 for SQL Server}")

    conn_str = (
        f"DRIVER={driver};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
        "Encrypt=yes;TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str, timeout=30)


def main():
    print("connecting to SQL Server...")
    conn = get_connection()
    cursor = conn.cursor()

    print("building temp tables (steps 1-7)...")
    for stmt in [s.strip() for s in BUILD_SQL.split(";") if s.strip()]:
        cursor.execute(stmt)

    print("running final select...")
    df = pd.read_sql(FINAL_SQL, conn)

    conn.close()

    OUT_PARQUET.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUT_PARQUET, index=False)
    print(f"wrote {len(df):,} rows to {OUT_PARQUET}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"extraction failed: {exc}", file=sys.stderr)
        sys.exit(1)
