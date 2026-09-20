import React, { useEffect, useMemo, useState } from "react";
import LocationFilter, {
  createDefaultLocationSelection,
} from "./LocationFilter.jsx";
import "../styles/ReportViewer.css";

const RESULTS_PER_PAGE = 50;

function ReportViewer({ report }) {
  const [showResults, setShowResults] = useState(false);
  const [locationSelection, setLocationSelection] = useState(
    createDefaultLocationSelection()
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [locations, setLocations] = useState([]);
  const [result, setResult] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/reports/filters", { credentials: "include" })
      .then((response) => response.json().then((body) => ({ response, body })))
      .then(({ response, body }) => {
        if (!response.ok) throw new Error(body.error || "Unable to load filters.");
        setLocations(body.locations || []);
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  const query = useMemo(() => {
    const [plant, region, zone, section] = locationSelection;
    return { plant, region, zone, section, dateFrom, dateTo };
  }, [locationSelection, dateFrom, dateTo]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value);
    });
    return params.toString();
  }, [query]);

  async function handleGenerate(event) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/reports/${report.id}?${queryString}`, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to generate report.");
      setResult(body);
      setCurrentPage(1);
      setShowResults(true);
    } catch (requestError) {
      setError(requestError.message);
      setShowResults(false);
    } finally {
      setIsLoading(false);
    }
  }

  function download(format) {
    window.location.assign(`/api/reports/${report.id}/export.${format}${queryString ? `?${queryString}` : ""}`);
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
            locations={locations}
          />
        </div>

        <div className="report-filter-group">
          <span className="report-filter-group-label">Date Range</span>
          <div className="report-date-fields">
            <div className="report-filter-field">
              <label htmlFor="dateFrom">Date From</label>
              <input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="report-filter-field">
              <label htmlFor="dateTo">Date To</label>
              <input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

          </div>
        </div>

        <div className="report-filter-actions">
          <button type="submit" className="report-generate-btn">
            Generate Report
          </button>
        </div>
      </form>

      {error ? <p className="report-error">{error}</p> : null}
      {isLoading ? <p className="report-loading">Loading report…</p> : null}

      {showResults && result && (
        <div className="report-results">
          <div className="report-results-toolbar">
            <span className="report-results-count">
              Showing {firstVisibleRow}–{lastVisibleRow} of {result.rows.length} record{result.rows.length === 1 ? "" : "s"}
            </span>
            <div className="report-results-actions">
              <button type="button" className="report-action-btn" onClick={() => download("pdf")}>Export PDF</button>
              <button type="button" className="report-action-btn" onClick={() => download("xlsx")}>Export Excel</button>
              <button type="button" className="report-action-btn" onClick={() => download("csv")}>Export CSV</button>
              <button type="button" className="report-action-btn" onClick={() => window.print()}>
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
