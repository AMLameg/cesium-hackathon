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
    road.billboard = undefined; // do not touch; enabling this makes the app slow asf
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
        pixelSize: 200,
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

// ai-gen code for graph building
const response = await fetch('../public/glasgow.geojson');
const road_geojson = await response.json();
let routingGraph = buildRoutingGraphFromGeoJson(road_geojson);

console.log(routingGraph);

async function spawnVehicle(poiMap, startName, endName) {
    // 1. Get the coordinates from your Map
    const startPOI = poiMap.get(startName);
    const endPOI = poiMap.get(endName);

    if (!startPOI || !endPOI) {
        console.error("One of the POIs was not found in the map!");
        return;
    }

    // 2. Set the timing (Start now, arrive in 30 seconds)
    const startTime = Cesium.JulianDate.now();
    const stopTime = Cesium.JulianDate.addSeconds(startTime, 30, new Cesium.JulianDate());

    // 3. Create the position property
    const position = new Cesium.SampledPositionProperty();

    // Start point
    const startPos = Cesium.Cartesian3.fromDegrees(startPOI.longitude, startPOI.latitude);
    position.addSample(startTime, startPos);

    // Stop point
    const endPos = Cesium.Cartesian3.fromDegrees(endPOI.longitude, endPOI.latitude);
    position.addSample(stopTime, endPos);

    // 4. Create the Vehicle Entity
    const vehicle = viewer.entities.add({
        name: `Travel from ${startName} to ${endName}`,
        availability: new Cesium.TimeIntervalCollection([
            new Cesium.TimeInterval({ start: startTime, stop: stopTime })
        ]),
        position: position,
        // Automatically calculate orientation (heading) based on movement
        orientation: new Cesium.VelocityOrientationProperty(position),
        model: {
            uri: '../public/models/GroundVehicle.glb', // Path to a 3D model
            minimumPixelSize: 64
        },
        path: {
            resolution: 1,
            material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.1,
                color: Cesium.Color.YELLOW
            }),
            width: 10
        }
    });

    // Make the timeline track this vehicle
    viewer.clock.startTime = startTime.clone();
    viewer.clock.stopTime = stopTime.clone();
    viewer.clock.currentTime = startTime.clone();
    viewer.clock.multiplier = 1; // Real-time speed
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP; 

    return vehicle;
}

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

  return animateVehicle(viewer, route);
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


let currentVehicle = null; // We store the vehicle entity here

async function setupDashboard() {
    const poiMap = await pointsOfInterest(); // Load your JSON map
    const poiContainer = document.getElementById('poi-links');
    const zoomVehicleBtn = document.getElementById('btn-zoom-vehicle');
    const stopTrackBtn = document.getElementById('btn-stop-tracking');

    // 1. Generate "Zoom to POI" buttons
    poiMap.forEach((poi, name) => {
        const btn = document.createElement('button');
        btn.innerText = `${name}`;
        btn.style.cssText = "display:block; width:100%; margin:4px 0; text-align:left; cursor:pointer;";
        
        btn.onclick = () => {
          const height = 500.0; // How high the camera is above the ground
          const distanceOffset = 0.005; // Offset in degrees to pull the camera back

          viewer.camera.flyTo({
              // 1. Destination: Where the CAMERA goes (offset to the South)
              destination: Cesium.Cartesian3.fromDegrees(
                  poi.longitude, 
                  poi.latitude - distanceOffset, // Pull back south so we can look 'at' it
                  height
              ),
              orientation: {
                  heading: Cesium.Math.toRadians(0.0),   // Face North (0 degrees)
                  pitch: Cesium.Math.toRadians(-35.0),  // Look down at a 35-degree angle
                  roll: 0.0                             // Keep the horizon level
              },
              duration: 2 // Seconds for the flight animation
          });
      };
        poiContainer.appendChild(btn);
    });

    document.getElementById('btn-spawn').onclick = () => {
        if (currentVehicle) viewer.entities.remove(currentVehicle);

        // Get two random POIs from your Map
        const [start, end] = getRandomN(poiMap, 2);
        
        console.log(`Routing from ${start.name} to ${end.name}...`);

        // Use the coordinates from the POIs to find a road path
        currentVehicle = routeAndAnimate(start.latitude, start.longitude, end.latitude, end.longitude);
        
        if (currentVehicle) {
            zoomVehicleBtn.disabled = false;
        }
    };

    // "Track Vehicle" Button logic
    zoomVehicleBtn.onclick = () => {
        if (currentVehicle) {
            viewer.trackedEntity = currentVehicle;
            stopTrackBtn.disabled = false;
            zoomVehicleBtn.disabled = true;
        }
    };

    // NEW: "Stop Tracking" Button logic
    stopTrackBtn.onclick = () => {
        viewer.trackedEntity = undefined; 
        stopTrackBtn.disabled = true; 
        zoomVehicleBtn.disabled = false;

        
        // Optional: Provide a small camera offset so it doesn't feel "stuck"
        // viewer.camera.moveBackward(50); 
        
        console.log("Camera tracking detached.");
    };
}

// Call the setup
setupDashboard();

// get some pois
fetchPoIs(5)

// this needs to be a button and the coordinates need to be dynamic
// routeAndAnimate(55.8609, -4.2514, 55.8580, -4.2572);

routeAndAnimate(55.8453095, -4.2554813, 55.8580, -4.2572)



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