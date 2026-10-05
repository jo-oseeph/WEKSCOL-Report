"""
Reads report_base.parquet with DuckDB and runs the fertilizer_pending_agriculture_approval
test query against it.

The demo returns:
1. Top 5 detailed pending agriculture approval records
2. Summary by Unit, Sector, Zone and Section

This does NOT touch SQL Server.
"""

from pathlib import Path

import duckdb
import pandas as pd


# Repository root -> reports/parquet-etl/data/report_base.parquet
PARQUET_PATH = (
    Path(__file__).resolve().parents[2]
    / "reports"
    / "parquet-etl"
    / "data"
    / "report_base.parquet"
)


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
      ,Measured_Cane_Area
      ,Qty_Requested
      ,Qty_Agri
      ,Qty_Fin
      ,Qty_Allocated
      ,Qty_Delivered
      ,Qty_Pending
      ,Ageing_Days
      ,Max_Created_On
      ,Current_Crop_Cycle
      ,Actual_Date_Of_Plant_Ratoon
      ,Contract_Number
FROM read_parquet(?)
WHERE (
       Description LIKE '%TSP FERTILIZER 50KG%'
    OR Description LIKE '%ELGON THABITI TOP DRESSING 50KG%'
    OR Description LIKE '%MAVUNO TOP DRESSING FERT 50KG%'
)
AND (
       Qty_Agri IS NULL
    OR Qty_Agri = 0
)
ORDER BY
       Region_Name
      ,Sector_Name
      ,Field_Number
"""


def location_summary(data, group_cols, service_type):

    data = data.copy()

    # Ensure numeric fields are actually numeric
    data['Measured_Cane_Area'] = pd.to_numeric(
        data['Measured_Cane_Area'],
        errors='coerce'
    )

    data['Qty_Requested'] = pd.to_numeric(
        data['Qty_Requested'],
        errors='coerce'
    )

    # One record per field within each location
    fields = data.drop_duplicates(
        subset=group_cols + ['Field_Number']
    )

    summary = (
        fields.groupby(group_cols)
        .agg(
            Total_Fields=('Field_Number', 'nunique'),
            Total_Acreage=('Measured_Cane_Area', 'sum')
        )
        .reset_index()
    )

    # Quantity is reported from the request records
    quantity = (
        data.groupby(group_cols)['Qty_Requested']
        .sum()
        .reset_index(
            name='Quantity_Bags'
            if service_type == 'Fertilizer'
            else 'Quantity_Tonnes'
        )
    )

    summary = summary.merge(
        quantity,
        on=group_cols,
        how='left'
    )

    return summary


def main():

    if not PARQUET_PATH.exists():
        raise SystemExit(
            f"{PARQUET_PATH} not found - run extract_to_parquet.py first"
        )

    con = duckdb.connect()

    fertilizer_pending_agriculture_approval = con.execute(
        DEMO_SQL,
        [str(PARQUET_PATH)]
    ).df()

    # Detailed report
    print(
        f"\n{len(fertilizer_pending_agriculture_approval)} "
        "pending agriculture approval rows returned"
    )

    print("\n--- Detailed report: top 5 rows ---")
    print(
        fertilizer_pending_agriculture_approval
        .head(5)
        .to_string(index=False)
    )

    # Summary through Section
    fertilizer_pending_agric_approval_summary = location_summary(
        fertilizer_pending_agriculture_approval,
        ['Unit_name', 'Sector_Name', 'Zone_Name', 'Section_Name'],
        'Fertilizer'
    )

    print("\n--- Summary: Unit > Sector > Zone > Section ---")
    print(
        fertilizer_pending_agric_approval_summary
        .to_string(index=False)
    )


if __name__ == "__main__":
    main()
