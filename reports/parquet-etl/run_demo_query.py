"""
Reads report_base.parquet with DuckDB and runs the fertilizer_approval
test query against it. This is just to prove the parquet file is
queryable and fast - it does NOT touch SQL Server.
"""

from pathlib import Path
import duckdb

PARQUET_PATH = Path(__file__).parent / "data" / "report_base.parquet"

DEMO_SQL = """
SELECT
       Field_Number
      ,OVERLAP
      ,ID_Number
      ,IPRS
      ,First_Name
      ,Description
      ,Region_Name
      ,Sector_Name
      ,Zone_Name
      ,Section_Name
      ,SubLocation
      ,Unit_name
      ,Village_Name
      ,"Approval Status"
      ,Measured_Cane_Area
      ,No_of_SR
      ,Qty_Requested
      ,Qty_Agri
      ,Qty_Fin
      ,Qty_Allocated
      ,Qty_Delivered
      ,NO_OF_PGIs
      ,Qty_Pending
      ,Ageing_Days
      ,Min_Created_On
      ,Max_Created_On
      ,Current_Crop_Cycle
      ,Planned_Date_Of_PC_Ratoon
      ,Actual_Date_Of_Plant_Ratoon
      ,Contract_Number
      ,Is_Synch
      ,Is_Company
FROM read_parquet(?)
WHERE (Description LIKE '%TSP FERTILIZER 50KG%' OR Description LIKE '%ELGON THABITI TOP DRESSING 50KG%' OR Description LIKE '%MAVUNO TOP DRESSING FERT 50KG%')  
  AND Qty_Agri IS NOT NULL
  AND Qty_Fin IS NOT NULL
  AND Qty_Agri = Qty_Fin
  AND Qty_Agri > 0
ORDER BY Region_Name, Sector_Name, Field_Number, NO_OF_PGIs
LIMIT 1000
"""


def main():
    if not PARQUET_PATH.exists():
        raise SystemExit(f"{PARQUET_PATH} not found - run extract_to_parquet.py first")

    con = duckdb.connect()
    result = con.execute(DEMO_SQL, [str(PARQUET_PATH)]).df()

    print(f"{len(result)} rows returned")
    print(result.head(20).to_string())

    out_csv = Path(__file__).parent / "data" / "demo_fertilizer_approval.csv"
    result.to_csv(out_csv, index=False)
    print(f"full result saved to {out_csv}")


if __name__ == "__main__":
    main()
