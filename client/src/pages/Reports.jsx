import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReportViewer from "../components/ReportViewer.jsx";
import ReportsOverview from "../components/ReportsOverview.jsx";
import AppNavbar from "../components/AppNavbar.jsx";
import { reports as reportsApi } from "../api/api.js";
import "../styles/Reports.css";

function Reports() {
  const { categoryId, subcategoryId, groupId, reportId } = useParams();
  const navigate = useNavigate();
  const [reportCategories, setReportCategories] = useState([]);
  const [catalogError, setCatalogError] = useState("");

  const querySectionRef = useRef(null);
  // Loads the report catalog from the backend for the navigation menu.
  useEffect(() => {
    let isMounted = true;

    reportsApi
      .getCatalog()
      .then((data) => {
        if (isMounted) setReportCategories(data.categories || []);
      })
      .catch((error) => {
        if (isMounted) setCatalogError(error.message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedCategory =
    reportCategories.find((category) => category.id === categoryId) || null;
  const selectedSubcategory =
    selectedCategory?.subcategories.find(
      (subcategory) => subcategory.id === subcategoryId,
    ) || null;
  const selectedGroup =
    selectedSubcategory?.groups?.find((group) => group.id === groupId) || null;
  const selectedReport =
    (selectedGroup?.reports || selectedSubcategory?.reports || []).find((report) => report.id === reportId) ||
    null;

  useEffect(() => {
    if (!selectedReport || !querySectionRef.current) return;
    querySectionRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [selectedReport]);

  function handleSelectReport(category, subcategory, groupOrReport, maybeReport) {
    if (maybeReport) {
      navigate(`/reports/${category.id}/${subcategory.id}/${groupOrReport.id}/${maybeReport.id}`);
      return;
    }
    navigate(`/reports/${category.id}/${subcategory.id}/${groupOrReport.id}`);
  }

  return (
    <div className="reports-shell">
      <AppNavbar
        reportCategories={reportCategories}
        selectedCategory={selectedCategory}
        selectedSubcategory={selectedSubcategory}
        selectedGroup={selectedGroup}
        selectedReport={selectedReport}
        onSelectReport={handleSelectReport}
      />

      <main className="reports-page">
        <ReportsOverview hasSelectedReport={Boolean(selectedReport)} />
        {catalogError ? <p className="report-error">{catalogError}</p> : null}
        {selectedReport ? (
          <section
            className="reports-content-panel reports-query-panel"
            ref={querySectionRef}
          >
            <ReportViewer report={selectedReport} key={selectedReport.id} />
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default Reports;
