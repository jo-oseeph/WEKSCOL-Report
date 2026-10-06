import React, { useState } from "react";
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
  selectedGroup,
  selectedReport,
  onSelectReport,
}) {
  const [openCategoryId, setOpenCategoryId] = useState(selectedCategory?.id || null);
  const [openSubcategoryId, setOpenSubcategoryId] = useState(selectedSubcategory?.id || null);
  const [openGroupId, setOpenGroupId] = useState(selectedGroup?.id || null);
  const [isSelectionCollapsed, setIsSelectionCollapsed] = useState(false);

  // Toggle a top-level category so its subcategories can be opened without hover.
  function toggleCategory(categoryId) {
    setIsSelectionCollapsed(false);
    setOpenCategoryId((current) => (current === categoryId ? null : categoryId));
    setOpenSubcategoryId(null);
    setOpenGroupId(null);
  }

  // Toggle a subcategory so its groups or direct reports can be opened on touch devices.
  function toggleSubcategory(subcategoryId) {
    setIsSelectionCollapsed(false);
    setOpenSubcategoryId((current) => (current === subcategoryId ? null : subcategoryId));
    setOpenGroupId(null);
  }

  // Toggle a report group so grouped fertilizer reports are visible without hover.
  function toggleGroup(groupId) {
    setIsSelectionCollapsed(false);
    setOpenGroupId((current) => (current === groupId ? null : groupId));
  }

  function handleSelectReport(category, subcategory, groupOrReport, maybeReport) {
    setOpenCategoryId(null);
    setOpenSubcategoryId(null);
    setOpenGroupId(null);
    setIsSelectionCollapsed(true);
    onSelectReport(category, subcategory, groupOrReport, maybeReport);
  }

  return (
    <nav
      className={`category-menu${isSelectionCollapsed ? " category-menu-selection-collapsed" : ""}`}
      onMouseLeave={() => setIsSelectionCollapsed(false)}
      onFocusCapture={() => setIsSelectionCollapsed(false)}
    >
      <ul className="category-menu-list">
        {categories.map((category) => (
          <li
            className="category-menu-item"
            key={category.id}
            onMouseEnter={() => setIsSelectionCollapsed(false)}
          >
            <button
              type="button"
              className={
                "category-menu-trigger" +
                (selectedCategory?.id === category.id
                  ? " category-menu-trigger-active"
                  : "")
              }
              aria-expanded={openCategoryId === category.id}
              onClick={() => toggleCategory(category.id)}
            >
              <CategoryIcon categoryId={category.id} />
              {category.name}
              <ChevronDown />
            </button>

            {/* Opens below the category on hover */}
            <ul className={`subcategory-dropdown${openCategoryId === category.id ? " menu-panel-open" : ""}`}>
              {category.subcategories.length === 0 ? (
                <li className="category-empty-state">
                  No reports available for this category.
                </li>
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
                      aria-expanded={openSubcategoryId === subcategory.id}
                      onClick={() => toggleSubcategory(subcategory.id)}
                    >
                      {subcategory.name}
                      <ChevronRight />
                    </button>

                    {subcategory.groups?.length ? (
                      <ul className={`group-flyout${openSubcategoryId === subcategory.id ? " menu-panel-open" : ""}`}>
                        {subcategory.groups.map((group) => (
                          <li className="group-item" key={group.id}>
                            <button
                              type="button"
                              className={
                                "group-trigger" +
                                (selectedGroup?.id === group.id ? " group-trigger-active" : "")
                              }
                              aria-expanded={openGroupId === group.id}
                              onClick={() => toggleGroup(group.id)}
                            >
                              {group.name}
                              <ChevronRight />
                            </button>
                            <ul className={`report-flyout report-flyout-grouped${openGroupId === group.id ? " menu-panel-open" : ""}`}>
                              {group.reports.map((report) => (
                                <li key={report.id}>
                                  <button
                                    type="button"
                                    className={
                                      "report-flyout-item" +
                                      (selectedReport?.id === report.id ? " report-flyout-item-active" : "")
                                    }
                                    onClick={() => handleSelectReport(category, subcategory, group, report)}
                                  >
                                    {report.name}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {/* Existing reports remain at the original subcategory level. */}
                    {subcategory.reports.length ? (
                      <ul className={`report-flyout${openSubcategoryId === subcategory.id ? " menu-panel-open" : ""}`}>
                        {subcategory.reports.map((report) => (
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
                                handleSelectReport(category, subcategory, report)
                              }
                            >
                              {report.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
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