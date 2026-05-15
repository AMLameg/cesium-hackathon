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

// lets

let floodPolygons = [];
let pointsToAvoid = [];
let chargersList = [];

const tileset = await Cesium.createGooglePhotorealistic3DTileset({
    onlyUsingWithGoogleGeocoder: true,
  });
  viewer.scene.primitives.add(tileset);

  const flood_resource = await Cesium.IonResource.fromAssetId(4773439); // flooding data
  const dataSource = await Cesium.GeoJsonDataSource.load(flood_resource, {
    clampToGround: true,
  });

try {
  

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

floodPolygons = extractFloodCoordinates(dataSource);

function extractFloodCoordinates(dataSource) {
    const polygons = [];
    const entities = dataSource.entities.values;

    for (const entity of entities) {
        // Check if the entity is a rendered polygon
        if (entity.polygon && entity.polygon.hierarchy) {
            const hierarchy = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now());
            
            if (hierarchy && hierarchy.positions) {
                // Convert Cesium's internal Cartesian3 world positions back to [lon, lat] degrees
                const outerRing = hierarchy.positions.map(position => {
                    const cartographic = Cesium.Cartographic.fromCartesian(position);
                    return [
                        Cesium.Math.toDegrees(cartographic.longitude),
                        Cesium.Math.toDegrees(cartographic.latitude)
                    ];
                });
                
                polygons.push(outerRing);
            }
        }
    }
    return polygons;
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
  // console.log(row)
    const cols = row.split('\t');
    if (cols.length < 2) return; 

    const lat          = parseFloat(cols[0]);
    const lon          = parseFloat(cols[1]);
    const id           = cols[2];
    const power        = cols[3];
    const connectorId  = cols[4];

    chargersList.push({ lat, lon, id, power });

    viewer.entities.add({
      name: `Charger: ${id}`,
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: {
        pixelSize: 8,
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
console.log(chargersList)
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

function findClosestCharger(currentLat, currentLon) {
    if (chargersList.length === 0) return null;

    let closestCharger = null;
    let minDistance = Infinity;

    chargersList.forEach(charger => {
        const dist = haversineDistance(
            { lat: currentLat, lon: currentLon },
            { lat: charger.lat, lon: charger.lon }
        );

        if (dist < minDistance) {
            minDistance = dist;
            closestCharger = charger;
        }
    });

    return closestCharger;
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

function runEmergencyChargingScenario(fromLat, fromLon, toLat, toLon, ambulanceUri) {
    if (!routingGraph) return console.warn("Routing graph not ready");
    const { nodes, adjacency } = routingGraph;

    // 1. "Oh no! Low battery!" -> Find the nearest charger to the starting position
    const charger = findClosestCharger(fromLat, fromLon);
    if (!charger) {
        console.warn("No charging stations loaded in memory.");
        return null;
    }
    console.log(`Low Battery Event: Diverting to Charger ${charger.id} first.`);

    // 2. Identify all network node IDs
    const startNodeId   = nearestNode(nodes, fromLat, fromLon);
    const chargerNodeId = nearestNode(nodes, charger.lat, charger.lon);
    const endNodeId     = nearestNode(nodes, toLat, toLon);

    // 3. Leg 1: Travel from Point A to Charger (Avoiding Floods)
    const leg1 = astar(adjacency, nodes, startNodeId, chargerNodeId);
    if (!leg1) {
        console.warn("Could not find a flood-safe path to the charging station.");
        return null;
    }

    // 4. Leg 2: Resume Journey from Charger to Point B (Avoiding Floods)
    const leg2 = astar(adjacency, nodes, chargerNodeId, endNodeId);
    if (!leg2) {
        console.warn("Could not find a flood-safe path from the charger to destination.");
        return null;
    }

    // 5. Stitch the journey together 
    // (.slice(1) removes the duplicate waypoint node where the legs connect)
    const fullScenarioPath = leg1.concat(leg2.slice(1));

    console.log("Route calculated successfully. Dispatching ambulance around flood parameters.");
    
    // 6. Send the stitched road matrix to your animation layer
    return animateVehicle(viewer, fullScenarioPath, ambulanceUri);
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
    const h = (nodeId) => {
        const n = nodes.get(nodeId);
        return n ? haversineDistance(n, end) : Infinity;
    };

    const gScore = new Map([[startId, 0]]);
    const fScore = new Map([[startId, h(startId)]]);
    const cameFrom = new Map();
    const open = new Set([startId]);

    while (open.size > 0) {
        const current = [...open].reduce((a, b) =>
            (fScore.get(a) ?? Infinity) < (fScore.get(b) ?? Infinity) ? a : b
        );

        if (current === endId) return reconstructPath(cameFrom, endId, adjacency, nodes);

        open.delete(current);

        for (const { nodeId: neighbour, distance } of adjacency.get(current) ?? []) {
            let weight = distance;
            const n = nodes.get(neighbour);

            // 1. Check for flooding (your existing logic)
            const isFlooded = floodPolygons.some(poly => isPointInPolygon([n.lon, n.lat], poly));
            
            // 2. NEW: Check if this node is too close to any coordinates we want to avoid
            const isNearHazard = pointsToAvoid.some(hazard => {
                // Reuse your haversineDistance function (it returns distance in meters)
                const distanceToHazard = haversineDistance(n, hazard);
                return distanceToHazard <= hazard.radius;
            });

            // 3. Apply penalty if it fails either check
            if (isFlooded || isNearHazard) {
                weight = distance * 1000; // Force the router to find a detour
            }

            const tentativeGScore = (gScore.get(current) ?? Infinity) + weight;

            if (tentativeGScore < (gScore.get(neighbour) ?? Infinity)) {
                cameFrom.set(neighbour, current);
                gScore.set(neighbour, tentativeGScore);
                fScore.set(neighbour, tentativeGScore + h(neighbour));
                open.add(neighbour);
            }
        }
    }
    return null;
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

function animateVehicle(viewer, routeCoords, modelUri, speedMetresPerSecond = 13.9) {
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
    const pos  = Cesium.Cartesian3.fromDegrees(routeCoords[i][0], routeCoords[i][1], 0);
    positions.addSample(time, pos);
  }

  const end = Cesium.JulianDate.addSeconds(start, elapsed, new Cesium.JulianDate());

  const flipRotation = Cesium.Quaternion.fromAxisAngle(
    Cesium.Cartesian3.UNIT_Z, 
    Cesium.Math.toRadians(180)
);

  const vehicle = viewer.entities.add({
    availability: new Cesium.TimeIntervalCollection([
      new Cesium.TimeInterval({ start, stop: end }),
    ]),
    position: positions,
    orientation: new Cesium.CallbackProperty((time, result) => {
        const velocityOrientation = new Cesium.VelocityOrientationProperty(positions).getValue(time);
        if (!velocityOrientation) return result;
        
        // Multiply the auto-heading by our 180-degree flip
        return Cesium.Quaternion.multiply(velocityOrientation, flipRotation, new Cesium.Quaternion());
    }, false),
    
    model: {
      uri: modelUri,
      minimumPixelSize: 128, // Keeps it visible when zooming out
      maximumScale: 20000,
      // Ensures the wheels stay on the 3D tiles/ground
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND 
    }
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

function routeAndAnimate(fromLat, fromLon, toLat, toLon, ambulanceURI) {
  if (!routingGraph) return console.warn("Routing graph not ready");

  const { nodes, adjacency } = routingGraph;

  const startId = nearestNode(nodes, fromLat, fromLon);
  const endId   = nearestNode(nodes, toLat, toLon);
  const route   = astar(adjacency, nodes, startId, endId);

  if (!route) return console.warn("No route found");

  return animateVehicle(viewer, route, ambulanceURI);
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

function isPointInPolygon(point, polygon) {
    // point is [lon, lat], polygon is an array of [lon, lat]
    let x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = polygon[i][0], yi = polygon[i][1];
        let xj = polygon[j][0], yj = polygon[j][1];
        let intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function routeWithWaypointAndAnimate(fromLat, fromLon, viaLat, viaLon, toLat, toLon, ambulanceUri) {
  if (!routingGraph) return console.warn("Routing graph not ready");

  const { nodes, adjacency } = routingGraph;

  // 1. Find the nearest network nodes for all three points
  const startId    = nearestNode(nodes, fromLat, fromLon);
  const waypointId = nearestNode(nodes, viaLat, viaLon);
  const endId      = nearestNode(nodes, toLat, toLon);

  // 2. Calculate Leg 1: Start -> Waypoint
  const leg1 = astar(adjacency, nodes, startId, waypointId);
  if (!leg1) {
    console.warn("No route found from Start to the Waypoint");
    return null;
  }

  // 3. Calculate Leg 2: Waypoint -> End
  const leg2 = astar(adjacency, nodes, waypointId, endId);
  if (!leg2) {
    console.warn("No route found from Waypoint to Destination");
    return null;
  }

  // 4. Stitch the paths together
  // We use .slice(1) on leg2 so we don't repeat the waypoint coordinate twice
  const fullRoute = leg1.concat(leg2.slice(1));

  // 5. Send the combined route to your existing animation function
  return animateVehicle(viewer, fullRoute, ambulanceUri);
}


let currentVehicle = null; // We store the vehicle entity here

async function setupDashboard() {
    const poiMap = await pointsOfInterest(); // Load your JSON map
    const poiContainer = document.getElementById('poi-links');
    const zoomVehicleBtn = document.getElementById('btn-zoom-vehicle');
    const stopTrackBtn = document.getElementById('btn-stop-tracking');
    const ambulanceUri = await Cesium.IonResource.fromAssetId(4771475);
    
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

    // 1. Pick a random Start and End POI
    const [start, end] = getRandomN(poiMap, 2);
    
    // 2. Define the fixed programmatic waypoint
    const fixedWaypoint = {
        latitude: 55.8642,  // Set whatever coordinates you need the vehicle
        longitude: -4.2518 // to travel through automatically
    };

    console.log(`Routing: ${start.name} ➔ Checkpoint ➔ ${end.name}`);

    // 3. Use the chained routing function to calculate the full path
    currentVehicle = routeWithWaypointAndAnimate(
        start.latitude, start.longitude,         // Leg 1 Start
        fixedWaypoint.latitude, fixedWaypoint.longitude, // Waypoint/Checkpoint
        end.latitude, end.longitude,              // Leg 2 Destination
        ambulanceUri
    );
    
    if (currentVehicle) {
        zoomVehicleBtn.disabled = false;
        stopTrackBtn.disabled = false;
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

    document.getElementById('btn-scenario').onclick = () => {
      if (currentVehicle) viewer.entities.remove(currentVehicle);
      
      // Grab a random starting POI and destination POI
      const [start, end] = getRandomN(poiMap, 2);
      
      console.log(`Initiating Mission: ${start.name} ➔ Destination: ${end.name}`);
      
      // Run our new macro script
      currentVehicle = runEmergencyChargingScenario(
          start.latitude, start.longitude, 
          end.latitude, end.longitude, 
          ambulanceUri
      );
    
      if (currentVehicle) {
          zoomVehicleBtn.disabled = false;
          stopTrackBtn.disabled = false;
      }
};
}

// Call the setup
setupDashboard();

// get some pois
fetchPoIs(2)

// this needs to be a button and the coordinates need to be dynamic
// routeAndAnimate(55.8609, -4.2514, 55.8580, -4.2572);

routeAndAnimate(55.8453095, -4.2554813, 55.8580, -4.2572)


function cesium_animate(){

}



// Fly to Glasgow
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(-4.2514, 55.8609, 1200),
  orientation: {
    heading: Cesium.Math.toRadians(20),
    pitch: Cesium.Math.toRadians(-35),
    roll: 0,
  },
  duration: 4,
});