import { Viewer, GeoJsonDataSource, Color } from 'cesium';
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

// Init colours
const hotpink_mod1 = Cesium.Color.HOTPINK.withAlpha(1.0);
const hotpink = Cesium.Color.HOTPINK;
const white = Cesium.Color.WHITE
const red_mod1 = Color.RED.withAlpha(0.3);
const red = Color.RED;

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


const roads = await Cesium.GeoJsonDataSource.load('../public/glasgow.geojson', {     
    clampToGround: true,
    infoBox: false
  });

roads.entities.suspendEvents();

const road_entities = roads.entities.values;
road_entities.forEach((road) => {
    road.stroke = red,
    road.strokeWidth =  3,       
    road.fill = red_mod1
});
roads.entities.resumeEvents();
await viewer.dataSources.add(roads);

const foo = await fetch('/../public/glasgow_chargers.csv')
const evc_data = await foo.text()

const rows = evc_data.split('\n').slice(1);

rows.forEach((row) => {
    const cols = row.split(',');
    if (cols.length < 2) return; 

    const lat          = parseFloat(cols[0]);
    const lon          = parseFloat(cols[1]);
    const id           = cols[2];
    const power        = cols[3];
    const connectorId  = cols[4];

    viewer.entities.add({
      name: `Charger: ${id}`,
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: {
        pixelSize: 50,
        color: Cesium.Color.ORANGE,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },

      description: `
        <table class="cesium-infoBox-defaultTable">
          <tr><th>Power</th><td>${power} kW</td></tr>
          <tr><th>Connector ID</th><td>${connectorId}</td></tr>
        </table>
      `
    });
  });

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