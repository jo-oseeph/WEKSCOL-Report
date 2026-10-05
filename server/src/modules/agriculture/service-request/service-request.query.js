import { executeWarehouseQuery } from "../../../db/warehouseDb/connection.js";

const GROUP_COLUMNS = {
  unit: ["Unit"],
  sector: ["Unit", "Sector_Name"],
  zone: ["Unit", "Sector_Name", "Zone_Name"],
  section: ["Unit", "Sector_Name", "Zone_Name", "Section_Name"],
};

const REPORT_RULES = {
  "fertilizer-pending": { type: "FERTILIZER", status: "pending" },
  "fertilizer-approved": { type: "FERTILIZER", status: "approved" },
  "fertilizer-issued": { type: "FERTILIZER", status: "issued" },
  "seedcane-pending": { type: "SEED", status: "pending" },
  "seedcane-approved": { type: "SEED", status: "approved" },
  "seedcane-issued": { type: "SEED", status: "issued" },
};

const SECTOR = `CASE WHEN B.Region_Name = 'KABRAS CENTRAL' THEN CASE WHEN B.Zone_Name IN ('CENTRAL ZONE-B','EASTERN ZONE') THEN 'KABRAS B' ELSE 'KABRAS A' END WHEN B.Region_Name IN ('MISIKHU','NAITIRI','KITALE','BUSIA','NZOIA','MAGUT','BUTERE') THEN B.Region_Name WHEN B.Region_Name IN ('MOI UNIVERSITY','TURBO') THEN 'SELIA' WHEN B.Region_Name IN ('DOROFU','DOROFU KHALABA') THEN 'KHALABA' WHEN B.Region_Name IN ('KABRAS WEST','KABRAS NORTH') THEN 'KABRAS A' WHEN B.Region_Name IN ('KAKAMEGA','BUKURA','KABRAS SOUTH','KAIMOSI','KABRAS') THEN 'KABRAS B' WHEN B.Region_Name = 'SIAYA' THEN 'LAKE AGRO' WHEN B.Region_Name IN ('MIWANI','KERICHO','CHEMELIL') THEN 'NYANDO' WHEN B.Region_Name IN ('Eastern','Northern','Southern','Western') THEN B.Region_Name WHEN B.Region_Name = 'Central' THEN 'Nzoia Nucleus' ELSE 'NOT MAPPED' END`;

function predicates(clauses, joiner = "WHERE") {
  return clauses.length ? `${joiner} ${clauses.join(" AND ")}` : "";
}

function statusPredicate(status) {
  if (status === "approved") return "B.Qty_Agri IS NOT NULL AND B.Qty_Fin IS NOT NULL AND B.Qty_Agri = B.Qty_Fin AND B.Qty_Agri > 0";
  if (status === "pending") return "(B.Qty_Agri IS NULL OR B.Qty_Fin IS NULL)";
  return "P.Qty_Delivered > 0";
}

function baseSql(type, finalSql) {
  return `DROP TABLE IF EXISTS #SR_MATERIAL; DROP TABLE IF EXISTS #SR_HEADER; DROP TABLE IF EXISTS #SR_POH; DROP TABLE IF EXISTS #SR_POM; DROP TABLE IF EXISTS #SR_VW2; DROP TABLE IF EXISTS #SR_BASE; DROP TABLE IF EXISTS #SR_PGI;
SELECT A.SERVICE_REQUEST_HEADER_ID,A.Item_ID,A.Qty,A.AgricultureApprovedQty,A.FinanceApprovedQty,A.Created_On INTO #SR_MATERIAL
FROM DT_SERVICE_REQUEST_MATERIAL A
WHERE A.Created_On >= '20250101' AND A.Is_Active=1 AND A.Item_Description LIKE '%${type}%' AND A.Created_On >= COALESCE(@dateFrom,A.Created_On) AND A.Created_On < COALESCE(DATEADD(DAY,1,@dateTo),DATEADD(DAY,1,A.Created_On));
SELECT MH.SERVICE_REQUEST_HEADER_ID,MH.ID_Number,MH.Field_Number,REPLACE(MH.Field_Number,'FN-','') AS Lead_no,MH.E_Contract_ID INTO #SR_HEADER
FROM MD_SERVICE_REQUEST_HEADER MH INNER JOIN (SELECT DISTINCT SERVICE_REQUEST_HEADER_ID FROM #SR_MATERIAL) F ON MH.SERVICE_REQUEST_HEADER_ID=F.SERVICE_REQUEST_HEADER_ID;
SELECT DISTINCT F.Process_Order_Header_ID,F.E_Contract_ID INTO #SR_POH FROM MD_PROCESS_ORDER_HEADER F INNER JOIN (SELECT DISTINCT E_Contract_ID FROM #SR_HEADER WHERE E_Contract_ID IS NOT NULL) H ON F.E_Contract_ID=H.E_Contract_ID;
SELECT G.Process_Order_Header_ID,G.Item_ID,G.Process_Order_Material_ID INTO #SR_POM FROM DT_PROCESS_ORDER_MATERIAL G INNER JOIN #SR_POH F ON G.Process_Order_Header_ID=F.Process_Order_Header_ID INNER JOIN (SELECT DISTINCT Item_ID FROM #SR_MATERIAL) I ON G.Item_ID=I.Item_ID;
SELECT DISTINCT LeadOpportunity_ID,Current_Crop_Cycle,Planned_Date_Of_PC_Ratoon,Actual_Date_Of_Plant_Ratoon,Contract_Number,Is_Synch,Is_Company INTO #SR_VW2 FROM VW_BP_LOC_ATTR_NEW;
SELECT H.Field_Number,CASE WHEN D.Is_overlaped=0 THEN 'NO OVERLAP' WHEN D.Is_overlaped=1 THEN 'FULL OVERLAP' WHEN D.Is_overlaped=-1 THEN 'INITIAL' WHEN D.Is_overlaped=2 THEN 'PARTIAL OVERLAP' ELSE 'UNKNOWN' END AS OVERLAP,H.ID_Number,CASE WHEN C.Is_Verified=2 THEN 'IPRS ERROR' WHEN C.Is_Verified=1 THEN 'VERIFIED' WHEN C.Is_Verified=0 THEN 'COMPANY' ELSE 'UNKNOWN' END AS IPRS,C.First_Name,MM.Description,F.Qty AS Qty_Requested,F.AgricultureApprovedQty AS Qty_Agri,F.FinanceApprovedQty AS Qty_Fin,E.Measured_Cane_Area,F.Created_On,G.Process_Order_Material_ID,VW.Region_Name,VW.Zone_Name,VW.Section_Name,VW.SubLocation,VW.PlantName2 AS Unit_name,VW.Village_Name,VW2.Current_Crop_Cycle,VW2.Planned_Date_Of_PC_Ratoon,VW2.Actual_Date_Of_Plant_Ratoon,VW2.Contract_Number,VW2.Is_Synch,VW2.Is_Company INTO #SR_BASE
FROM #SR_MATERIAL F INNER JOIN #SR_HEADER H ON F.SERVICE_REQUEST_HEADER_ID=H.SERVICE_REQUEST_HEADER_ID INNER JOIN MD_BUS_PARTNER_MASTER C ON H.ID_Number=C.ID_Number INNER JOIN DT_BUS_PARTNER_LOCATION_ATTRIBUTES D ON H.Lead_no=D.LeadOpportunity_ID INNER JOIN DT_BUS_PARTNER_Land_ATTRIBUTES E ON H.Lead_no=E.LeadOpportunity_ID LEFT JOIN #SR_POH POH ON H.E_Contract_ID=POH.E_Contract_ID LEFT JOIN #SR_POM G ON POH.Process_Order_Header_ID=G.Process_Order_Header_ID AND F.Item_ID=G.Item_ID LEFT JOIN MD_MATERIAL_MASTER MM ON F.Item_ID=MM.Material_Master_ID LEFT JOIN vW_Village_Related_Data VW ON D.village_id=VW.Village_ID LEFT JOIN #SR_VW2 VW2 ON H.Lead_no=VW2.LeadOpportunity_ID;
SELECT P.Process_Order_Material_ID,P.GoodsID,P.Delivered_Qty AS Qty_Delivered,P.Allocated_Qty AS Qty_Allocated,1 AS NO_OF_PGIs,P.CreatedON INTO #SR_PGI FROM DT_GoodsIssue_PO P INNER JOIN (SELECT DISTINCT Process_Order_Material_ID FROM #SR_BASE WHERE Process_Order_Material_ID IS NOT NULL) X ON P.Process_Order_Material_ID=X.Process_Order_Material_ID WHERE P.CreatedON >= '20250101';
${finalSql};`;
}

function detailedSql(status) {
  return `SELECT B.Field_Number,B.OVERLAP,B.ID_Number,B.IPRS,B.First_Name,B.Description,B.Region_Name,${SECTOR} AS Sector_Name,B.Zone_Name,B.Section_Name,B.SubLocation,B.Unit_name AS Unit,B.Village_Name,CASE WHEN B.Qty_Fin > 0 AND B.Qty_Agri > 0 AND B.Qty_Fin = B.Qty_Agri THEN 'Finance Approved' WHEN B.Qty_Agri > 0 AND (B.Qty_Fin IS NULL OR B.Qty_Fin = 0) THEN 'Agri Approved' WHEN B.Qty_Agri IS NULL OR B.Qty_Agri = 0 THEN 'Pending Agriculture Approval' ELSE 'Pending' END AS [Approval Status],B.Measured_Cane_Area,1 AS No_of_SR,B.Qty_Requested,B.Qty_Agri,B.Qty_Fin,P.Qty_Allocated,P.Qty_Delivered,P.NO_OF_PGIs,B.Qty_Requested-ISNULL(P.Qty_Delivered,0) AS Qty_Pending,DATEDIFF(DAY,B.Created_On,GETDATE()) AS Ageing_Days,B.Created_On AS Min_Created_On,B.Created_On AS Max_Created_On,B.Current_Crop_Cycle,B.Planned_Date_Of_PC_Ratoon,B.Actual_Date_Of_Plant_Ratoon,B.Contract_Number,B.Is_Synch,B.Is_Company FROM #SR_BASE B LEFT JOIN #SR_PGI P ON B.Process_Order_Material_ID=P.Process_Order_Material_ID ${predicates([statusPredicate(status)])}`;
}

export async function runServiceRequestQuery({ reportId, variant, group, clauses, parameters }) {
  const rule = REPORT_RULES[reportId];
  if (!rule) throw new Error("Unknown service request report.");
  const boundParameters = { dateFrom: null, dateTo: null, ...parameters };
  const detail = detailedSql(rule.status);
  if (variant === "detailed") {
    return executeWarehouseQuery(baseSql(rule.type, `SELECT * FROM (${detail}) AS service_request_result ${predicates(clauses, "WHERE")} ORDER BY Region_Name,Sector_Name,Field_Number`), boundParameters);
  }
  const groupColumns = GROUP_COLUMNS[group];
  const groupSql = groupColumns.map((name) => `[${name}]`).join(",");
  const quantityName = rule.type === "FERTILIZER" ? "Quantity_Bags" : "Quantity_Tonnes";
  const summary = `SELECT ${groupSql},COUNT(DISTINCT Field_Number) AS Total_Fields,SUM(Measured_Cane_Area) AS Total_Acreage,SUM(Qty_Requested) AS ${quantityName} FROM (${detail}) AS source ${predicates(clauses, "WHERE")} GROUP BY ${groupSql} ORDER BY ${groupSql}`;
  return executeWarehouseQuery(baseSql(rule.type, summary), boundParameters);
}

export async function loadServiceRequestFilters() {
  return executeWarehouseQuery("SELECT DISTINCT PlantName2 AS unit, Region_Name AS sector, Zone_Name AS zone, Section_Name AS section FROM vW_Village_Related_Data ORDER BY unit, sector, zone, section");
}