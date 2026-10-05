"""
Extract the fertilizer issuance validation quality-check dataset from SQL Server
and save the final result as a separate Parquet file.

This keeps the senior analyst's SQL logic, including its temporary tables,
pre-aggregated PGI data, OUTER APPLY process-order logic, and final quality
checks. It does not modify the main report_base.parquet dataset.
"""

import os
from pathlib import Path

import pandas as pd
import pyodbc


OUTPUT_PATH = (
    Path(__file__).resolve().parent
    / "data"
    / "fertilizer_issuance_validation.parquet"
)


BUILD_SQL = r"""/* ============================================================
   FERTILIZER ISSUANCE VALIDATION - OPTIMIZED VERSION

   OUTPUT GRAIN:
   ONE ROW = ONE FERTILIZER REQUEST LINE

   UNIQUE CONTEXT:
   - SERVICE_REQUEST_HEADER_ID
   - Item_ID
   - Created_On

   FERTILIZER TYPES:

   PLANTING FERTILIZER (MAX 3 MONTHS)
   - TSP FERTILIZER 50KG
   - MAVUNOPLANTING FERT 50KG

   TOP DRESSING (MAX 9 MONTHS)
   - ELGON THABITI TOP DRESSING 50KG
   - MAVUNO TOP DRESSING FERT 50KG

   STANDARD QUANTITY:
   - Measured Area × 2
   - ROUND TO NEAREST WHOLE BAG

   IMPORTANT:
   - Request quantities are NOT summed.
   - Agriculture/Finance quantities are NOT summed.
   - Delivery is pre-aggregated before joining.
   - Prevents row multiplication from Process Orders.

   ============================================================ */


/* ============================================================
   CLEANUP
   ============================================================ */

DROP TABLE IF EXISTS #FERT;
DROP TABLE IF EXISTS #HDR;
DROP TABLE IF EXISTS #POH;
DROP TABLE IF EXISTS #POM;
DROP TABLE IF EXISTS #PGI;
DROP TABLE IF EXISTS #VW2;
DROP TABLE IF EXISTS #BASE;


/* ============================================================
   1. FERTILIZER REQUESTS
   ============================================================ */

SELECT

     A.SERVICE_REQUEST_HEADER_ID
    ,A.Item_ID

    ,TRY_CONVERT(
        DECIMAL(18,2),
        A.Qty
     ) AS Qty_Requested

    ,TRY_CONVERT(
        DECIMAL(18,2),
        A.AgricultureApprovedQty
     ) AS Qty_Agri

    ,TRY_CONVERT(
        DECIMAL(18,2),
        A.FinanceApprovedQty
     ) AS Qty_Fin

    ,A.Created_On AS Request_Created_On

INTO #FERT

FROM DT_SERVICE_REQUEST_MATERIAL A

WHERE
    A.Created_On >= '20260101'

    AND A.Is_Active = 1

    AND
    (
        A.Item_Description LIKE '%TSP FERTILIZER 50KG%'

        OR A.Item_Description LIKE '%MAVUNOPLANTING FERT 50KG%'

        OR A.Item_Description LIKE '%ELGON THABITI TOP DRESSING 50KG%'

        OR A.Item_Description LIKE '%MAVUNO TOP DRESSING FERT 50KG%'
    );


CREATE CLUSTERED INDEX IX_FERT
ON #FERT
(
    SERVICE_REQUEST_HEADER_ID,
    Item_ID
);


/* ============================================================
   2. REQUEST HEADERS
   ============================================================ */

SELECT DISTINCT

     MH.SERVICE_REQUEST_HEADER_ID
    ,MH.ID_Number
    ,MH.Field_Number
    ,REPLACE(MH.Field_Number, 'FN-', '') AS Lead_no
    ,MH.E_Contract_ID

INTO #HDR

FROM MD_SERVICE_REQUEST_HEADER MH

INNER JOIN
(
    SELECT DISTINCT SERVICE_REQUEST_HEADER_ID
    FROM #FERT
) F

    ON MH.SERVICE_REQUEST_HEADER_ID =
       F.SERVICE_REQUEST_HEADER_ID;


CREATE CLUSTERED INDEX IX_HDR
ON #HDR
(
    SERVICE_REQUEST_HEADER_ID
);


CREATE INDEX IX_HDR_CONTRACT
ON #HDR
(
    E_Contract_ID
);


/* ============================================================
   3. PROCESS ORDER HEADERS

   ONLY CONTRACTS RELATED TO FERTILIZER REQUESTS
   ============================================================ */

SELECT DISTINCT

     PO.Process_Order_Header_ID
    ,PO.E_Contract_ID

INTO #POH

FROM MD_PROCESS_ORDER_HEADER PO

INNER JOIN
(
    SELECT DISTINCT E_Contract_ID
    FROM #HDR
    WHERE E_Contract_ID IS NOT NULL
) H

    ON PO.E_Contract_ID =
       H.E_Contract_ID;


CREATE CLUSTERED INDEX IX_POH
ON #POH
(
    Process_Order_Header_ID
);


CREATE INDEX IX_POH_CONTRACT
ON #POH
(
    E_Contract_ID
);


/* ============================================================
   4. PROCESS ORDER MATERIAL

   IMPORTANT:
   REDUCE THE LARGE TABLE USING ONLY:
   - REQUIRED PROCESS ORDERS
   - REQUIRED FERTILIZER ITEMS
   ============================================================ */

SELECT DISTINCT

     P.Process_Order_Header_ID
    ,P.Item_ID
    ,P.Process_Order_Material_ID

INTO #POM

FROM DT_PROCESS_ORDER_MATERIAL P

INNER JOIN #POH H

    ON P.Process_Order_Header_ID =
       H.Process_Order_Header_ID

WHERE EXISTS
(
    SELECT 1
    FROM #FERT F
    WHERE F.Item_ID = P.Item_ID
);


CREATE CLUSTERED INDEX IX_POM
ON #POM
(
    Process_Order_Header_ID,
    Item_ID
);


CREATE INDEX IX_POM_MATERIAL
ON #POM
(
    Process_Order_Material_ID
);


/* ============================================================
   5. PRE-AGGREGATE PGI

   IMPORTANT:
   DELIVERY IS CALCULATED ONCE PER
   PROCESS_ORDER_MATERIAL_ID

   BEFORE JOINING TO REQUESTS.
   ============================================================ */

SELECT

     P.Process_Order_Material_ID

    ,COUNT(DISTINCT P.GoodsID)
        AS No_of_PGIs

    ,SUM(
        COALESCE(
            TRY_CONVERT(
                DECIMAL(18,2),
                P.Delivered_Qty
            ),
            0
        )
     ) AS Qty_Delivered

    ,SUM(
        COALESCE(
            TRY_CONVERT(
                DECIMAL(18,2),
                P.Allocated_Qty
            ),
            0
        )
     ) AS Qty_Allocated

INTO #PGI

FROM DT_GoodsIssue_PO P

INNER JOIN
(
    SELECT DISTINCT Process_Order_Material_ID
    FROM #POM
) M

    ON P.Process_Order_Material_ID =
       M.Process_Order_Material_ID

WHERE
    P.CreatedON >= '20260101'

GROUP BY

    P.Process_Order_Material_ID;


CREATE CLUSTERED INDEX IX_PGI
ON #PGI
(
    Process_Order_Material_ID
);


/* ============================================================
   6. CROP / CONTRACT DATA

   DEDUPLICATED BEFORE JOIN
   ============================================================ */

SELECT

     LeadOpportunity_ID

    ,MAX(Current_Crop_Cycle)
        AS Current_Crop_Cycle

    ,MAX(Planned_Date_Of_PC_Ratoon)
        AS Planned_Date_Of_PC_Ratoon

    ,MAX(Actual_Date_Of_Plant_Ratoon)
        AS Actual_Date_Of_Plant_Ratoon

    ,MAX(Contract_Number)
        AS Contract_Number

    ,MAX(Is_Synch)
        AS Is_Synch

    ,MAX(Is_Company)
        AS Is_Company

INTO #VW2

FROM VW_BP_LOC_ATTR_NEW

GROUP BY

    LeadOpportunity_ID;


CREATE UNIQUE CLUSTERED INDEX IX_VW2
ON #VW2
(
    LeadOpportunity_ID
);


/* ============================================================
   7. BUILD BASE

   PROCESS ORDER + PGI IS PRE-AGGREGATED PER:
   CONTRACT + ITEM

   THIS PREVENTS ROW MULTIPLICATION.
   ============================================================ */

SELECT

     H.E_Contract_ID
    ,F.SERVICE_REQUEST_HEADER_ID
    ,F.Item_ID
    ,F.Request_Created_On

    ,H.Field_Number
    ,H.Lead_no

    ,H.ID_Number


    /* OVERLAP */

    ,CASE

        WHEN D.Is_overlaped = 0
            THEN 'NO OVERLAP'

        WHEN D.Is_overlaped = 1
            THEN 'FULL OVERLAP'

        WHEN D.Is_overlaped = -1
            THEN 'INITIAL'

        WHEN D.Is_overlaped = 2
            THEN 'PARTIAL OVERLAP'

        ELSE 'UNKNOWN'

     END AS OVERLAP


    /* IPRS */

    ,CASE

        WHEN C.Is_Verified = 2
            THEN 'IPRS ERROR'

        WHEN C.Is_Verified = 1
            THEN 'VERIFIED'

        WHEN C.Is_Verified = 0
            THEN 'COMPANY'

        ELSE 'UNKNOWN'

     END AS IPRS


    ,C.First_Name

    ,MM.Description


    /* REQUEST QUANTITIES - ORIGINAL VALUES */

    ,F.Qty_Requested
    ,F.Qty_Agri
    ,F.Qty_Fin


    /* AREA */

    ,TRY_CONVERT(
        DECIMAL(18,4),
        E.Measured_Cane_Area
     ) AS Measured_Cane_Area


    /* PROCESS ORDER INFORMATION */

    ,ISNULL(PO.No_of_Process_Order_Materials, 0)
        AS No_of_Process_Order_Materials

    ,ISNULL(PO.Qty_Allocated, 0)
        AS Qty_Allocated

    ,ISNULL(PO.Qty_Delivered, 0)
        AS Qty_Delivered

    ,ISNULL(PO.No_of_PGIs, 0)
        AS No_of_PGIs


    /* LOCATION */

    ,VW.Region_Name
    ,VW.Zone_Name
    ,VW.Section_Name
    ,VW.SubLocation
    ,VW.PlantName2 AS Unit_name
    ,VW.Village_Name


    /* CROP DATA */

    ,VW2.Current_Crop_Cycle
    ,VW2.Planned_Date_Of_PC_Ratoon
    ,VW2.Actual_Date_Of_Plant_Ratoon
    ,VW2.Contract_Number
    ,VW2.Is_Synch
    ,VW2.Is_Company


INTO #BASE

FROM #FERT F

INNER JOIN #HDR H

    ON F.SERVICE_REQUEST_HEADER_ID =
       H.SERVICE_REQUEST_HEADER_ID


INNER JOIN MD_BUS_PARTNER_MASTER C

    ON H.ID_Number =
       C.ID_Number


INNER JOIN DT_BUS_PARTNER_LOCATION_ATTRIBUTES D

    ON H.Lead_no =
       D.LeadOpportunity_ID


INNER JOIN DT_BUS_PARTNER_Land_ATTRIBUTES E

    ON H.Lead_no =
       E.LeadOpportunity_ID


LEFT JOIN MD_MATERIAL_MASTER MM

    ON F.Item_ID =
       MM.Material_Master_ID


LEFT JOIN vW_Village_Related_Data VW

    ON D.village_id =
       VW.Village_ID


LEFT JOIN #VW2 VW2

    ON H.Lead_no =
       VW2.LeadOpportunity_ID


/* ============================================================
   PROCESS ORDER + DELIVERY AGGREGATED PER CONTRACT + ITEM
   ============================================================ */

OUTER APPLY
(
    SELECT

         COUNT(DISTINCT PM.Process_Order_Material_ID)
            AS No_of_Process_Order_Materials

        ,MAX(
            COALESCE(PG.Qty_Allocated, 0)
         ) AS Qty_Allocated

        ,MAX(
            COALESCE(PG.Qty_Delivered, 0)
         ) AS Qty_Delivered

        ,MAX(
            COALESCE(PG.No_of_PGIs, 0)
         ) AS No_of_PGIs


    FROM #POH PH

    INNER JOIN #POM PM

        ON PH.Process_Order_Header_ID =
           PM.Process_Order_Header_ID

    LEFT JOIN #PGI PG

        ON PM.Process_Order_Material_ID =
           PG.Process_Order_Material_ID

    WHERE
        PH.E_Contract_ID = H.E_Contract_ID

        AND PM.Item_ID = F.Item_ID

) PO;


"""


FINAL_SQL = r"""/* ============================================================
   8. FINAL OUTPUT

   NO GROUP BY REQUIRED

   ONE ROW = ONE REQUEST LINE
   ============================================================ */

SELECT

     B.SERVICE_REQUEST_HEADER_ID
    ,B.Item_ID
    ,B.Request_Created_On

    ,B.Field_Number
    ,B.ID_Number
    ,B.First_Name

    ,B.OVERLAP
    ,B.IPRS

    ,B.Description


    /* ========================================================
       FERTILIZER TYPE
       ======================================================== */

    ,CASE

        WHEN B.Description IN
        (
             'TSP FERTILIZER 50KG'
            ,'MAVUNOPLANTING FERT 50KG'
        )

        THEN 'PLANTING FERTILIZER'


        WHEN B.Description IN
        (
             'ELGON THABITI TOP DRESSING 50KG'
            ,'MAVUNO TOP DRESSING FERT 50KG'
        )

        THEN 'TOP DRESSING'


        ELSE 'OTHER'

     END AS Fertilizer_Type


    /* ========================================================
       LOCATION
       ======================================================== */

    ,B.Region_Name

    ,CASE

        WHEN B.Region_Name = 'KABRAS CENTRAL'
        THEN
            CASE

                WHEN B.Zone_Name IN
                (
                     'CENTRAL ZONE-B'
                    ,'EASTERN ZONE'
                )

                THEN 'KABRAS B'

                ELSE 'KABRAS A'

            END


        WHEN B.Region_Name IN
        (
             'MISIKHU'
            ,'NAITIRI'
            ,'KITALE'
            ,'BUSIA'
            ,'NZOIA'
            ,'MAGUT'
            ,'BUTERE'
        )

        THEN B.Region_Name


        WHEN B.Region_Name IN
        (
             'MOI UNIVERSITY'
            ,'TURBO'
        )

        THEN 'SELIA'


        WHEN B.Region_Name IN
        (
             'DOROFU'
            ,'DOROFU KHALABA'
        )

        THEN 'KHALABA'


        WHEN B.Region_Name IN
        (
             'KABRAS WEST'
            ,'KABRAS NORTH'
        )

        THEN 'KABRAS A'


        WHEN B.Region_Name IN
        (
             'KAKAMEGA'
            ,'BUKURA'
            ,'KABRAS SOUTH'
            ,'KAIMOSI'
            ,'KABRAS'
        )

        THEN 'KABRAS B'


        WHEN B.Region_Name = 'SIAYA'
        THEN 'LAKE AGRO'


        WHEN B.Region_Name IN
        (
             'MIWANI'
            ,'KERICHO'
            ,'CHEMELIL'
        )

        THEN 'NYANDO'


        WHEN B.Region_Name = 'Eastern'
        THEN 'Eastern'


        WHEN B.Region_Name = 'Northern'
        THEN 'Northern'


        WHEN B.Region_Name = 'Southern'
        THEN 'Southern'


        WHEN B.Region_Name = 'Western'
        THEN 'Western'


        WHEN B.Region_Name = 'Central'
        THEN 'Nzoia Nucleus'


        ELSE 'NOT MAPPED'

     END AS Sector_Name


    ,B.Section_Name
    ,B.Zone_Name
    ,B.SubLocation
    ,B.Unit_name
    ,B.Village_Name


    /* ========================================================
       APPROVAL STATUS
       ======================================================== */

    ,CASE

        WHEN COALESCE(B.Qty_Fin, 0) > 0
            THEN 'Finance Approved'

        WHEN COALESCE(B.Qty_Agri, 0) > 0
             AND COALESCE(B.Qty_Fin, 0) <= 0
            THEN 'Pending Finance Approval'

        ELSE 'Pending Agriculture Approval'

     END AS Approval_Status


    /* ========================================================
       AREA & STANDARD QUANTITY
       ======================================================== */

    ,B.Measured_Cane_Area

    ,ROUND(
        COALESCE(B.Measured_Cane_Area, 0) * 2,
        0
     ) AS Standard_Fertilizer_Qty


    /* ========================================================
       PROCESS ORDER
       ======================================================== */

    ,B.No_of_Process_Order_Materials


    /* ========================================================
       REQUEST QUANTITIES

       IMPORTANT: NOT SUMMED
       ======================================================== */

    ,B.Qty_Requested
    ,B.Qty_Agri
    ,B.Qty_Fin


    /* ========================================================
       DELIVERY
       ======================================================== */

    ,B.Qty_Allocated
    ,B.Qty_Delivered
    ,B.No_of_PGIs


    /* ========================================================
       PENDING QUANTITY
       ======================================================== */

    ,CASE

        WHEN
            COALESCE(B.Qty_Requested, 0)
            -
            COALESCE(B.Qty_Delivered, 0)
            < 0

        THEN 0

        ELSE

            COALESCE(B.Qty_Requested, 0)
            -
            COALESCE(B.Qty_Delivered, 0)

     END AS Qty_Pending


    /* ========================================================
       ISSUANCE STATUS
       ======================================================== */

    ,CASE

        WHEN COALESCE(B.Qty_Delivered, 0) > 0
            THEN 'ALREADY ISSUED'

        ELSE 'NOT ISSUED'

     END AS Issuance_Status


    /* ========================================================
       AGE IN MONTHS
       ======================================================== */

    ,CASE

        WHEN B.Actual_Date_Of_Plant_Ratoon IS NULL
            THEN NULL

        ELSE CAST
        (
            DATEDIFF
            (
                DAY,
                B.Actual_Date_Of_Plant_Ratoon,
                CAST(GETDATE() AS DATE)
            ) / 30.44

            AS DECIMAL(10,2)
        )

     END AS Age_Months


    /* ========================================================
       REQUEST AGEING
       ======================================================== */

    ,DATEDIFF
    (
        DAY,
        B.Request_Created_On,
        GETDATE()
     ) AS Ageing_Days


    /* ========================================================
       CROP / CONTRACT
       ======================================================== */

    ,B.Current_Crop_Cycle
    ,B.Planned_Date_Of_PC_Ratoon
    ,B.Actual_Date_Of_Plant_Ratoon
    ,B.Contract_Number
    ,B.Is_Synch
    ,B.Is_Company


    /* ========================================================
       FERTILIZER ISSUANCE FLAG
       ======================================================== */

    ,CASE

        /* 1. OVERLAP */

        WHEN B.OVERLAP = 'INITIAL'
            THEN 'REJECTED'

        WHEN B.OVERLAP = 'FULL OVERLAP'
            THEN 'REJECTED'

        WHEN B.OVERLAP = 'UNKNOWN'
            THEN 'REJECTED'

        WHEN B.OVERLAP NOT IN
        (
             'NO OVERLAP'
            ,'PARTIAL OVERLAP'
        )

            THEN 'REJECTED'


        /* 2. IPRS */

        WHEN B.IPRS NOT IN
        (
             'VERIFIED'
            ,'COMPANY'
        )

            THEN 'REJECTED'


        /* 3. FERTILIZER */

        WHEN B.Description NOT IN
        (
             'TSP FERTILIZER 50KG'
            ,'MAVUNOPLANTING FERT 50KG'
            ,'ELGON THABITI TOP DRESSING 50KG'
            ,'MAVUNO TOP DRESSING FERT 50KG'
        )

            THEN 'REJECTED'


        /* 4. CROP CYCLE */

        WHEN B.Current_Crop_Cycle NOT IN
        (
             'PLANT CROP'
            ,'RATOON 1'
            ,'RATOON 2'
        )

            THEN 'REJECTED'


        /* 5. DATE */

        WHEN B.Actual_Date_Of_Plant_Ratoon IS NULL
            THEN 'REJECTED'


        /* 6. PLANTING FERTILIZER - MAX 3 MONTHS */

        WHEN B.Description IN
        (
             'TSP FERTILIZER 50KG'
            ,'MAVUNOPLANTING FERT 50KG'
        )

        AND B.Actual_Date_Of_Plant_Ratoon <
            DATEADD
            (
                MONTH,
                -3,
                CAST(GETDATE() AS DATE)
            )

            THEN 'REJECTED'


        /* 7. TOP DRESSING - MAX 9 MONTHS */

        WHEN B.Description IN
        (
             'ELGON THABITI TOP DRESSING 50KG'
            ,'MAVUNO TOP DRESSING FERT 50KG'
        )

        AND B.Actual_Date_Of_Plant_Ratoon <
            DATEADD
            (
                MONTH,
                -9,
                CAST(GETDATE() AS DATE)
            )

            THEN 'REJECTED'


        /* 8. FINANCE APPROVAL */

        WHEN COALESCE(B.Qty_Fin, 0) <= 0
            THEN 'REJECTED'


        /* 9. ALREADY ISSUED */

        WHEN COALESCE(B.Qty_Delivered, 0) > 0
            THEN 'REJECTED'


        /* 10. QUANTITY EXCEEDS STANDARD */

        WHEN COALESCE(B.Qty_Fin, 0) >

            ROUND
            (
                COALESCE(
                    B.Measured_Cane_Area,
                    0
                ) * 2,
                0
            )

            THEN 'REJECTED'


        /* ALL VALID */

        ELSE 'ISSUE'

     END AS Fertilizer_Issuance_Flag


    /* ========================================================
       FERTILIZER ISSUANCE REMARKS
       ======================================================== */

    ,CASE

        WHEN B.OVERLAP = 'INITIAL'
            THEN 'Overlap Check Not Done'

        WHEN B.OVERLAP = 'FULL OVERLAP'
            THEN 'Full Overlap Detected'

        WHEN B.OVERLAP = 'UNKNOWN'
            THEN 'Overlap Status Unknown'

        WHEN B.OVERLAP NOT IN
        (
             'NO OVERLAP'
            ,'PARTIAL OVERLAP'
        )

            THEN 'Invalid Overlap'


        WHEN B.IPRS NOT IN
        (
             'VERIFIED'
            ,'COMPANY'
        )

            THEN 'IPRS Not Verified'


        WHEN B.Description NOT IN
        (
             'TSP FERTILIZER 50KG'
            ,'MAVUNOPLANTING FERT 50KG'
            ,'ELGON THABITI TOP DRESSING 50KG'
            ,'MAVUNO TOP DRESSING FERT 50KG'
        )

            THEN 'Invalid Fertilizer Type'


        WHEN B.Current_Crop_Cycle NOT IN
        (
             'PLANT CROP'
            ,'RATOON 1'
            ,'RATOON 2'
        )

            THEN 'Invalid Crop Cycle'


        WHEN B.Actual_Date_Of_Plant_Ratoon IS NULL
            THEN 'Planting/Ratoon Date Missing'


        WHEN B.Description IN
        (
             'TSP FERTILIZER 50KG'
            ,'MAVUNOPLANTING FERT 50KG'
        )

        AND B.Actual_Date_Of_Plant_Ratoon <
            DATEADD
            (
                MONTH,
                -3,
                CAST(GETDATE() AS DATE)
            )

            THEN 'Planting Fertilizer Age Exceeds 3 Months'


        WHEN B.Description IN
        (
             'ELGON THABITI TOP DRESSING 50KG'
            ,'MAVUNO TOP DRESSING FERT 50KG'
        )

        AND B.Actual_Date_Of_Plant_Ratoon <
            DATEADD
            (
                MONTH,
                -9,
                CAST(GETDATE() AS DATE)
            )

            THEN 'Top Dressing Age Exceeds 9 Months'


        WHEN COALESCE(B.Qty_Fin, 0) <= 0
            THEN 'Finance Approval Missing'


        WHEN COALESCE(B.Qty_Delivered, 0) > 0
            THEN 'Fertilizer Already Issued'


        WHEN COALESCE(B.Qty_Fin, 0) >

            ROUND
            (
                COALESCE(
                    B.Measured_Cane_Area,
                    0
                ) * 2,
                0
            )

            THEN 'Finance Quantity Exceeds Standard Requirement'


        ELSE 'Eligible for Fertilizer Issuance'

     END AS Fertilizer_Issuance_Remarks


/* ============================================================
   FINAL ORDER
   ============================================================ */

FROM #BASE B


--WHERE B.Field_Number in ('FN-1917103','fn-1362339')


ORDER BY

     B.Region_Name
    ,B.Field_Number
    ,B.Request_Created_On
    ,B.SERVICE_REQUEST_HEADER_ID


OPTION (RECOMPILE);"""


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
        print("building fertilizer quality-check temp tables...")

        cursor = conn.cursor()
        cursor.execute(BUILD_SQL)
        cursor.close()

        print("running fertilizer issuance validation...")

        df = pd.read_sql(FINAL_SQL, conn)

    df.to_parquet(OUTPUT_PATH, index=False)

    print(f"wrote {len(df):,} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
