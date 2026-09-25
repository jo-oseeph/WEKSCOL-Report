import React from "react";
import {
  FaIndustry,
  FaMoneyBillWave,
  FaSeedling,
  FaTruck,
  FaUsers,
} from "react-icons/fa";
import "../styles/CategoryTabs.css";

const categoryIcons = {
  agriculture: FaSeedling,
  transport: FaTruck,
  finance: FaMoneyBillWave,
  factory: FaIndustry,
  hr: FaUsers,
};

function ChevronDown() {
  return (
    <svg className="menu-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="menu-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CategoryIcon({ categoryId }) {
  const Icon = categoryIcons[categoryId];
  return Icon ? <Icon className="category-menu-icon" aria-hidden="true" /> : null;
}

function CategoryTabs({
  categories,
  selectedCategory,
  selectedSubcategory,
  selectedReport,
  onSelectReport,
}) {
  return (
    <nav className="category-menu">
      <ul className="category-menu-list">
        {categories.map((category) => (
          <li className="category-menu-item" key={category.id}>
            <button
              type="button"
              className={
                "category-menu-trigger" +
                (selectedCategory?.id === category.id
                  ? " category-menu-trigger-active"
                  : "")
              }
            >
              <CategoryIcon categoryId={category.id} />
              {category.name}
              <ChevronDown />
            </button>

            {/* Opens below the category on hover */}
            <ul className="subcategory-dropdown">
              {category.subcategories.length === 0 ? (
                <li className="subcategory-empty">No reports configured yet.</li>
              ) : (
                category.subcategories.map((subcategory) => (
                  <li className="subcategory-item" key={subcategory.id}>
                    <button
                      type="button"
                      className={
                        "subcategory-trigger" +
                        (selectedSubcategory?.id === subcategory.id
                          ? " subcategory-trigger-active"
                          : "")
                      }
                    >
                      {subcategory.name}
                      <ChevronRight />
                    </button>

                    {/* Opens to the side of the subcategory on hover */}
                    <ul className="report-flyout">
                      {subcategory.reports.length === 0 ? (
                        <li className="report-flyout-empty">No reports configured yet.</li>
                      ) : (
                        subcategory.reports.map((report) => (
                          <li key={report.id}>
                            <button
                              type="button"
                              className={
                                "report-flyout-item" +
                                (selectedReport?.id === report.id
                                  ? " report-flyout-item-active"
                                  : "")
                              }
                              onClick={() =>
                                onSelectReport(category, subcategory, report)
                              }
                            >
                              {report.name}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </li>
                ))
              )}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default CategoryTabs;
