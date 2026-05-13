import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  build: {
    target: 'esnext',
  },
  plugins: [
    cesium()
],
});