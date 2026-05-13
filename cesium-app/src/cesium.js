import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1ZjRiNTQ2Ny1jN2M4LTRmZWEtODFkOS0wNzRlZjFjZDY0MGIiLCJpZCI6MzY4NzQzLCJzdWIiOiJBbmRyZXdHb29kc2VsbDIiLCJpc3MiOiJodHRwczovL2lvbi5jZXNpdW0uY29tIiwiYXVkIjoiVW50aXRsZWQiLCJpYXQiOjE3Nzg1OTYyMTN9.2SqfQ7XKDfelcFMfD5avwpw34-tNXhqxvNCQsN7Pghc';

const viewer = new Cesium.Viewer("cesiumContainer", {
  timeline: false,
  animation: false,
  sceneModePicker: false,
  baseLayerPicker: false,
  geocoder: Cesium.IonGeocodeProviderType.GOOGLE,
  globe: false,
});

// Enable sky/atmosphere rendering
viewer.scene.skyAtmosphere.show = true;

try {
  const tileset = await Cesium.createGooglePhotorealistic3DTileset({
    onlyUsingWithGoogleGeocoder: true,
  });
  viewer.scene.primitives.add(tileset);

  const resource = await Cesium.IonResource.fromAssetId(4773439);
  const dataSource = await Cesium.GeoJsonDataSource.load(resource, {
    clampToGround: true,
  });

  // suspend and resume are here for optimisation reasons >> ref: https://cesium.com/learn/ion-sdk/ref-doc/EntityCollection.html , https://community.cesium.com/t/what-is-the-best-way-to-update-1000-entity-positon-10times-per-second/15992/2
  dataSource.entities.suspendEvents()

  const entities = dataSource.entities.values;
  const hotpink_mod1 = Cesium.Color.HOTPINK.withAlpha(1.0);
  const hotpink = Cesium.Color.HOTPINK;
  const white = Cesium.Color.WHITE
  for (const entity of entities) {

    if (entity.polygon) {
      entity.polygon.material = hotpink_mod1;
      entity.polygon.outline = true;
      entity.polygon.outlineColor = white;
    }

    if (entity.polyline) {
      entity.polyline.material = hotpink;
      entity.polyline.width = 4;
    }

    if (entity.point) {
      entity.point.color = hotpink;
      entity.point.pixelSize = 10;
    }
  }

  dataSource.entities.resumeEvents();
  await viewer.dataSources.add(dataSource);

  console.log("GeoJSON asset loaded");
} catch (error) {
  console.error("Error loading Cesium content:", error);
}

// Fly to Glasgow
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(-4.2518, 55.8642, 1200),
  orientation: {
    heading: Cesium.Math.toRadians(20),
    pitch: Cesium.Math.toRadians(-35),
    roll: 0,
  },
  duration: 4,
});