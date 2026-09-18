import React from "react";
import { LOCATION_LEVELS } from "../data/locationData";
import "../styles/LocationFilter.css";

// selection is an array of four values (one per level), each "all" by default.
function LocationFilter({ selection, onChange, locations = [] }) {
  const optionsFor = (levelIndex, parentId) => {
    if (levelIndex === 0) return [...new Set(locations.map((item) => item.plant))].filter(Boolean).map((name) => ({ id: name, name }));
    const parentField = ["plant", "region", "zone"][levelIndex - 1];
    const childField = ["region", "zone", "section"][levelIndex - 1];
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
      {LOCATION_LEVELS.map((levelLabel, levelIndex) => {
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
