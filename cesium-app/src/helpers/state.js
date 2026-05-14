let activeViewer;

export function setViewer(viewer) {
  activeViewer = viewer;
}

export function getViewer() {
  return activeViewer ?? globalThis.viewer;
}
