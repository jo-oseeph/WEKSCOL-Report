import React from "react";
import "../styles/ReportsOverview.css";

const overviewStats = [
  {
    label: "Area under cane",
    value: "12,480 ha",
    detail: "Across all registered fields",
    tone: "green",
    // icon: FiGrid,
  },
  {
    label: "Planted area",
    value: "8,920 ha",
    detail: "71.5% of total cane area",
    tone: "teal",
    // icon: FiTrendingUp,
  },
  {
    label: "Estimated yield",
    value: "126,400 t",
    detail: "10.1 tons per hectare",
    tone: "blue",
    // icon: FiBarChart2,
  },
  {
    label: "Cane delivered",
    value: "84,260 t",
    detail: "66.7% of estimated yield",
    tone: "amber",
    // icon: FiTruck,
  },
  {
    label: "Active fields",
    value: "2,846",
    detail: "214 fields recently planted",
    tone: "purple",
    // icon: FiLayers,
  },
  {
    label: "Harvest readiness",
    value: "68%",
    detail: "1,932 fields ready or nearing",
    tone: "orange",
    // icon: FiTarget,
  },
  {
    label: "Seasonal rainfall",
    value: "742 mm",
    detail: "6% above seasonal average",
    tone: "sky",
    // icon: FiCloudRain,
  },
  {
    label: "Registered growers",
    value: "1,364",
    detail: "Across all zones and regions",
    tone: "rose",
    // icon: FiUsers,
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