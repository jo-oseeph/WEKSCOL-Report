const unitExpression = `CASE
  WHEN vw.Region_Name IN ('NAITIRI','MISIKHU','KITALE') THEN 'WKS-NAITIRI'
  WHEN vw.Region_Name = 'BUSIA' THEN 'WKS-OLEPITO'
  ELSE 'WKS-KABRAS'
END`;

const sectorExpression = `CASE
  WHEN vw.Region_Name='KABRAS CENTRAL' THEN CASE WHEN vw.Zone_Name IN ('CENTRAL ZONE-B','EASTERN ZONE') THEN 'KABRAS B' ELSE 'KABRAS A' END
  WHEN vw.Region_Name IN ('MISIKHU','NAITIRI','KITALE','BUSIA','NZOIA','MAGUT','BUTERE') THEN vw.Region_Name
  WHEN vw.Region_Name IN ('MOI UNIVERSITY','TURBO') THEN 'SELIA'
  WHEN vw.Region_Name IN ('DOROFU','DOROFU KHALABA') THEN 'KHALABA'
  WHEN vw.Region_Name IN ('KABRAS WEST','KABRAS NORTH') THEN 'KABRAS A'
  WHEN vw.Region_Name IN ('KAKAMEGA','BUKURA','KABRAS SOUTH','KAIMOSI','KABRAS') THEN 'KABRAS B'
  WHEN vw.Region_Name='SIAYA' THEN 'LAKE AGRO'
  WHEN vw.Region_Name IN ('MIWANI','KERICHO','CHEMELIL') THEN 'NYANDO'
  WHEN vw.Region_Name IN ('Eastern','Northern','Southern','Western') THEN vw.Region_Name
  WHEN vw.Region_Name='Central' THEN 'Nzoia Nucleus'
  ELSE 'NOT MAPPED'
END`;

const dateExpression = `CAST(DATEADD(HOUR, -6, TRY_CONVERT(DATETIME, DCD.GROSS_DT1) + ISNULL(TRY_CONVERT(DATETIME, STUFF(RIGHT('0000' + CAST(DCD.GROSS_TM1 AS VARCHAR(4)), 4), 3, 0, ':')), 0)) AS DATE)`;

export function filterPredicates() {
  const unit = unitExpression;
  const sector = sectorExpression;
  const zone = "vw.ZONE_NAME";
  const section = "vw.Section_Name";
  const predicates = [
    `(@Unit IS NULL OR UPPER(${unit}) = UPPER(@Unit))`,
    `(@Sector IS NULL OR UPPER(${sector}) = UPPER(@Sector))`,
    `(@Zone IS NULL OR UPPER(${zone}) = UPPER(@Zone))`,
    `(@Section IS NULL OR UPPER(${section}) = UPPER(@Section))`,
    `(@DateFrom IS NULL OR ${dateExpression} >= @DateFrom)`,
    `(@DateTo IS NULL OR ${dateExpression} <= @DateTo)`,
  ];
  return predicates;
}

export function injectDirectFilters(sqlText) {
  const predicates = filterPredicates();
  const baseClose = sqlText.search(/\n\),\s*\n/i);
  if (baseClose >= 0) {
    return `${sqlText.slice(0, baseClose)}\n      AND ${predicates.join("\n      AND ")}${sqlText.slice(baseClose)}`;
  }
  const cteClose = sqlText.search(/\n\)\s*\nSELECT/i);
  if (cteClose >= 0) {
    return `${sqlText.slice(0, cteClose)}\n      AND ${predicates.join("\n      AND ")}${sqlText.slice(cteClose)}`;
  }
  const semicolonIndex = sqlText.lastIndexOf(";");
  const insertAt = semicolonIndex >= 0 ? semicolonIndex : sqlText.length;
  const body = sqlText.slice(0, insertAt);
  return `${body}\n  AND ${predicates.join("\n  AND ")}\n${sqlText.slice(insertAt)}`;
}

export function injectMonthlyFilters(sqlText, filters) {
  const predicates = filterPredicates();
  const selectMarker = "\n\nSELECT\n";
  const selectIndex = sqlText.indexOf(selectMarker);
  if (selectIndex < 0) return sqlText;
  const baseEnd = sqlText.lastIndexOf("\n)", selectIndex);
  if (baseEnd < 0) return sqlText;
  const embeddedPredicates = predicates.join("\n      AND ").replace(/'/g, "''");
  const filteredSql = `${sqlText.slice(0, baseEnd)}\n      AND ${embeddedPredicates}${sqlText.slice(baseEnd)}`;
  return filteredSql.replace(
    "N'@MonthStart DATE, @NextMonth DATE'",
    "N'@MonthStart DATE, @NextMonth DATE, @Unit VARCHAR(255), @Sector VARCHAR(255), @Zone VARCHAR(255), @Section VARCHAR(255), @DateFrom DATE, @DateTo DATE'",
  ).replace(
    "    @MonthStart,\n    @NextMonth;",
    "    @MonthStart,\n    @NextMonth,\n    @Unit,\n    @Sector,\n    @Zone,\n    @Section,\n    @DateFrom,\n    @DateTo;",
  );
}

export { unitExpression, sectorExpression, dateExpression };