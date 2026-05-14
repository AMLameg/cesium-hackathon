import * as Cesium from "cesium";
import * as Helpers from "./Helpers/index.js";

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

  Helpers.setViewer(viewer);

  const globe = viewer.scene.globe;

  const floodColor = Cesium.Color.fromCssColorString("#1CA9FF").withAlpha(0.5);
  const floodLineColor = Cesium.Color.CYAN.withAlpha(0.9);

  const roadColor = Cesium.Color.RED.withAlpha(0.55);
  const roadFillColor = Cesium.Color.RED.withAlpha(0.15);

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

  globe.clippingPolygons = createGlasgowClippingPolygons();
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
          entity.point.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
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
      { clampToGround: true }
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
        road.polyline.width = 1.5;
        road.polyline.clampToGround = true;
      }
    });

    roads.entities.resumeEvents();
    await viewer.dataSources.add(roads);

    console.log("Roads loaded");
  } catch (error) {
    console.error("Error loading roads:", error);
  }

  let chargerCount = 0;

  try {
    const response = await fetch("../public/glasgow_chargers.csv");

    if (!response.ok) {
      throw new Error(`CSV failed to load: ${response.status}`);
    }

    const evcData = await response.text();
    const lines = evcData.trim().split(/\r?\n/);

    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(delimiter).map((h) => h.trim());

    const latIndex = headers.indexOf("latitude");
    const lonIndex = headers.indexOf("longitude");
    const idIndex = headers.indexOf("cp_id_str");
    const powerIndex = headers.indexOf("Power_kW");
    const connectorIndex = headers.indexOf("connector_id");

    if (latIndex === -1 || lonIndex === -1) {
      throw new Error("Could not find latitude/longitude columns in CSV");
    }

    const rows = lines.slice(1);

    rows.forEach((row) => {
      const cols = row.split(delimiter).map((c) => c.trim());

      const lat = parseFloat(cols[latIndex]);
      const lon = parseFloat(cols[lonIndex]);

      if (Number.isNaN(lat) || Number.isNaN(lon)) return;
      if (!pointInPolygon(lon, lat, glasgowDegrees)) return;

      const id = cols[idIndex] || "Unknown";
      const power = cols[powerIndex] || "Unknown";
      const connectorId = cols[connectorIndex] || "Unknown";

      chargerCount++;

      Helpers.Window.create({
        title: `Charging Status: ${id}`,
        type: "url",
        content:
          "https://grafana.imic.lt/dashboard/snapshot/1Q2uiBJFtAzL1ldGHSoNbx6v9TSSNxMq",
        marker: {
          coordinates: {
            longitude: lon,
            latitude: lat,
            height: 0,
          },
          color: "#cfca3a",
          style: "car",
          showWindowWhen: "markerPressed",
        },
      });
    });

    console.log("Helper EV markers inside Glasgow added:", chargerCount);
  } catch (error) {
    console.error("Error loading chargers CSV:", error);
  }

  viewer.entities.add({
    polygon: {
      hierarchy: glasgowBoundary,
      material: Cesium.Color.WHITE.withAlpha(0.03),
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
    destination: Cesium.Rectangle.fromCartesianArray(glasgowBoundary),
    duration: 3,
  });

  async function spawncar(){
  const carPlaceholder = viewer.entities.add({
    name: 'Car Placeholder',
    position: Cesium.Cartesian3.fromDegrees(-4.2518, 55.8642),
    // Orientation is needed so the box turns with the road
    orientation: Cesium.Transforms.headingPitchRollQuaternion(
      Cesium.Cartesian3.fromDegrees(-4.2518, 55.8642),
      new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(45), 0, 0)
    ),
    box: {
      dimensions: new Cesium.Cartesian3(4.5, 2.0, 1.5), // Length, Width, Height in meters
      material: Cesium.Color.RED.withAlpha(0.8),
      outline: true,
      outlineColor: Cesium.Color.BLACK,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  });

  return carPlaceholder;
}

// ai-gen code for graph building
const response = await fetch('../public/glasgow.geojson');
const road_geojson = await response.json();
let routingGraph = buildRoutingGraphFromGeoJson(road_geojson);

console.log(routingGraph);

function buildRoutingGraphFromGeoJson(geojson) {
  const nodes = new Map();   // coordKey → { lat, lon, id }
  const adjacency = new Map(); // nodeId → [{ nodeId, distance, coords }]
  let nodeIdCounter = 0;

  // Stable key for a coordinate pair
  const coordKey = (lon, lat) => `${lon.toFixed(7)},${lat.toFixed(7)}`;

  const getOrCreateNode = (lon, lat) => {
    const key = coordKey(lon, lat);
    if (!nodes.has(key)) {
      nodes.set(key, { id: key, lat, lon });
    }
    return key;
  };

  const ROUTABLE = new Set([
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "residential", "service", "unclassified", "living_street",
    "motorway_link", "trunk_link", "primary_link", "secondary_link",
  ]);
  for (const feature of geojson.features) {
    const { geometry, properties } = feature;

    // Skip non-routable features
    if (properties.highway && !ROUTABLE.has(properties.highway)) continue;

    const isOneWay = properties.oneway === "yes" ||
                     properties.oneway === "1"   ||
                     properties.junction === "roundabout";

    // Handle both LineString and MultiLineString
    const lines =
      geometry.type === "LineString"      ? [geometry.coordinates]      :
      geometry.type === "MultiLineString" ? geometry.coordinates         : [];

    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const [lon1, lat1] = line[i];
        const [lon2, lat2] = line[i + 1];

        const fromId = getOrCreateNode(lon1, lat1);
        const toId   = getOrCreateNode(lon2, lat2);
        const dist   = haversineDistance({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 });

        addEdge(adjacency, fromId, toId, dist);
        if (!isOneWay) addEdge(adjacency, toId, fromId, dist);
      }
    }
  }

  return { nodes, adjacency };
}

function addEdge(adjacency, fromId, toId, distance) {
  if (!adjacency.has(fromId)) adjacency.set(fromId, []);
  adjacency.get(fromId).push({ nodeId: toId, distance });
}
// Haversine distance in metres between two {lat,lon} points
function haversineDistance(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// routing

function astar(adjacency, nodes, startId, endId) {
  const end = nodes.get(endId);

  // Heuristic: straight-line distance to goal
  const h = (nodeId) => {
    const n = nodes.get(nodeId);
    return n ? haversineDistance(n, end) : Infinity;
  };

  const gScore = new Map([[startId, 0]]);
  const fScore = new Map([[startId, h(startId)]]);
  const cameFrom = new Map();
  const open = new Set([startId]);

  while (open.size > 0) {
    // Pick node in open with lowest fScore
    const current = [...open].reduce((a, b) =>
      (fScore.get(a) ?? Infinity) < (fScore.get(b) ?? Infinity) ? a : b
    );

    if (current === endId) return reconstructPath(cameFrom, endId, adjacency, nodes);

    open.delete(current);

    for (const { nodeId: neighbour, distance } of adjacency.get(current) ?? []) {
      const tentative = (gScore.get(current) ?? Infinity) + distance;

      if (tentative < (gScore.get(neighbour) ?? Infinity)) {
        cameFrom.set(neighbour, current);
        gScore.set(neighbour, tentative);
        fScore.set(neighbour, tentative + h(neighbour));
        open.add(neighbour);
      }
    }
  }
  console.log('No path found')
  return null; // No path found
}

function reconstructPath(cameFrom, endId, adjacency, nodes) {
  const nodeIds = [endId];
  let current = endId;

  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    nodeIds.unshift(current);
  }

  // Expand node IDs to [lon, lat] coordinate arrays
  return nodeIds.map(id => {
    const n = nodes.get(id);
    return [n.lon, n.lat];
  });
}

function nearestNode(nodes, lat, lon) {
  let bestId = null;
  let bestDist = Infinity;

  for (const [id, node] of nodes) {
    const dist = haversineDistance({ lat, lon }, node);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = id;
    }
  }

  return bestId;
}

function animateVehicle(viewer, routeCoords, speedMetresPerSecond = 13.9) {
  const start = Cesium.JulianDate.now();
  const positions = new Cesium.SampledPositionProperty();
  positions.setInterpolationOptions({
    interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
    interpolationDegree: 2,
  });

  let elapsed = 0;

  for (let i = 0; i < routeCoords.length; i++) {
    if (i > 0) {
      const [lon1, lat1] = routeCoords[i - 1];
      const [lon2, lat2] = routeCoords[i];
      elapsed += haversineDistance({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 })
                 / speedMetresPerSecond;
    }

    const time = Cesium.JulianDate.addSeconds(start, elapsed, new Cesium.JulianDate());
    const pos  = Cesium.Cartesian3.fromDegrees(routeCoords[i][0], routeCoords[i][1], 2);
    positions.addSample(time, pos);
  }

  const end = Cesium.JulianDate.addSeconds(start, elapsed, new Cesium.JulianDate());

  const vehicle = viewer.entities.add({
    availability: new Cesium.TimeIntervalCollection([
      new Cesium.TimeInterval({ start, stop: end }),
    ]),
    position: positions,
    orientation: new Cesium.VelocityOrientationProperty(positions),
    point: {
      pixelSize: 14,
      color: Cesium.Color.LIME,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  // Drive the clock
  viewer.clock.startTime    = start;
  viewer.clock.stopTime     = end;
  viewer.clock.currentTime  = Cesium.JulianDate.clone(start);
  viewer.clock.multiplier   = 1;
  viewer.clock.clockRange   = Cesium.ClockRange.LOOP_STOP;
  viewer.clock.shouldAnimate = true;
  viewer.timeline?.zoomTo(start, end);

  // Fly to the vehicle first, then lock on
  viewer.flyTo(vehicle, {
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(0),   // heading: match vehicle direction
      Cesium.Math.toRadians(-45), // pitch: looking down at 45°
      120                         // range: 120m behind/above
    ),
  }).then(() => {
    // Lock camera to vehicle — it will follow automatically from here
    viewer.trackedEntity = vehicle;
  });

  // Unlock camera when the vehicle finishes its route
  const removeListener = viewer.clock.onTick.addEventListener(() => {
    if (Cesium.JulianDate.compare(viewer.clock.currentTime, end) >= 0) {
      viewer.trackedEntity = undefined;
      removeListener();
    }
  });

  return vehicle;
}

function routeAndAnimate(fromLat, fromLon, toLat, toLon) {
  if (!routingGraph) return console.warn("Routing graph not ready");

  const { nodes, adjacency } = routingGraph;

  const startId = nearestNode(nodes, fromLat, fromLon);
  const endId   = nearestNode(nodes, toLat, toLon);
  const route   = astar(adjacency, nodes, startId, endId);

  if (!route) return console.warn("No route found");

  animateVehicle(viewer, route);
}


async function pointsOfInterest(){
  const response = await fetch('../public/poi.json');
  const data = await response.json();

  const poiMap = new Map(data.map(poi => [poi.name, poi]));
  return poiMap;
}

function getRandomN(poiMap,count) {
    return [...poiMap.values()]
        .sort(() => Math.random() - 0.5)
        .slice(0, count);                  
}

async function fetchPoIs(count){
  const poi = await pointsOfInterest();
  const randomPois = getRandomN(poi,count);

  console.log(randomPois)

  return randomPois;
}

// get some pois
fetchPoIs(5)

// this needs to be a button and the coordinates need to be dynamic
routeAndAnimate(55.8609, -4.2514, 55.8580, -4.2572);



// Fly to Glasgow
// viewer.camera.flyTo({
//   destination: Cesium.Cartesian3.fromDegrees(-4.2514, 55.8609, 1200),
//   orientation: {
//     heading: Cesium.Math.toRadians(20),
//     pitch: Cesium.Math.toRadians(-35),
//     roll: 0,
//   },
//   duration: 4,
// });

})();
