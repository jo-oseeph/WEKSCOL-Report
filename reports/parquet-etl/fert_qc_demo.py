"""
Reads fertilizer_issuance_validation.parquet with DuckDB.

Demo purpose:
- Demonstrate filtering the QC results
- Keep this separate from the full extraction script
"""

from pathlib import Path

import duckdb


PARQUET_PATH = (
    Path(__file__).resolve().parent
    / "data"
    / "fertilizer_issuance_validation.parquet"
)


DEMO_SQL = """
SELECT
    Contract_Number,
    Field_Number,
    ID_Number,
    First_Name,
    OVERLAP,
    IPRS,
    Description,
    Unit_name,
    Sector_Name,
    Zone_Name,
    Section_Name,
    SubLocation,
    Village_Name,
    Measured_Cane_Area,
    Qty_Requested,
    Qty_Agri,
    Qty_Fin,
    Qty_Delivered,
    Issuance_Status,
    Age_Months,
    Current_Crop_Cycle,
    Actual_Date_Of_Plant_Ratoon,
    Fertilizer_Issuance_Flag,
    Fertilizer_Issuance_Remarks,
    Request_Created_On
FROM read_parquet(?)
"""


def main():
    if not PARQUET_PATH.exists():
        raise SystemExit(
            f"{PARQUET_PATH} not found - run fertilizer_qc.py first"
        )

    con = duckdb.connect()

    data = con.execute(
        DEMO_SQL,
        [str(PARQUET_PATH)]
    ).df()

    print(f"Loaded {len(data)} rows for the demo")

    print("\n--- First 5 QC records ---")
    print(data.head(5).to_string(index=False))

if __name__ == "__main__":
    main()
