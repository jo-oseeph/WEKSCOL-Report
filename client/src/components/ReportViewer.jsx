import React, { useEffect, useMemo, useState } from "react";
import LocationFilter, {
  createDefaultLocationSelection,
} from "./LocationFilter.jsx";
import { reports as reportsApi } from "../api/api.js";
import "../styles/ReportViewer.css";

const RESULTS_PER_PAGE = 50;

function ReportViewer({ report }) {
  const [showResults, setShowResults] = useState(false);
  const [locationSelection, setLocationSelection] = useState(
    createDefaultLocationSelection()
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [identifierSearch, setIdentifierSearch] = useState("");
  const [locations, setLocations] = useState([]);
  const [caneTypes, setCaneTypes] = useState([]);
  const [result, setResult] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeVariant, setActiveVariant] = useState("detailed");
  const [isLoading, setIsLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [error, setError] = useState("");
  const [caneType, setCaneType] = useState("all");
  const isServiceRequest = report.queryModule === "service-request";
  const isPlantation = report.queryModule === "plantation";
  const dateRangeError = !dateFrom && !dateTo
    ? "Select a Date From and Date To before generating the report."
    : !dateFrom
    ? "Select a Date From before generating the report."
    : !dateTo
    ? "Select a Date To before generating the report."
    : dateFrom > dateTo
    ? "Date From cannot be later than Date To."
    : "";
  const hasValidDateRange = !dateRangeError;

  useEffect(() => {
    const source = isServiceRequest
      ? "investment"
      : isPlantation
      ? "plantation"
      : ["cane-supply", "daily-weighment"].includes(report.id)
      ? "harvesting"
      : report.id === "overdue" ? "investment" : undefined;
    const params = source ? { source } : undefined;
    reportsApi
      .getFilters(report.id, params)
      .then((data) => {
        setLocations(data.locations || []);
        setCaneTypes(data.caneTypes || []);
      })
      .catch((requestError) => setError(requestError.message));
  }, [report.id, isServiceRequest, isPlantation]);

  const query = useMemo(() => {
    const [first, second, zone, section] = locationSelection;
    if (isServiceRequest || isPlantation || ["cane-supply", "daily-weighment", "overdue"].includes(report.id)) {
      return {
        unit: first,
        sector: second,
        zone,
        section,
        caneType,
        dateFrom,
        dateTo,
        identifierSearch,
      };
    }
    return { plant: first, region: second, zone, section, dateFrom, dateTo, identifierSearch };
  }, [locationSelection, caneType, dateFrom, dateTo, identifierSearch, report.id, isServiceRequest, isPlantation]);

  // Strips "all"/empty values so they are not sent to the backend as filters.
  const cleanParams = useMemo(() => {
    const params = {};
    Object.entries(query).forEach(([key, value]) => {
      if (value && value !== "all") params[key] = value;
    });
    return params;
  }, [query]);

  const isHarvesting = isServiceRequest || isPlantation || ["cane-supply", "daily-weighment", "overdue"].includes(report.id);
  const filterLocations = locations;

  async function loadReport(variant = "detailed") {
    if (!hasValidDateRange) {
      setError(dateRangeError);
      setShowResults(false);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const data = await reportsApi.run(report.id, { ...cleanParams, variant });
      setResult(data);
      setActiveVariant(data.variant || variant);
      setCurrentPage(1);
      setShowResults(true);
    } catch (requestError) {
      setError(requestError.message);
      setShowResults(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerate(event) {
    event.preventDefault();
    await loadReport("detailed");
  }

  async function handleVariantChange(variant) {
    if (variant === activeVariant || isLoading) return;
    await loadReport(variant);
  }

  async function download(format) {
    if (exportingFormat) return;
    if (!hasValidDateRange) {
      setError(dateRangeError);
      return;
    }
    setExportingFormat(format);
    setError("");
    try {
      const response = await reportsApi.download(report.id, format, {
        ...cleanParams,
        variant: activeVariant,
      });
      const contentDisposition = response.headers["content-disposition"] || "";
      const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const fileName = fileNameMatch?.[1] || `${report.name}.${format}`;
      const objectUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setExportingFormat("");
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.rows.length / RESULTS_PER_PAGE)) : 1;
  const visibleRows = result
    ? result.rows.slice((currentPage - 1) * RESULTS_PER_PAGE, currentPage * RESULTS_PER_PAGE)
    : [];
  const firstVisibleRow = result && result.rows.length > 0
    ? (currentPage - 1) * RESULTS_PER_PAGE + 1
    : 0;
  const lastVisibleRow = result
    ? Math.min(currentPage * RESULTS_PER_PAGE, result.rows.length)
    : 0;

  function goToPage(page) {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  }

  return (
    <div className="report-viewer">
      <div className="report-viewer-header">
        <h2 className="report-viewer-title">{report.name}</h2>
        <p className="report-viewer-description">{report.description}</p>
      </div>

      <form className="report-viewer-filters" onSubmit={handleGenerate}>
        <div className="report-filter-group">
          <span className="report-filter-group-label">Location</span>
          <LocationFilter
            selection={locationSelection}
            onChange={setLocationSelection}
            locations={filterLocations}
            labels={isHarvesting ? ["Unit", "Sector", "Zone", "Section"] : undefined}
            fields={isHarvesting ? ["unit", "sector", "zone", "section"] : undefined}
          />
        </div>

        {report.id === "overdue" ? (
          <div className="report-filter-group">
            <span className="report-filter-group-label">Cane Type</span>
            <select value={caneType} onChange={(event) => setCaneType(event.target.value)}>
              <option value="all">All Cane Types</option>
              {caneTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
        ) : null}

        <div className="report-filter-row">
          <div className="report-filter-group">
            <span className="report-filter-group-label">Date Range</span>
            <div className="report-date-fields">
              <div className="report-filter-field">
                <label htmlFor="dateFrom">Date From</label>
                <input
                  id="dateFrom"
                  type="date"
                  max={dateTo || undefined}
                  required
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="report-filter-field">
                <label htmlFor="dateTo">Date To</label>
                <input
                  id="dateTo"
                  type="date"
                  min={dateFrom || undefined}
                  required
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            {dateRangeError ? (
              <p className="report-error" role="alert">{dateRangeError}</p>
            ) : null}
            {report.id === "cane-supply" ? (
              <p className="report-filter-hint">
                The Daily Detailed report covers one full month at a time. Choose a Date From and Date To within the same month.
              </p>
            ) : null}
          </div>

          <div className="report-filter-group report-search-group">
            <span className="report-filter-group-label">Search</span>
            <div className="report-query-canvas">
              <label htmlFor="identifierSearch"> Search ID Number/Field Number</label>
              <input
                id="identifierSearch"
                type="search"
                value={identifierSearch}
                onChange={(event) => setIdentifierSearch(event.target.value)}
                placeholder="Enter ID_NUMBER or FIELD_NUMBER"
                autoComplete="off"
              />
              <p className="report-filter-hint">
              </p>
            </div>
          </div>
        </div>

        <div className="report-filter-actions">
          <button type="submit" className="report-generate-btn" disabled={!hasValidDateRange || isLoading}>
            Generate Report
          </button>
        </div>
      </form>

      {error ? <p className="report-error">{error}</p> : null}
      {isLoading ? <p className="report-loading">Loading report…</p> : null}

      {showResults && result && (
        <div className="report-results">
          <div className="report-results-heading">
            <h3 className="report-results-title">
              {result.name}
              {result.monthLabel ? <span className="report-results-month"> — {result.monthLabel}</span> : null}
            </h3>
            {result.dateRange ? (
              <p className="report-applied-date-range">
                Applied date range: <strong>{result.dateRange.dateFrom}</strong> to <strong>{result.dateRange.dateTo}</strong>
              </p>
            ) : null}
            <div className="report-variant-tabs" role="tablist" aria-label="Report view">
              {(report.variants || ["detailed"]).map((variant) => {
                const mode = { id: variant, label: report.variantLabels?.[variant] || variant.replaceAll("-", " ") };
                const isActive = activeVariant === mode.id;
                return (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`report-variant-tab${isActive ? " is-active" : ""}`}
                  onClick={() => handleVariantChange(mode.id)}
                  disabled={isLoading}
                >
                  {mode.label}
                </button>
                );
              })}
            </div>
            {activeVariant !== "detailed" ? <span className="report-summary-group-label">Grouped to: {result.groupLabel || "Unit"}</span> : null}
          </div>
          <div className="report-results-toolbar">
            <span className="report-results-count">
              Showing {firstVisibleRow}–{lastVisibleRow} of {result.rows.length} record{result.rows.length === 1 ? "" : "s"}
            </span>
            <div className="report-results-actions">
              <button type="button" className="report-action-btn" onClick={() => download("pdf")} disabled={Boolean(exportingFormat)}>
                {exportingFormat === "pdf" ? "Preparing PDF…" : "Export PDF"}
              </button>
              <button type="button" className="report-action-btn" onClick={() => download("xlsx")} disabled={Boolean(exportingFormat)}>
                {exportingFormat === "xlsx" ? "Preparing Excel…" : "Export Excel"}
              </button>
              <button type="button" className="report-action-btn" onClick={() => download("csv")} disabled={Boolean(exportingFormat)}>
                {exportingFormat === "csv" ? "Preparing CSV…" : "Export CSV"}
              </button>
              <button type="button" className="report-action-btn" onClick={() => window.print()} disabled={Boolean(exportingFormat)}>
                Print
              </button>
            </div>
          </div>

          {result.rows.length === 0 ? (
            <div className="report-empty-state">
              No records found for the selected filters or date range.
            </div>
          ) : (
            <div className="report-table-section">
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      {result.columns.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, rowIndex) => (
                      <tr key={(currentPage - 1) * RESULTS_PER_PAGE + rowIndex}>
                        {result.columns.map((column) => (
                          <td key={column}>{row[column]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 ? (
                <nav className="report-pagination" aria-label="Report pages">
                  <button type="button" className="report-pagination-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                    Previous
                  </button>
                  <span className="report-pagination-status" aria-live="polite">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button type="button" className="report-pagination-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                    Next
                  </button>
                </nav>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportViewer;
