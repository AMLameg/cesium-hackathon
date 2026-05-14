import * as Cesium from "cesium";
import { markerStyles } from "./constants.js";

export function normalizeMarkerStyle(markerStyle) {
  return markerStyles.includes(markerStyle) ? markerStyle : "marker";
}

export function getMarkerStyleLabel(markerStyle) {
  return markerStyle
    .split("-")
    .map(function (part) {
      return `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

export function createMarkerStyleIconUrl(markerStyle) {
  return Cesium.buildModuleUrl(
    `Assets/Textures/maki/${encodeURIComponent(markerStyle)}.png`,
  );
}

export function createMarkerStyleOptions(selectedStyle = "marker") {
  const style = normalizeMarkerStyle(selectedStyle);

  return markerStyles
    .map(function (markerStyle) {
      const label = getMarkerStyleLabel(markerStyle);
      return `<option value="${markerStyle}" ${markerStyle === style ? "selected" : ""}>${label}</option>`;
    })
    .join("");
}
