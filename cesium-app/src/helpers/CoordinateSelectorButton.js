import * as Cesium from "cesium";
import {
  cameraButtonCheckPath,
  coordinateSelectorPath,
} from "./constants.js";
import { copyText } from "./clipboard.js";
import {
  cartesianToCoordinates,
  formatCoordinates,
  pickCartesian,
} from "./cesiumUtils.js";
import { getViewer } from "./state.js";
import { getCustomToolbar, getCustomToolbarRow } from "./toolbar.js";

export class CoordinateSelectorButton {
  constructor(options) {
    const selector = createCoordinateSelectorButton(options);
    this.button = selector?.button;
    this._destroy = selector?.destroy;
  }

  static create(options) {
    return new CoordinateSelectorButton(options);
  }

  destroy() {
    this._destroy?.();
  }
}

function createCoordinateSelectorButton(options = {}) {
  const viewer = options.viewer ?? getViewer();
  const toolbar = getCustomToolbar(options, viewer);

  if (!viewer || !toolbar) {
    return undefined;
  }

  const toolbarRow = getCustomToolbarRow(toolbar);
  const button = document.createElement("button");
  const label = options.label ?? "Copy coordinates";
  let handler;
  let originalCanvasCursor;

  button.type = "button";
  button.className =
    "cesium-button cesium-toolbar-button extra-coordinate-selector-button";
  button.title =
    "Click, then pick a location in the Cesium view to copy coordinates (longitude, latitude).";
  button.setAttribute("aria-label", label);
  button.appendChild(createIcon());
  toolbarRow.insertBefore(button, toolbarRow.firstChild);

  function finish() {
    if (handler && !handler.isDestroyed()) {
      handler.destroy();
    }

    handler = undefined;
    button.disabled = false;
    viewer.scene.canvas.style.cursor = originalCanvasCursor ?? "";
    originalCanvasCursor = undefined;
    button.title =
      "Click, then pick a location in the Cesium view to copy coordinates (longitude, latitude).";
  }

  button.addEventListener("click", function () {
    if (handler) {
      return;
    }

    button.disabled = true;
    button.title = "Click the globe to copy coordinates.";
    originalCanvasCursor = viewer.scene.canvas.style.cursor;
    viewer.scene.canvas.style.cursor = "crosshair";
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(function (movement) {
      const cartesian = pickCartesian(viewer.scene, viewer.camera, movement.position);

      if (!Cesium.defined(cartesian)) {
        finish();
        return;
      }

      const coordinates = cartesianToCoordinates(cartesian);
      const text = formatCoordinates(coordinates, options.precision);

      finish();
      copyText(text, button);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  });

  return {
    button,
    destroy() {
      finish();
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
  path.setAttribute("d", coordinateSelectorPath);
  icon.appendChild(path);

  const checkPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  checkPath.setAttribute("class", "extra-coordinate-selector-button-check");
  checkPath.setAttribute("d", cameraButtonCheckPath);
  checkPath.style.display = "none";
  checkPath.style.fill = "#6fd36f";
  icon.appendChild(checkPath);

  return icon;
}
