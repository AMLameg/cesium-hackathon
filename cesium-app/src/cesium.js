Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1ZjRiNTQ2Ny1jN2M4LTRmZWEtODFkOS0wNzRlZjFjZDY0MGIiLCJpZCI6MzY4NzQzLCJzdWIiOiJBbmRyZXdHb29kc2VsbDIiLCJpc3MiOiJodHRwczovL2lvbi5jZXNpdW0uY29tIiwiYXVkIjoiVW50aXRsZWQiLCJpYXQiOjE3Nzg1OTYyMTN9.2SqfQ7XKDfelcFMfD5avwpw34-tNXhqxvNCQsN7Pghc";

(async function () {
  const viewer = new Cesium.Viewer("cesiumContainer", {
    timeline: false,
    animation: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    geocoder: false,
    terrain: Cesium.Terrain.fromWorldTerrain(),
  });

  const globe = viewer.scene.globe;

  const floodColor = Cesium.Color.fromCssColorString("#1CA9FF").withAlpha(0.5);
  const floodLineColor = Cesium.Color.CYAN.withAlpha(0.9);

  const roadColor = Cesium.Color.RED;
  const roadFillColor = Cesium.Color.RED.withAlpha(0.3);

  const glasgowDegrees = [
    [-4.35625669612491, 55.8731847589548],
    [-4.35253291808369, 55.8653549756238],
    [-4.35192982425291, 55.8720065987821],
    [-4.33744651889743, 55.8683325499811],
    [-4.32547784702566, 55.8677729769777],
    [-4.29934869386483, 55.8612990174254],
    [-4.2779123168581, 55.8558165656657],
    [-4.25807492984839, 55.854957412248],
    [-4.2377996534273, 55.8482236697675],
    [-4.22548763203423, 55.8121725756559],
    [-4.21132985427356, 55.8003122929573],
    [-4.2239299554509, 55.7919439430514],
    [-4.25074133389326, 55.7848855982471],
    [-4.29262476699183, 55.8139355837997],
    [-4.32726006845437, 55.8076304835789],
    [-4.37205926650633, 55.7947648905033],
    [-4.38141361086496, 55.8231478427811],
    [-4.3680292909692, 55.8454395560155],
    [-4.38087255317914, 55.8563416379371],
    [-4.36048350183906, 55.8608320342443],
    [-4.35625669612491, 55.8731847589548],
  ];

  const glasgowBoundary = Cesium.Cartesian3.fromDegreesArray(
    glasgowDegrees.flat()
  );

  function pointInPolygon(lon, lat, polygon) {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];

      const intersect =
        yi > lat !== yj > lat &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  function cartesianInsideBoundary(cartesian) {
    const c = Cesium.Cartographic.fromCartesian(cartesian);
    const lon = Cesium.Math.toDegrees(c.longitude);
    const lat = Cesium.Math.toDegrees(c.latitude);

    return pointInPolygon(lon, lat, glasgowDegrees);
  }

  function entityInsideBoundary(entity) {
    const time = Cesium.JulianDate.now();

    if (entity.position) {
      const position = entity.position.getValue(time);
      return position && cartesianInsideBoundary(position);
    }

    if (entity.polyline?.positions) {
      const positions = entity.polyline.positions.getValue(time) || [];
      return positions.some(cartesianInsideBoundary);
    }

    if (entity.polygon?.hierarchy) {
      const hierarchy = entity.polygon.hierarchy.getValue(time);
      const positions = hierarchy?.positions || [];

      if (positions.some(cartesianInsideBoundary)) return true;

      if (positions.length) {
        const sphere = Cesium.BoundingSphere.fromPoints(positions);
        return cartesianInsideBoundary(sphere.center);
      }
    }

    return false;
  }

  function createGlasgowClippingPolygons() {
    return new Cesium.ClippingPolygonCollection({
      polygons: [
        new Cesium.ClippingPolygon({
          positions: glasgowBoundary,
        }),
      ],
      inverse: true,
    });
  }

  const globeClippingPolygons = createGlasgowClippingPolygons();

  globe.clippingPolygons = globeClippingPolygons;
  globe.showSkirts = false;
  globe.backFaceCulling = false;
  globe.undergroundColor = undefined;

  viewer.scene.skyAtmosphere.show = true;

  try {
    const googleTileset = await Cesium.createGooglePhotorealistic3DTileset({
      onlyUsingWithGoogleGeocoder: true,
    });

    googleTileset.clippingPolygons = createGlasgowClippingPolygons();

    viewer.scene.primitives.add(googleTileset);
  } catch (error) {
    console.error("Google Photorealistic 3D Tiles failed:", error);
  }

  async function loadFloodAsset(assetId, label) {
    try {
      const resource = await Cesium.IonResource.fromAssetId(assetId);

      const floodData = await Cesium.GeoJsonDataSource.load(resource, {
        clampToGround: true,
      });

      await viewer.dataSources.add(floodData);

      floodData.entities.values.slice().forEach((entity) => {
        if (!entityInsideBoundary(entity)) {
          floodData.entities.remove(entity);
          return;
        }

        if (entity.polygon) {
          entity.polygon.material = floodColor;
          entity.polygon.outline = false;
          entity.polygon.classificationType = Cesium.ClassificationType.BOTH;
        }

        if (entity.polyline) {
          entity.polyline.material = floodLineColor;
          entity.polyline.width = 4;
          entity.polyline.clampToGround = true;
        }

        if (entity.point) {
          entity.point.color = floodColor;
          entity.point.pixelSize = 8;
          entity.point.heightReference =
            Cesium.HeightReference.CLAMP_TO_GROUND;
        }
      });

      console.log(`${label} loaded`);
    } catch (error) {
      console.error(`Error loading ${label}:`, error);
    }
  }

  await loadFloodAsset(4773433, "Flood asset 4773433");
  await loadFloodAsset(4773439, "Flood asset 4773439");

  try {
    const roads = await Cesium.GeoJsonDataSource.load(
      "../public/glasgow.geojson",
      {
        clampToGround: true,
      }
    );

    roads.entities.suspendEvents();

    roads.entities.values.slice().forEach((road) => {
      if (!entityInsideBoundary(road)) {
        roads.entities.remove(road);
        return;
      }

      road.billboard = undefined;

      if (road.polygon) {
        road.polygon.material = roadFillColor;
        road.polygon.outline = true;
        road.polygon.outlineColor = roadColor;
      }

      if (road.polyline) {
        road.polyline.material = roadColor;
        road.polyline.width = 3;
        road.polyline.clampToGround = true;
      }
    });

    roads.entities.resumeEvents();
    await viewer.dataSources.add(roads);

    console.log("Roads loaded");
  } catch (error) {
    console.error("Error loading roads:", error);
  }

  try {
    const response = await fetch("../public/glasgow_chargers.csv");
    const evcData = await response.text();

    const rows = evcData.split("\n").slice(1);

    rows.forEach((row) => {
      const cols = row.split(",");

      if (cols.length < 5) return;

      const lat = parseFloat(cols[0]);
      const lon = parseFloat(cols[1]);
      const id = cols[2];
      const power = cols[3];
      const connectorId = cols[4];

      if (Number.isNaN(lat) || Number.isNaN(lon)) return;

      if (!pointInPolygon(lon, lat, glasgowDegrees)) return;

      viewer.entities.add({
        name: `Charger: ${id}`,

        position: Cesium.Cartesian3.fromDegrees(lon, lat),

        billboard: {
          image:
            "https://cdn-icons-png.flaticon.com/512/5343/5343963.png",

          scale: 0.05,

          scaleByDistance: new Cesium.NearFarScalar(
            500,
            0.12,
            5000,
            0.04
          ),

          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,

          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,

          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },

        description: `
          <table class="cesium-infoBox-defaultTable">
            <tr><th>Power</th><td>${power} kW</td></tr>
            <tr><th>Connector ID</th><td>${connectorId}</td></tr>
          </table>
        `,
      });
    });

    console.log("Visible charger icons loaded");
  } catch (error) {
    console.error("Error loading chargers CSV:", error);
  }

  viewer.entities.add({
    polygon: {
      hierarchy: glasgowBoundary,
      material: Cesium.Color.WHITE.withAlpha(0.04),
      outline: true,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 4,
    },
  });

  viewer.entities.add({
    polyline: {
      positions: glasgowBoundary,
      width: 4,
      material: Cesium.Color.WHITE,
      clampToGround: true,
    },
  });

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-4.2518, 55.8642, 1200),

    orientation: {
      heading: Cesium.Math.toRadians(20),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0,
    },

    duration: 4,
  });
})();
