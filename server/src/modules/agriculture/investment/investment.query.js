import { executeWarehouseQuery } from "../../../db/warehouseDb/connection.js";

// These constants are copied from notebook cell 44: overdue means older than
// three years and the blocking amount threshold is strictly greater than $10,000.
export const OVERDUE_YEARS = 3;
export const OVERDUE_AMOUNT_THRESHOLD = 10000;
const GROUP_COLUMNS = {
  unit: ["Unit"],
  sector: ["Unit", "Sector_Name"],
  zone: ["Unit", "Sector_Name", "Zone_Name"],
  section: ["Unit", "Sector_Name", "Zone_Name", "Section_Name"],
};
const SECTOR = `CASE WHEN B.Region_Name = 'KABRAS CENTRAL' THEN CASE WHEN B.Zone_Name IN ('CENTRAL ZONE-B','EASTERN ZONE') THEN 'KABRAS B' ELSE 'KABRAS A' END WHEN B.Region_Name IN ('MISIKHU','NAITIRI','KITALE','BUSIA','NZOIA','MAGUT','BUTERE') THEN B.Region_Name WHEN B.Region_Name IN ('MOI UNIVERSITY','TURBO') THEN 'SELIA' WHEN B.Region_Name IN ('DOROFU','DOROFU KHALABA') THEN 'KHALABA' WHEN B.Region_Name IN ('KABRAS WEST','KABRAS NORTH') THEN 'KABRAS A' WHEN B.Region_Name IN ('KAKAMEGA','BUKURA','KABRAS SOUTH','KAIMOSI','KABRAS') THEN 'KABRAS B' WHEN B.Region_Name = 'SIAYA' THEN 'LAKE AGRO' WHEN B.Region_Name IN ('MIWANI','KERICHO','CHEMELIL') THEN 'NYANDO' WHEN B.Region_Name IN ('Eastern','Northern','Southern','Western') THEN B.Region_Name WHEN B.Region_Name = 'Central' THEN 'Nzoia Nucleus' ELSE 'NOT MAPPED' END`;

function investmentRowsSql() {
  // Cell 44 used Vendor/Amount/Clearing from a CSV export. The live warehouse
  // stores the same investment ledger in material/service tables instead:
  // Actual_cost is Amount, Posting_Date/DN_Date are transaction dates, and
  // Is_SAP_Sync/IsSapPosted are the available posted-status indicators.
  return `SELECT field_no, Actual_cost AS amount, COALESCE(Posting_Date, DN_Date) AS transaction_date,
    CASE WHEN ISNULL(Is_SAP_Sync, 0) = 0 OR ISNULL(IsSapPosted, 0) = 0 THEN 1 ELSE 0 END AS is_pending
    FROM dbo.DT_INVESTMENT_MATERIAL
    UNION ALL
    SELECT field_no, Actual_cost AS amount, COALESCE(Posting_Date, DN_Date) AS transaction_date,
    CASE WHEN ISNULL(Is_SAP_Sync, 0) = 0 OR ISNULL(IsSapPosted, 0) = 0 THEN 1 ELSE 0 END AS is_pending
    FROM dbo.DT_INVESTMENT_SERVICE`;
}

function detailedSelect() {
  return `SELECT B.Field_Number,B.OVERLAP,B.ID_Number,B.IPRS,B.First_Name,B.Description,B.Region_Name,${SECTOR} AS Sector_Name,B.Zone_Name,B.Section_Name,B.SubLocation,B.Unit_name AS Unit,B.Village_Name,CASE WHEN B.Qty_Fin > 0 THEN 'Finance Approved' WHEN B.Qty_Agri > 0 AND B.Qty_Fin = 0 THEN 'Pending Finance Approval' WHEN B.Qty_Agri = 0 THEN 'Pending Agriculture Approval' ELSE 'Pending' END AS [Approval Status],B.Measured_Cane_Area,1 AS No_of_SR,B.Qty_Requested,B.Qty_Agri,B.Qty_Fin,P.Qty_Allocated,P.Qty_Delivered,P.NO_OF_PGIs,B.Qty_Requested-ISNULL(P.Qty_Delivered,0) AS Qty_Pending,DATEDIFF(DAY,B.Created_On,GETDATE()) AS Ageing_Days,B.Created_On AS Min_Created_On,B.Created_On AS Max_Created_On,B.Current_Crop_Cycle,B.Planned_Date_Of_PC_Ratoon,B.Actual_Date_Of_Plant_Ratoon,B.Contract_Number,B.Is_Synch,B.Is_Company,COALESCE(I.Total_Investment,0) AS Total_Investment,COALESCE(I.CIR_Pending,0) AS CIR_Pending,COALESCE(I.Overdue_Amount,0) AS Overdue_Amount,COALESCE(I.Investment_Flag,'Not Overdue') AS Investment_Flag,NULL AS Farmer_Name,CASE WHEN COALESCE(I.Investment_Flag,'Not Overdue')='Overdue' AND COALESCE(I.Overdue_Amount,0)>${OVERDUE_AMOUNT_THRESHOLD} THEN 'Don''t Issue' WHEN COALESCE(I.Investment_Flag,'Not Overdue')='Not Overdue' AND COALESCE(I.Overdue_Amount,0)=0 THEN 'Issue' ELSE 'Issue with Precaution' END AS CC_Remarks,CASE WHEN B.Description LIKE '%SEED CANE%' THEN 'Seed Cane' WHEN B.Description LIKE '%MILL CANE%' THEN 'Mill Cane' ELSE 'Other' END AS Cane_Type
  FROM #BASE B LEFT JOIN #PGI P ON B.Process_Order_Material_ID=P.Process_Order_Material_ID LEFT JOIN #INV I ON LTRIM(RTRIM(B.Field_Number))=LTRIM(RTRIM(I.field_no))`;
}
function predicates(clauses, joiner = "WHERE") {
  return clauses.length ? `${joiner} ${clauses.join(" AND ")}` : "";
}
function batch(finalSql) {
  return `DROP TABLE IF EXISTS #FERT;DROP TABLE IF EXISTS #HDR;DROP TABLE IF EXISTS #POH;DROP TABLE IF EXISTS #POM;DROP TABLE IF EXISTS #BASE;DROP TABLE IF EXISTS #PGI;DROP TABLE IF EXISTS #VW2;DROP TABLE IF EXISTS #INV;
SELECT A.SERVICE_REQUEST_HEADER_ID,A.Item_ID,A.Qty,A.AgricultureApprovedQty,A.FinanceApprovedQty,A.Created_On INTO #FERT FROM DT_SERVICE_REQUEST_MATERIAL A WHERE A.Created_On >= '20250101' AND A.Is_Active=1 AND A.Item_Description LIKE '%SEED%' AND A.Created_On >= COALESCE(@dateFrom,A.Created_On) AND A.Created_On < COALESCE(DATEADD(DAY,1,@dateTo),DATEADD(DAY,1,A.Created_On));
CREATE CLUSTERED INDEX IX_FERT_HEADER ON #FERT (SERVICE_REQUEST_HEADER_ID); CREATE INDEX IX_FERT_ITEM ON #FERT (Item_ID);
SELECT MH.SERVICE_REQUEST_HEADER_ID,MH.ID_Number,MH.Field_Number,REPLACE(MH.Field_Number,'FN-','') AS Lead_no,MH.E_Contract_ID INTO #HDR FROM MD_SERVICE_REQUEST_HEADER MH INNER JOIN (SELECT DISTINCT SERVICE_REQUEST_HEADER_ID FROM #FERT) F ON MH.SERVICE_REQUEST_HEADER_ID=F.SERVICE_REQUEST_HEADER_ID;
CREATE CLUSTERED INDEX IX_HDR_HEADER ON #HDR (SERVICE_REQUEST_HEADER_ID); CREATE INDEX IX_HDR_LEAD ON #HDR (Lead_no); CREATE INDEX IX_HDR_CONTRACT ON #HDR (E_Contract_ID);
SELECT DISTINCT F.Process_Order_Header_ID,F.E_Contract_ID INTO #POH FROM MD_PROCESS_ORDER_HEADER F INNER JOIN (SELECT DISTINCT E_Contract_ID FROM #HDR WHERE E_Contract_ID IS NOT NULL) H ON F.E_Contract_ID=H.E_Contract_ID;
CREATE CLUSTERED INDEX IX_POH_HEADER ON #POH (Process_Order_Header_ID); CREATE INDEX IX_POH_CONTRACT ON #POH (E_Contract_ID);
SELECT G.Process_Order_Header_ID,G.Item_ID,G.Process_Order_Material_ID INTO #POM FROM DT_PROCESS_ORDER_MATERIAL G INNER JOIN #POH F ON G.Process_Order_Header_ID=F.Process_Order_Header_ID INNER JOIN (SELECT DISTINCT Item_ID FROM #FERT) I ON G.Item_ID=I.Item_ID;
CREATE CLUSTERED INDEX IX_POM_HEADER_ITEM ON #POM (Process_Order_Header_ID,Item_ID); CREATE INDEX IX_POM_ID ON #POM (Process_Order_Material_ID);
SELECT DISTINCT LeadOpportunity_ID,Current_Crop_Cycle,Planned_Date_Of_PC_Ratoon,Actual_Date_Of_Plant_Ratoon,Contract_Number,Is_Synch,Is_Company INTO #VW2 FROM VW_BP_LOC_ATTR_NEW;
CREATE INDEX IX_VW2_LEAD ON #VW2 (LeadOpportunity_ID);
SELECT H.Field_Number,CASE WHEN D.Is_overlaped=0 THEN 'NO OVERLAP' WHEN D.Is_overlaped=1 THEN 'FULL OVERLAP' WHEN D.Is_overlaped=-1 THEN 'INITIAL' WHEN D.Is_overlaped=2 THEN 'PARTIAL OVERLAP' ELSE 'UNKNOWN' END AS OVERLAP,H.ID_Number,CASE WHEN C.Is_Verified=2 THEN 'IPRS ERROR' WHEN C.Is_Verified=1 THEN 'VERIFIED' WHEN C.Is_Verified=0 THEN 'COMPANY' ELSE 'UNKNOWN' END AS IPRS,C.First_Name,MM.Description,F.Qty AS Qty_Requested,F.AgricultureApprovedQty AS Qty_Agri,F.FinanceApprovedQty AS Qty_Fin,E.Measured_Cane_Area,F.Created_On,G.Process_Order_Material_ID,VW.Region_Name,VW.Zone_Name,VW.Section_Name,VW.SubLocation,VW.PlantName2 AS Unit_name,VW.Village_Name,VW2.Current_Crop_Cycle,VW2.Planned_Date_Of_PC_Ratoon,VW2.Actual_Date_Of_Plant_Ratoon,VW2.Contract_Number,VW2.Is_Synch,VW2.Is_Company INTO #BASE FROM #FERT F INNER JOIN #HDR H ON F.SERVICE_REQUEST_HEADER_ID=H.SERVICE_REQUEST_HEADER_ID INNER JOIN MD_BUS_PARTNER_MASTER C ON H.ID_Number=C.ID_Number INNER JOIN DT_BUS_PARTNER_LOCATION_ATTRIBUTES D ON H.Lead_no=D.LeadOpportunity_ID INNER JOIN DT_BUS_PARTNER_Land_ATTRIBUTES E ON H.Lead_no=E.LeadOpportunity_ID LEFT JOIN #POH POH ON H.E_Contract_ID=POH.E_Contract_ID LEFT JOIN #POM G ON POH.Process_Order_Header_ID=G.Process_Order_Header_ID AND F.Item_ID=G.Item_ID LEFT JOIN MD_MATERIAL_MASTER MM ON F.Item_ID=MM.Material_Master_ID LEFT JOIN vW_Village_Related_Data VW ON D.village_id=VW.Village_ID LEFT JOIN #VW2 VW2 ON H.Lead_no=VW2.LeadOpportunity_ID;
CREATE INDEX IX_BASE_POM ON #BASE (Process_Order_Material_ID);
SELECT P.Process_Order_Material_ID,P.GoodsID,P.Delivered_Qty AS Qty_Delivered,P.Allocated_Qty AS Qty_Allocated,1 AS NO_OF_PGIs,P.CreatedON INTO #PGI FROM DT_GoodsIssue_PO P INNER JOIN (SELECT DISTINCT Process_Order_Material_ID FROM #BASE WHERE Process_Order_Material_ID IS NOT NULL) X ON P.Process_Order_Material_ID=X.Process_Order_Material_ID WHERE P.CreatedON >= '20250101';
SELECT field_no,SUM(amount) AS Total_Investment,SUM(CASE WHEN is_pending=1 THEN amount ELSE 0 END) AS CIR_Pending,SUM(CASE WHEN transaction_date < DATEADD(YEAR,-${OVERDUE_YEARS},CAST(GETDATE() AS DATE)) AND is_pending=1 THEN amount ELSE 0 END) AS Overdue_Amount,CASE WHEN MAX(CASE WHEN transaction_date < DATEADD(YEAR,-${OVERDUE_YEARS},CAST(GETDATE() AS DATE)) AND is_pending=1 AND amount>${OVERDUE_AMOUNT_THRESHOLD} THEN 1 ELSE 0 END)=1 THEN 'Overdue' ELSE 'Not Overdue' END AS Investment_Flag INTO #INV FROM (${investmentRowsSql()}) AS investment_source GROUP BY field_no;
${finalSql};`;
}

export async function runInvestmentQuery({
  variant,
  group,
  clauses,
  parameters,
}) {
  const boundParameters = { dateFrom: null, dateTo: null, ...parameters };
  if (variant === "detailed") {
    const detailed = `SELECT * FROM (${detailedSelect()}) AS detailed_result ${predicates(clauses)} ORDER BY Region_Name,Sector_Name,Field_Number`;
    return executeWarehouseQuery(batch(detailed), boundParameters);
  }
  const groups = GROUP_COLUMNS[group];
  const groupSql = groups.map((name) => `[${name}]`).join(",");
  const summary = `SELECT ${groupSql},COUNT(DISTINCT ID_Number) AS Total_Farmers,COUNT(DISTINCT CASE WHEN Investment_Flag IS NOT NULL THEN ID_Number END) AS Farmers_With_Investment,COUNT(DISTINCT CASE WHEN Investment_Flag='Overdue' THEN ID_Number END) AS Farmers_Overdue,SUM(Total_Investment) AS Total_Investment,SUM(CIR_Pending) AS CIR_Pending,SUM(Overdue_Amount) AS Overdue_Amount,(SUM(Total_Investment)-SUM(CIR_Pending))/NULLIF(SUM(Total_Investment),0)*100 AS Recovery_Rate FROM (${detailedSelect()}) source WHERE Cane_Type='Seed Cane' ${predicates(clauses, "AND")} GROUP BY ${groupSql}`;
  return executeWarehouseQuery(batch(summary), boundParameters);
}

export async function loadInvestmentFilters() {
  return executeWarehouseQuery(
    "SELECT DISTINCT PlantName2 AS unit, Region_Name AS sector, Zone_Name AS zone, Section_Name AS section FROM vW_Village_Related_Data ORDER BY unit, sector, zone, section",
  );
}
