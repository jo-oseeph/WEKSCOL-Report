import React, { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReportViewer from "../components/ReportViewer.jsx";
import ReportsOverview from "../components/ReportsOverview.jsx";
import AppNavbar from "../components/AppNavbar.jsx";
import { useReportCatalog } from "../context/ReportCatalogContext.jsx";
import "../styles/Reports.css";

function Reports() {
  const { categoryId, subcategoryId, groupId, reportId } = useParams();
  const navigate = useNavigate();
  const {
    reportCategories,
    catalogError,
    isCatalogLoading,
  } = useReportCatalog();

  const querySectionRef = useRef(null);
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
        isCatalogLoading={isCatalogLoading}
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
