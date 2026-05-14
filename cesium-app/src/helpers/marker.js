import * as Cesium from "cesium";
import { getCesiumColor, normalizeCoordinates } from "./cesiumUtils.js";
import { getViewer } from "./state.js";

const markerSelectionViewers = new WeakSet();

export function createMarkerEntity(marker) {
  const viewer = getViewer();
  const coordinates = normalizeCoordinates(marker?.coordinates);

  if (!viewer || !coordinates) {
    return undefined;
  }

  const position = Cesium.Cartesian3.fromDegrees(
    coordinates.longitude,
    coordinates.latitude,
    coordinates.height,
  );
  const entity = viewer.entities.add({
    position,
    billboard: {
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference:
        coordinates.height === 0
          ? Cesium.HeightReference.CLAMP_TO_GROUND
          : Cesium.HeightReference.NONE,
    },
  });
  entity._extraHelpersSuppressInfoBox = true;
  ensureMarkerSelectionSuppression(viewer);

  Promise.resolve(createMarkerImage(marker)).then(function (image) {
    if (viewer.entities.contains(entity)) {
      entity.billboard.image = image;
    }
  });

  return { entity, position, viewer };
}

export function ensureMarkerSelectionSuppression(viewer) {
  if (markerSelectionViewers.has(viewer)) {
    return;
  }

  markerSelectionViewers.add(viewer);
  const leftClickAction = viewer.screenSpaceEventHandler.getInputAction(
    Cesium.ScreenSpaceEventType.LEFT_CLICK,
  );

  viewer.screenSpaceEventHandler.setInputAction(function (movement) {
    const pickedObject = viewer.scene.pick(movement.position);

    if (pickedObject?.id?._extraHelpersSuppressInfoBox) {
      viewer.selectedEntity = undefined;
      return;
    }

    leftClickAction?.(movement);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  viewer.selectedEntityChanged.addEventListener(function (entity) {
    if (entity?._extraHelpersSuppressInfoBox) {
      viewer.selectedEntity = undefined;
    }
  });
}

function createMarkerImage(marker = {}) {
  const pinBuilder = new Cesium.PinBuilder();
  const color = getCesiumColor(marker.color);
  const size = 48;

  if (marker.style?.trim()) {
    return Promise.resolve(
      pinBuilder.fromMakiIconId(marker.style.trim(), color, size),
    ).catch(function () {
      return pinBuilder.fromColor(color, size);
    });
  }

  return pinBuilder.fromColor(color, size);
}
