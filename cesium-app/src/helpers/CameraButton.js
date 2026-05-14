import * as Cesium from "cesium";
import {
  cameraButtonCheckPath,
  cameraButtonPath,
} from "./constants.js";
import { copyText } from "./clipboard.js";
import { formatNumber } from "./cesiumUtils.js";
import { getViewer } from "./state.js";
import { getCustomToolbar, getCustomToolbarRow } from "./toolbar.js";

export class CameraButton {
  constructor(options) {
    const cameraButton = createCameraButton(options);
    this.button = cameraButton?.button;
    this._destroy = cameraButton?.destroy;
  }

  static create(options) {
    return new CameraButton(options);
  }

  destroy() {
    this._destroy?.();
  }
}

function createCameraButton(options = {}) {
  const viewer = options.viewer ?? getViewer();
  const toolbar = getCustomToolbar(options, viewer);

  if (!viewer || !toolbar) {
    return undefined;
  }

  const toolbarRow = getCustomToolbarRow(toolbar);
  const button = document.createElement("button");

  button.type = "button";
  button.className = "cesium-button cesium-toolbar-button extra-camera-button";
  button.title = "Copy the current camera setView parameters.";
  button.setAttribute("aria-label", options.label ?? "Copy camera");
  button.appendChild(createIcon());
  toolbarRow.insertBefore(button, toolbarRow.firstChild);

  button.addEventListener("click", function () {
    copyText(createCameraSnippet(viewer.camera), button);
  });

  return {
    button,
    destroy() {
      button.remove();
    },
  };
}

function createIcon() {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "cesium-svgPath-svg");
  icon.setAttribute("viewBox", "0 0 30 30");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", cameraButtonPath);
  icon.appendChild(path);

  const checkPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  checkPath.setAttribute("class", "extra-camera-button-check");
  checkPath.setAttribute("d", cameraButtonCheckPath);
  checkPath.style.display = "none";
  checkPath.style.fill = "#6fd36f";
  icon.appendChild(checkPath);

  return icon;
}

function createCameraSnippet(camera) {
  const cartographic = Cesium.Cartographic.fromCartesian(camera.positionWC);
  const longitude = Cesium.Math.toDegrees(cartographic.longitude);
  const latitude = Cesium.Math.toDegrees(cartographic.latitude);
  const height = cartographic.height;
  const heading = Cesium.Math.toDegrees(camera.heading);
  const pitch = Cesium.Math.toDegrees(camera.pitch);

  return `viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(${formatNumber(longitude)}, ${formatNumber(latitude)}, ${formatNumber(height)}),
  orientation: {
    heading: Cesium.Math.toRadians(${formatNumber(heading)}),
    pitch: Cesium.Math.toRadians(${formatNumber(pitch)}),
  },
});`;
}
