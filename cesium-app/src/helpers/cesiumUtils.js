import * as Cesium from "cesium";

export function pickCartesian(scene, camera, position) {
  let cartesian;

  if (scene.pickPositionSupported) {
    cartesian = scene.pickPosition(position);
  }

  if (!Cesium.defined(cartesian)) {
    const ray = camera.getPickRay(position);
    cartesian = scene.globe.pick(ray, scene);
  }

  return cartesian;
}

export function cartesianToCoordinates(cartesian) {
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);

  return {
    longitude: Cesium.Math.toDegrees(cartographic.longitude),
    latitude: Cesium.Math.toDegrees(cartographic.latitude),
    height: Math.max(0, cartographic.height),
  };
}

export function formatCoordinates(coordinates, precision = 6) {
  return [
    coordinates.longitude.toFixed(precision),
    coordinates.latitude.toFixed(precision),
  ].join(", ");
}

export function normalizeCoordinates(coordinates) {
  if (!coordinates) {
    return undefined;
  }

  const longitude = Array.isArray(coordinates)
    ? coordinates[0]
    : (coordinates.longitude ?? coordinates.lon ?? coordinates.lng);
  const latitude = Array.isArray(coordinates)
    ? coordinates[1]
    : (coordinates.latitude ?? coordinates.lat);
  const height = Array.isArray(coordinates)
    ? (coordinates[2] ?? 0)
    : (coordinates.height ?? 0);

  const normalized = {
    longitude: Number(longitude),
    latitude: Number(latitude),
    height: Number(height),
  };

  if (
    !Number.isFinite(normalized.longitude) ||
    !Number.isFinite(normalized.latitude) ||
    !Number.isFinite(normalized.height)
  ) {
    return undefined;
  }

  return normalized;
}

export function getCesiumColor(value) {
  if (value instanceof Cesium.Color) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const colorName = value.trim().replace(/[\s-]+/g, "_").toUpperCase();
    if (Cesium.Color[colorName]) {
      return Cesium.Color[colorName];
    }

    try {
      return Cesium.Color.fromCssColorString(value);
    } catch {
      return Cesium.Color.ROYALBLUE;
    }
  }

  return Cesium.Color.ROYALBLUE;
}

export function colorToInputValue(value) {
  const color = getCesiumColor(value);
  return color.toCssHexString().slice(0, 7);
}

export function formatNumber(value, digits = 12) {
  return Number(value.toFixed(digits)).toString();
}
