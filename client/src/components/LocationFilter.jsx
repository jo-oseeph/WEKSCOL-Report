import React from "react";
import { LOCATION_LEVELS } from "../data/locationData";
import "../styles/LocationFilter.css";

// selection is an array of four values (one per level), each "all" by default.
function LocationFilter({ selection, onChange, locations = [], labels = LOCATION_LEVELS, fields }) {
  const filterFields = fields || ["plant", "region", "zone", "section"];
  const optionsFor = (levelIndex, parentId) => {
    if (levelIndex === 0) return [...new Set(locations.map((item) => item[filterFields[0]]))].filter(Boolean).map((name) => ({ id: name, name }));
    const parentField = filterFields[levelIndex - 1];
    const childField = filterFields[levelIndex];
    return [...new Set(locations.filter((item) => !parentId || parentId === "all" || item[parentField] === parentId).map((item) => item[childField]))]
      .filter(Boolean)
      .map((name) => ({ id: name, name }));
  };

  function handleLevelChange(levelIndex, value) {
    const next = [...selection];
    next[levelIndex] = value;
    // Selecting a new value resets every level below it.
    for (let i = levelIndex + 1; i < next.length; i++) {
      next[i] = "all";
    }
    onChange(next);
  }

  return (
    <div className="location-filter">
      {labels.map((levelLabel, levelIndex) => {
        const parentId = levelIndex === 0 ? null : selection[levelIndex - 1];
        const options = optionsFor(levelIndex, parentId);
        const disabled = levelIndex > 0 && (!parentId || parentId === "all");

        return (
          <div className="location-filter-field" key={levelLabel}>
            <label>{levelLabel}</label>
            <select
              value={selection[levelIndex]}
              disabled={disabled}
              onChange={(e) => handleLevelChange(levelIndex, e.target.value)}
            >
              <option value="all">All {levelLabel}s</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

export function createDefaultLocationSelection() {
  return LOCATION_LEVELS.map(() => "all");
}

export default LocationFilter;
