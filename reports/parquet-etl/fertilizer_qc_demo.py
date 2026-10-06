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

    print("\n--- Filtering: records marked ISSUE ---")
    issue = data[
        data["Fertilizer_Issuance_Flag"] == "ISSUE"
    ]
    print(issue.to_string(index=False))

    print("\n--- Filtering: rejected records ---")
    rejected = data[
        data["Fertilizer_Issuance_Flag"] == "REJECTED"
    ]
    print(rejected.to_string(index=False))

    print("\n--- Filtering: finance approved but not issued ---")
    finance_ready = data[
        (data["Approval_Status"] == "Finance Approved")
        & (data["Issuance_Status"] == "NOT ISSUED")
    ]
    print(finance_ready.to_string(index=False))

    print("\n--- QC flag counts ---")
    print(
        data["Fertilizer_Issuance_Flag"]
        .value_counts(dropna=False)
        .to_string()
    )


if __name__ == "__main__":
    main()
