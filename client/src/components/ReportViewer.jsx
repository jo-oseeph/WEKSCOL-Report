import React, { useEffect, useMemo, useState } from "react";
import LocationFilter, {
  createDefaultLocationSelection,
} from "./LocationFilter.jsx";
import "../styles/ReportViewer.css";

function ReportViewer({ report }) {
  const [showResults, setShowResults] = useState(false);
  const [locationSelection, setLocationSelection] = useState(
    createDefaultLocationSelection()
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [locations, setLocations] = useState([]);
  const [result, setResult] = useState(null);
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
              {result.rows.length} record{result.rows.length === 1 ? "" : "s"} found
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
                  {result.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {result.columns.map((column) => (
                        <td key={column}>{row[column]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportViewer;
