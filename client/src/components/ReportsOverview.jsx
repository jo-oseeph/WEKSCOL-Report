import React from "react";
import {
  FaChartLine,
  FaCloudRain,
  FaMapMarkedAlt,
  FaSeedling,
  FaThLarge,
  FaTractor,
  FaTruck,
  FaUsers,
} from "react-icons/fa";
import "../styles/ReportsOverview.css";

// `progress` (0 to 100) adds a progress bar to cards that describe a share of something.
const overviewStats = [
  {
    label: "Area under cane",
    value: "12,480",
    unit: "acres",
    detail: "Across all registered fields",
    tone: "green",
    Icon: FaMapMarkedAlt,
  },
  {
    label: "Planted area",
    value: "8,920",
    unit: "acres",
    detail: "71.5% of total cane area",
    progress: 71.5,
    tone: "teal",
    Icon: FaSeedling,
  },
  {
    label: "Estimated yield",
    value: "126,400",
    unit: "t",
    detail: "10.1 tons per hectare",
    tone: "blue",
    Icon: FaChartLine,
  },
  {
    label: "Cane delivered",
    value: "84,260",
    unit: "t",
    detail: "66.7% of estimated yield",
    progress: 66.7,
    tone: "amber",
    Icon: FaTruck,
  },
  {
    label: "Active fields",
    value: "2,846",
    detail: "214 fields recently planted",
    tone: "purple",
    Icon: FaThLarge,
  },
  {
    label: "Harvest readiness",
    value: "68%",
    detail: "1,932 fields ready or nearing",
    progress: 68,
    tone: "orange",
    Icon: FaTractor,
  },
  {
    label: "Seasonal rainfall",
    value: "742",
    unit: "mm",
    detail: "6% above seasonal average",
    tone: "sky",
    Icon: FaCloudRain,
  },
  {
    label: "Registered farmers",
    value: "7,364",
    detail: "Across all zones and regions",
    tone: "rose",
    Icon: FaUsers,
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
        {overviewStats.map(({ label, value, unit, detail, progress, tone, Icon }) => (
          <article className={`reports-stat-card reports-stat-card-${tone}`} key={label}>
            <div className="reports-stat-top">
              <span className="reports-stat-label">{label}</span>
              <span className="reports-stat-icon" aria-hidden="true">
                <Icon />
              </span>
            </div>

            <strong className="reports-stat-value">
              {value}
              {unit ? <span className="reports-stat-unit">{unit}</span> : null}
            </strong>

            {progress != null ? (
              <div
                className="reports-stat-progress"
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ "--progress": `${progress}%` }} />
              </div>
            ) : null}

            <span className="reports-stat-detail">{detail}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ReportsOverview;