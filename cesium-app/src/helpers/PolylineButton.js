import * as Cesium from "cesium";
import {
  cameraButtonCheckPath,
  polylineSelectorPath,
} from "./constants.js";
import { copyText } from "./clipboard.js";
import { cartesianToCoordinates, pickCartesian } from "./cesiumUtils.js";
import { ensureMarkerSelectionSuppression } from "./marker.js";
import { getViewer } from "./state.js";
import { getCustomToolbar, getCustomToolbarRow } from "./toolbar.js";

export class PolylineButton {
  constructor(options) {
    const selector = createPolylineButton(options);
    this.button = selector?.button;
    this._destroy = selector?.destroy;
  }

  static create(options) {
    return new PolylineButton(options);
  }

  destroy() {
    this._destroy?.();
  }
}

function createPolylineButton(options = {}) {
  const viewer = options.viewer ?? getViewer();
  const toolbar = getCustomToolbar(options, viewer);

  if (!viewer || !toolbar) {
    return undefined;
  }

  const toolbarRow = getCustomToolbarRow(toolbar);
  const button = document.createElement("button");
  const label = options.label ?? "Copy polyline";
  let handler;
  let originalCanvasCursor;
  let positions = [];
  let cursorPosition;
  let temporaryEntities = [];
  let polylineEntity;

  button.type = "button";
  button.className = "cesium-button cesium-toolbar-button extra-polyline-button";
  button.title =
    "Click to start drawing a polyline, then click this button again to copy coordinates as JSON.";
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", "false");
  button.appendChild(createIcon());
  toolbarRow.insertBefore(button, toolbarRow.firstChild);

  function removeTemporaryEntities() {
    temporaryEntities.forEach(function (entity) {
      viewer.entities.remove(entity);
    });
    temporaryEntities = [];
    polylineEntity = undefined;
  }

  function reset() {
    if (handler && !handler.isDestroyed()) {
      handler.destroy();
    }

    handler = undefined;
    positions = [];
    cursorPosition = undefined;
    removeTemporaryEntities();
    button.classList.remove("is-active");
    button.setAttribute("aria-pressed", "false");
    viewer.scene.canvas.style.cursor = originalCanvasCursor ?? "";
    originalCanvasCursor = undefined;
    button.title =
      "Click to start drawing a polyline, then click this button again to copy coordinates as JSON.";
  }

  function addTemporaryPoint(cartesian) {
    const entity = viewer.entities.add({
      position: cartesian,
      point: {
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        pixelSize: 10,
        heightReference: Cesium.HeightReference.NONE,
      },
    });

    entity._extraHelpersSuppressInfoBox = true;
    temporaryEntities.push(entity);
  }

  function createTemporaryPolyline() {
    polylineEntity = viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(function () {
          if (positions.length === 0) {
            return [];
          }

          if (Cesium.defined(cursorPosition)) {
            return positions.concat(cursorPosition);
          }

          return positions;
        }, false),
        width: 3,
        material: Cesium.Color.CYAN,
        clampToGround: false,
      },
    });

    polylineEntity._extraHelpersSuppressInfoBox = true;
    temporaryEntities.push(polylineEntity);
  }

  function startDrawing() {
    button.classList.add("is-active");
    button.setAttribute("aria-pressed", "true");
    button.title = "Click points in the Cesium view. Click this button to copy JSON.";
    originalCanvasCursor = viewer.scene.canvas.style.cursor;
    viewer.scene.canvas.style.cursor = "crosshair";
    positions = [];
    cursorPosition = undefined;
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    ensureMarkerSelectionSuppression(viewer);
    createTemporaryPolyline();

    handler.setInputAction(function (movement) {
      const cartesian = pickCartesian(
        viewer.scene,
        viewer.camera,
        movement.position,
      );

      if (!Cesium.defined(cartesian)) {
        return;
      }

      cursorPosition = undefined;
      addTemporaryPoint(cartesian);
      positions.push(Cesium.Cartesian3.clone(cartesian));
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(function (movement) {
      cursorPosition = pickCartesian(
        viewer.scene,
        viewer.camera,
        movement.endPosition,
      );
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }

  button.addEventListener("click", function () {
    if (!handler) {
      startDrawing();
      return;
    }

    const text = createPolylineGeoJson(positions, options.precision);
    reset();
    copyText(text, button);
  });

  return {
    button,
    destroy() {
      reset();
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
  path.setAttribute("d", polylineSelectorPath);
  path.setAttribute("transform", "translate(3 3)");
  icon.appendChild(path);

  const checkPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  checkPath.setAttribute("class", "extra-polyline-button-check");
  checkPath.setAttribute("d", cameraButtonCheckPath);
  checkPath.style.display = "none";
  checkPath.style.fill = "#6fd36f";
  icon.appendChild(checkPath);

  return icon;
}

function createPolylineGeoJson(cartesians, precision = 6) {
  const geojson = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: cartesians.map(function (cartesian) {
        const coordinate = cartesianToCoordinates(cartesian);

        return [
          roundCoordinate(coordinate.longitude, precision),
          roundCoordinate(coordinate.latitude, precision),
        ];
      }),
    },
    properties: {},
  };

  return JSON.stringify(geojson, null, 2);
}

function roundCoordinate(value, precision) {
  return Number(value.toFixed(precision));
}
