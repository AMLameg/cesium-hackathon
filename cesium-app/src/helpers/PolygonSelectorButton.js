import * as Cesium from "cesium";
import {
  cameraButtonCheckPath,
  polygonSelectorPath,
} from "./constants.js";
import { copyText } from "./clipboard.js";
import { formatNumber, pickCartesian } from "./cesiumUtils.js";
import { ensureMarkerSelectionSuppression } from "./marker.js";
import { getViewer } from "./state.js";
import { getCustomToolbar, getCustomToolbarRow } from "./toolbar.js";

export class PolygonSelectorButton {
  constructor(options) {
    const selector = createPolygonSelectorButton(options);
    this.button = selector?.button;
    this._destroy = selector?.destroy;
  }

  static create(options) {
    return new PolygonSelectorButton(options);
  }

  destroy() {
    this._destroy?.();
  }
}

function createPolygonSelectorButton(options = {}) {
  const viewer = options.viewer ?? getViewer();
  const toolbar = getCustomToolbar(options, viewer);

  if (!viewer || !toolbar) {
    return undefined;
  }

  const toolbarRow = getCustomToolbarRow(toolbar);
  const button = document.createElement("button");
  const label = options.label ?? "Copy polygon";
  const completeMinPoints = 3;
  let handler;
  let originalCanvasCursor;
  let positions = [];
  let cursorPosition;
  let temporaryEntities = [];
  let startEntity;
  let polylineEntity;

  button.type = "button";
  button.className =
    "cesium-button cesium-toolbar-button extra-polygon-selector-button";
  button.title =
    "Click, then pick polygon vertices in the Cesium view. Click the starting point to copy polygon code.";
  button.setAttribute("aria-label", label);
  button.appendChild(createIcon());
  toolbarRow.insertBefore(button, toolbarRow.firstChild);

  function removeTemporaryEntities() {
    temporaryEntities.forEach(function (entity) {
      viewer.entities.remove(entity);
    });
    temporaryEntities = [];
    startEntity = undefined;
    polylineEntity = undefined;
  }

  function finish() {
    if (handler && !handler.isDestroyed()) {
      handler.destroy();
    }

    handler = undefined;
    positions = [];
    cursorPosition = undefined;
    removeTemporaryEntities();
    button.disabled = false;
    viewer.scene.canvas.style.cursor = originalCanvasCursor ?? "";
    originalCanvasCursor = undefined;
    button.title =
      "Click, then pick polygon vertices in the Cesium view. Click the starting point to copy polygon code.";
  }

  function addTemporaryPoint(cartesian) {
    const isStart = positions.length === 0;
    const entity = viewer.entities.add({
      position: cartesian,
      point: {
        color: isStart ? Cesium.Color.WHITE : Cesium.Color.YELLOW,
        outlineColor: isStart ? Cesium.Color.LIME : Cesium.Color.BLACK,
        outlineWidth: isStart ? 4 : 2,
        pixelSize: isStart ? 16 : 10,
        heightReference: Cesium.HeightReference.NONE,
      },
    });

    entity._extraHelpersSuppressInfoBox = true;

    if (isStart) {
      entity._extraHelpersPolygonStart = true;
      startEntity = entity;

      const hitEntity = viewer.entities.add({
        position: cartesian,
        point: {
          color: Cesium.Color.WHITE.withAlpha(0.01),
          outlineColor: Cesium.Color.WHITE.withAlpha(0.01),
          outlineWidth: 0,
          pixelSize: 34,
          heightReference: Cesium.HeightReference.NONE,
        },
      });

      hitEntity._extraHelpersSuppressInfoBox = true;
      hitEntity._extraHelpersPolygonStart = true;
      temporaryEntities.push(hitEntity);
    }

    temporaryEntities.push(entity);
  }

  function pickPolygonStart(position) {
    return viewer.scene
      .drillPick(position, undefined, 18, 18)
      .some(function (pickedObject) {
        return pickedObject?.id?._extraHelpersPolygonStart;
      });
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
        material: Cesium.Color.YELLOW,
        clampToGround: false,
      },
    });

    polylineEntity._extraHelpersSuppressInfoBox = true;
    temporaryEntities.push(polylineEntity);
  }

  button.addEventListener("click", function () {
    if (handler) {
      return;
    }

    button.disabled = true;
    button.title = "Click polygon vertices. Click the starting point to copy.";
    originalCanvasCursor = viewer.scene.canvas.style.cursor;
    viewer.scene.canvas.style.cursor = "crosshair";
    positions = [];
    cursorPosition = undefined;
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    ensureMarkerSelectionSuppression(viewer);
    createTemporaryPolyline();

    handler.setInputAction(function (movement) {
      const pickedObject = viewer.scene.pick(movement.position);

      if (
        positions.length >= completeMinPoints &&
        (pickedObject?.id === startEntity || pickPolygonStart(movement.position))
      ) {
        const text = createPolygonSnippet(positions);
        finish();
        copyText(text, button);
        return;
      }

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

      if (positions.length < completeMinPoints) {
        viewer.scene.canvas.style.cursor = "crosshair";
        return;
      }

      const pickedObject = viewer.scene.pick(movement.endPosition);
      viewer.scene.canvas.style.cursor =
        pickedObject?.id === startEntity || pickPolygonStart(movement.endPosition)
          ? "pointer"
          : "crosshair";
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
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
  icon.setAttribute("viewBox", "0 0 100 100");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", polygonSelectorPath);
  path.setAttribute("transform", "translate(10 10) scale(0.8)");
  icon.appendChild(path);

  const checkPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  checkPath.setAttribute("class", "extra-polygon-selector-button-check");
  checkPath.setAttribute("d", cameraButtonCheckPath);
  checkPath.setAttribute("transform", "scale(3.3333333333)");
  checkPath.style.display = "none";
  checkPath.style.fill = "#6fd36f";
  icon.appendChild(checkPath);

  return icon;
}

function createPolygonSnippet(cartesians) {
  const positions = cartesians
    .map(function (cartesian) {
      return `      new Cesium.Cartesian3(${formatNumber(cartesian.x)}, ${formatNumber(cartesian.y)}, ${formatNumber(cartesian.z)}),`;
    })
    .join("\n");

  return `viewer.entities.add({
  polygon: {
    hierarchy: new Cesium.PolygonHierarchy([
${positions}
    ]),
    material: Cesium.Color.RED.withAlpha(0.5),
    classificationType: Cesium.ClassificationType.BOTH,
  },
});`;
}
