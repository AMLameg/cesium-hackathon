import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyOTJjNzQ3Mi0xM2QyLTRjNjMtYjJhYy1iYTIwOWVhY2M1ZTUiLCJpZCI6NDMwNjQxLCJpc3MiOiJodHRwczovL2lvbi5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3Nzg1OTQxODd9.p9czk9Fwfb8E_c-YOXikJ84ges7JsYzuORdk8yx9Zcc'
const viewer = new Cesium.Viewer("cesiumContainer");

// Enable rendering the sky
// viewer.scene.skyAtmosphere.show = true;

// Add Photorealistic 3D Tiles
try {
  const tileset = await Cesium.createGooglePhotorealistic3DTileset({
    onlyUsingWithGoogleGeocoder: true,
  });
  viewer.scene.primitives.add(tileset);
} catch (error) {
  console.log(`Error loading Photorealistic 3D Tiles tileset.
          ${error}`);
}

console.log('tileset loading ok')

