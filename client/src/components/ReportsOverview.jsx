import React from "react";
import "../styles/ReportsOverview.css";

const overviewStats = [
  {
    label: "Area under cane",
    value: "12,480 acres",
    detail: "Across all registered fields",
    tone: "green",
  },
  {
    label: "Planted area",
    value: "8,920 acres",
    detail: "71.5% of total cane area",
    tone: "teal",
  },
  {
    label: "Estimated yield",
    value: "126,400 t",
    detail: "10.1 tons per hectare",
    tone: "blue",
  },
  {
    label: "Cane delivered",
    value: "84,260 t",
    detail: "66.7% of estimated yield",
    tone: "amber",
  },
  {
    label: "Active fields",
    value: "2,846",
    detail: "214 fields recently planted",
    tone: "purple",
  },
  {
    label: "Harvest readiness",
    value: "68%",
    detail: "1,932 fields ready or nearing",
    tone: "orange",
  },
  {
    label: "Seasonal rainfall",
    value: "742 mm",
    detail: "6% above seasonal average",
    tone: "sky",
  },
  {
    label: "Registered farmers",
    value: "7,364",
    detail: "Across all zones and regions",
    tone: "rose",
  },
];

function ReportsOverview({ hasSelectedReport }) {
  return (
    <section className="reports-overview" aria-labelledby="reports-overview-title">
      <div className="reports-overview-heading">
        <div>
          <h2 id="reports-overview-title">Operations overview</h2>
          <p>Here is what is happening across your farms, fields and factory operations.</p>
        </div>
       
      </div>

      <div className="reports-stat-grid">
        {overviewStats.map(({ label, value, detail, tone }) => (
          <article className={`reports-stat-card reports-stat-card-${tone}`} key={label}>

            <span className="reports-stat-label">{label}</span>
            <strong className="reports-stat-value">{value}</strong>
            <span className="reports-stat-detail">{detail}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ReportsOverview;