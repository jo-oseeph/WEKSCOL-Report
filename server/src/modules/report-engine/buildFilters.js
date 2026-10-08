import sql from "mssql";
import { httpError } from "../../shared/errors.js";
import normalizeIdentifierSearch from "./normalizeIdentifierSearch.js";

export default function buildFilters(definition, query = {}) {
  const clauses = [];
  const parameters = {};

  for (const param of definition.params) {
    const value = query[param.name];
    if (value === undefined || value === "" || value === "all") continue;
    if (param.type === "date" && Number.isNaN(Date.parse(value))) throw httpError(`${param.name} must be a valid date.`, 400);
    if (param.type === "number" && !Number.isFinite(Number(value))) throw httpError(`${param.name} must be numeric.`, 400);
    clauses.push(param.sql);
    parameters[param.name] = param.type === "number" ? Number(value) : value;
  }

  const identifierSearch = normalizeIdentifierSearch(query.identifierSearch);
  if (identifierSearch) {
    const identifierColumns = definition.queryModule === "harvesting"
      ? ["Farmer_Id_Number", "Field_No"]
      : definition.queryModule === "plantation"
      ? ["Rec_Farmer_Id", "Rec_Field_No"]
      : ["ID_Number", "Field_Number"];
    clauses.push(`(REPLACE(UPPER(LTRIM(RTRIM(CONVERT(VARCHAR(100), ${identifierColumns[0]})))), 'FN-', '') = @identifierSearch OR REPLACE(UPPER(LTRIM(RTRIM(CONVERT(VARCHAR(100), ${identifierColumns[1]})))), 'FN-', '') = @identifierSearch)`);
    parameters.identifierSearch = identifierSearch;
  }

  return { clauses, parameters };
}

export { sql };