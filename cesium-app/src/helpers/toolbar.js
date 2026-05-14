import { ensureCustomToolbarStyles } from "./styles.js";

export function getCustomToolbar(options = {}, viewer) {
  if (options.toolbar) {
    return options.toolbar;
  }

  const viewerToolbar =
    viewer?.container?.querySelector(".cesium-viewer-toolbar") ??
    document.querySelector(".cesium-viewer-toolbar");
  if (viewerToolbar) {
    return viewerToolbar;
  }

  if (options.toolbarId) {
    return document.getElementById(options.toolbarId);
  }

  return undefined;
}

export function getCustomToolbarRow(toolbar) {
  ensureCustomToolbarStyles();

  let row = toolbar.querySelector(".extra-helpers-toolbar-row");
  if (!row) {
    row = document.createElement("div");
    row.className = "extra-helpers-toolbar-row";
    toolbar.appendChild(row);
  }

  return row;
}

export function getWindowToolbarColumn(options = {}, viewer) {
  ensureCustomToolbarStyles();

  const toolbar = getCustomToolbar(options, viewer);
  const host = viewer?.container ?? toolbar?.parentElement ?? document.body;
  let column = host.querySelector(".extra-embed-window-toolbar-column");

  if (!column) {
    column = document.createElement("div");
    column.className = "extra-embed-window-toolbar-column";
    host.appendChild(column);
  }

  return column;
}
