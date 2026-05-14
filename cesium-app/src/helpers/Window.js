import * as Cesium from "cesium";
import {
  defaultEmbedHtmlPlaceholder,
  defaultEmbedUrlPlaceholder,
  defaultMarkerLatitudePlaceholder,
  defaultMarkerLongitudePlaceholder,
  defaultWindowHeightPercent,
  defaultWindowLeftPercent,
  defaultWindowTopPercent,
  defaultWindowWidthPercent,
} from "./constants.js";
import { copyText } from "./clipboard.js";
import {
  cartesianToCoordinates,
  colorToInputValue,
  normalizeCoordinates,
  pickCartesian,
} from "./cesiumUtils.js";
import { createMarkerEntity } from "./marker.js";
import {
  createMarkerStyleIconUrl,
  createMarkerStyleOptions,
  getMarkerStyleLabel,
  normalizeMarkerStyle,
} from "./markerStyles.js";
import { getViewer, setViewer } from "./state.js";
import { ensureEmbedWindowStyles } from "./styles.js";
import { getWindowToolbarColumn } from "./toolbar.js";
import {
  appendToolbarButtonIcon,
  normalizeToolbarButtonOptions,
} from "./toolbarIcons.js";

let windowLayer;
let nextOffset = 0;
let topZIndex = 10;
let isInitialized = false;
let isHelpShown = false;
const markerClickViewers = new WeakSet();

export class Window {
  constructor(options) {
    return createEmbedWindow(options);
  }

  static create(options) {
    return createEmbedWindow(options);
  }

  static setViewer(viewer) {
    setViewer(viewer);
  }

  static showHelp(options = { marker: true }) {
    showHelp(options);
  }
}

function createEmbedWindow(options) {
  initializeEmbedWindows();

  const content = options.content.trim();
  const title = options.title.trim() || "Embedded content";
  const type = options.type === "html" ? "html" : "url";
  const windowElement = document.createElement("section");
  const titlebar = document.createElement("div");
  const titleElement = document.createElement("div");
  const copyButton = document.createElement("button");
  const closeButton = document.createElement("button");
  const frame = document.createElement("iframe");
  const resizeHandle = document.createElement("div");
  const markerResult = createMarkerEntity(options.marker);
  const toolbarButtonOptions = normalizeToolbarButtonOptions(
    options.toolbarButton,
  );
  const hideCopy = isTrueOption(options.hideCopy);
  const showOnMarkerPress =
    options.marker?.showWindowWhen === "markerPressed" ||
    options.marker?.showWindowWhen === "marker-pressed";

  windowElement.className = "embed-window";
  titlebar.className = "embed-titlebar";
  titleElement.className = "embed-title";
  copyButton.className = "embed-copy-button";
  closeButton.className = "embed-close-button";
  frame.className = "embed-frame";
  resizeHandle.className = "embed-resize-handle";

  titleElement.textContent = title;
  copyButton.type = "button";
  closeButton.type = "button";
  copyButton.title = "Copy window snippet";
  closeButton.title = "Close";
  copyButton.setAttribute("aria-label", "Copy window snippet");
  closeButton.setAttribute("aria-label", "Close");
  frame.title = title;

  if (type === "html") {
    frame.srcdoc = content;
  } else {
    frame.src = normalizeUrl(content);
  }

  windowElement.style.left = getPlacementLength(
    options.left,
    defaultWindowLeftPercent + nextOffset,
    "left",
  );
  windowElement.style.top = getPlacementLength(
    options.top,
    defaultWindowTopPercent + nextOffset,
    "top",
  );
  windowElement.style.width = getPlacementLength(
    options.width,
    defaultWindowWidthPercent,
    "width",
  );
  windowElement.style.height = getPlacementLength(
    options.height,
    defaultWindowHeightPercent,
    "height",
  );
  windowElement.style.zIndex = `${++topZIndex}`;

  titlebar.append(titleElement);

  if (!hideCopy) {
    titlebar.append(copyButton);
  }

  titlebar.append(closeButton);
  windowElement.append(titlebar, frame, resizeHandle);
  windowLayer.appendChild(windowElement);

  if (markerResult && options.left === undefined && options.top === undefined) {
    positionWindowAtMarker(windowElement, markerResult);
  } else {
    keepWithinLayer(windowElement);
  }

  if (markerResult && showOnMarkerPress) {
    markerResult.entity._extraHelpersWindowElement = windowElement;
    markerResult.entity._extraHelpersMarkerResult = markerResult;
    ensureMarkerClickHandler(markerResult.viewer);
    windowElement.style.display = "none";
  }

  const toolbarButtonResult = createEmbedWindowToolbarButton(
    windowElement,
    { ...options, toolbarButton: toolbarButtonOptions },
    title,
  );

  if (toolbarButtonResult) {
    windowElement.style.display = "none";
  }

  titlebar.addEventListener("pointerdown", function (event) {
    if (event.target.closest("button")) {
      return;
    }

    startDrag(event, windowElement);
  });
  resizeHandle.addEventListener("pointerdown", function (event) {
    startResize(event, windowElement);
  });
  windowElement.addEventListener("pointerdown", function () {
    windowElement.style.zIndex = `${++topZIndex}`;
  });
  copyButton.addEventListener("click", function () {
    copyText(
      createClipboardSnippet(windowElement, {
        title,
        type,
        content,
        hideCopy,
        marker: options.marker,
        toolbarButton: toolbarButtonResult?.options,
      }),
      copyButton,
    );
  });
  closeButton.addEventListener("click", function () {
    if ((markerResult && showOnMarkerPress) || toolbarButtonResult) {
      windowElement.style.display = "none";
      return;
    }

    if (markerResult) {
      markerResult.viewer.entities.remove(markerResult.entity);
    }
    toolbarButtonResult?.button.remove();
    windowElement.remove();
  });

  nextOffset = (nextOffset + 2) % 10;
  return windowElement;
}

function initializeEmbedWindows() {
  if (isInitialized) {
    return;
  }

  isInitialized = true;
  ensureEmbedWindowStyles();
  ensureWindowLayer();

  globalThis.addEventListener("resize", function () {
    for (const windowElement of windowLayer.querySelectorAll(".embed-window")) {
      keepWithinLayer(windowElement);
    }
  });
}

function showHelp(options = { marker: true }) {
  initializeEmbedWindows();

  if (isHelpShown) {
    return;
  }

  const toolbar = document.getElementById("toolbar");

  if (!toolbar) {
    return;
  }

  isHelpShown = true;
  const markerOptions = options.marker === true ? {} : options.marker;
  const marker = markerOptions ?? {};
  const coordinates = normalizeCoordinates(marker.coordinates) ?? {};
  const markerStyle = normalizeMarkerStyle(marker.style);
  const toolbarButton = normalizeToolbarButtonOptions(options.toolbarButton) ?? {};
  const showMarkerFields = Boolean(options.marker && options.marker !== false);
  const showOnMarkerPress =
    marker.showWindowWhen === "markerPressed" ||
    marker.showWindowWhen === "marker-pressed";
  const showOnToolbarButtonPress = Boolean(options.toolbarButton);

  toolbar.innerHTML = `
    <strong>Embeddable Windows</strong>
    <p>Configure a URL or custom HTML, then use Copy to capture a reusable helper snippet.</p>
    <label for="embedTitle">Title</label>
    <input id="embedTitle" value="Wikipedia" />
    <label for="embedType">Content type</label>
    <select id="embedType">
      <option value="url">URL</option>
      <option value="html">HTML</option>
    </select>
    <label id="embedContentLabel" for="embedContent">URL</label>
    <textarea id="embedContent" placeholder="${defaultEmbedUrlPlaceholder}"></textarea>
    ${
      showMarkerFields
        ? `
    <label>Show window when:</label>
    <div class="embed-show-window-options">
      <label class="embed-show-window-option"><input name="embedShowWindowWhen" type="radio" value="onStart" ${showOnMarkerPress || showOnToolbarButtonPress ? "" : "checked"} /> On start</label>
      <label class="embed-show-window-option"><input name="embedShowWindowWhen" type="radio" value="markerPressed" ${showOnMarkerPress ? "checked" : ""} /> When marker is pressed</label>
      <label class="embed-show-window-option"><input name="embedShowWindowWhen" type="radio" value="toolbarButtonPressed" ${showOnToolbarButtonPress ? "checked" : ""} /> When toolbar button is pressed</label>
    </div>
    <div id="embedMarkerOptions" class="embed-marker-options ${showOnMarkerPress ? "is-visible" : ""}">
      <strong>Marker</strong>
      <label for="embedMarkerColor">Color</label>
      <input id="embedMarkerColor" type="color" value="${colorToInputValue(marker.color)}" />
      <label for="embedMarkerStyle">Style</label>
      <select id="embedMarkerStyle">${createMarkerStyleOptions(marker.style)}</select>
      <img src="${createMarkerStyleIconUrl(markerStyle)}" alt="${getMarkerStyleLabel(markerStyle)}" width="16" height="16" />
      <label>Coordinates (longitude, latitude)</label>
      <div class="embed-coordinate-row">
        <input id="embedMarkerLongitude" aria-label="Longitude" placeholder="${defaultMarkerLongitudePlaceholder}" value="${coordinates.longitude ?? ""}" />
        <input id="embedMarkerLatitude" aria-label="Latitude" placeholder="${defaultMarkerLatitudePlaceholder}" value="${coordinates.latitude ?? ""}" />
        <button id="pickEmbedMarkerCoordinates" type="button" title="Pick coordinates from the globe">Pick</button>
      </div>
    </div>
    <div id="embedToolbarButtonOptions" class="embed-toolbar-button-options ${showOnToolbarButtonPress ? "is-visible" : ""}">
      <strong>Toolbar button</strong>
      <label for="embedToolbarButtonIcon">Icon</label>
      <input id="embedToolbarButtonIcon" value="${toolbarButton.icon ?? "camera"}" />
    </div>`
        : ""
    }
    <div class="embed-copy-row">
      <button id="copyEmbedWindow" type="button">Copy</button>
    </div>
  `;

  const titleInput = document.getElementById("embedTitle");
  const typeInput = document.getElementById("embedType");
  const contentLabel = document.getElementById("embedContentLabel");
  const contentInput = document.getElementById("embedContent");
  const markerOptionsElement = document.getElementById("embedMarkerOptions");
  const toolbarButtonOptionsElement = document.getElementById(
    "embedToolbarButtonOptions",
  );
  const markerColorInput = document.getElementById("embedMarkerColor");
  const markerStyleInput = document.getElementById("embedMarkerStyle");
  const markerLongitudeInput = document.getElementById("embedMarkerLongitude");
  const markerLatitudeInput = document.getElementById("embedMarkerLatitude");
  const pickMarkerCoordinatesButton = document.getElementById(
    "pickEmbedMarkerCoordinates",
  );
  const toolbarButtonIconInput = document.getElementById(
    "embedToolbarButtonIcon",
  );

  for (const showWindowWhenInput of document.querySelectorAll(
    'input[name="embedShowWindowWhen"]',
  )) {
    showWindowWhenInput.addEventListener("change", function () {
      const showWindowWhen = document.querySelector(
        'input[name="embedShowWindowWhen"]:checked',
      )?.value;
      markerOptionsElement?.classList.toggle(
        "is-visible",
        showWindowWhen === "markerPressed",
      );
      toolbarButtonOptionsElement?.classList.toggle(
        "is-visible",
        showWindowWhen === "toolbarButtonPressed",
      );
    });
  }

  typeInput.addEventListener("change", function () {
    const isHtml = typeInput.value === "html";
    contentLabel.textContent = isHtml ? "HTML" : "URL";
    contentInput.placeholder = isHtml
      ? defaultEmbedHtmlPlaceholder
      : defaultEmbedUrlPlaceholder;
  });

  pickMarkerCoordinatesButton?.addEventListener("click", function () {
    pickCoordinatesOnce(pickMarkerCoordinatesButton, function (pickedCoordinates) {
      markerLongitudeInput.value = pickedCoordinates.longitude.toFixed(6);
      markerLatitudeInput.value = pickedCoordinates.latitude.toFixed(6);
    });
  });

  document
    .getElementById("copyEmbedWindow")
    .addEventListener("click", function () {
      const showWindowWhen = document.querySelector(
        'input[name="embedShowWindowWhen"]:checked',
      )?.value;
      const marker =
        showWindowWhen === "markerPressed"
          ? {
              coordinates: {
                longitude: markerLongitudeInput.value,
                latitude: markerLatitudeInput.value,
              },
              color: markerColorInput.value,
              style: markerStyleInput.value,
              showWindowWhen,
            }
          : undefined;
      const toolbarButton =
        showWindowWhen === "toolbarButtonPressed"
          ? {
              icon: toolbarButtonIconInput.value,
              showWindowWhen,
            }
          : undefined;

      copyText(
        createClipboardSnippet(undefined, {
          title: titleInput.value,
          type: typeInput.value,
          content: addGrafanaKioskMode(contentInput.value, typeInput.value),
          marker,
          toolbarButton,
        }),
        this,
      );
    });
}

function ensureWindowLayer() {
  if (windowLayer) {
    return windowLayer;
  }

  windowLayer = document.getElementById("windowLayer");
  if (!windowLayer) {
    windowLayer = document.createElement("div");
    windowLayer.id = "windowLayer";
    document.body.appendChild(windowLayer);
  }

  return windowLayer;
}

function normalizeUrl(value) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function showWindowAtMarker(windowElement, markerResult) {
  windowElement.style.display = "block";
  windowElement.style.zIndex = `${++topZIndex}`;
  positionWindowAtMarker(windowElement, markerResult);
}

function showWindowFromToolbarButton(windowElement) {
  windowElement.style.display = "block";
  windowElement.style.zIndex = `${++topZIndex}`;
  keepWithinLayer(windowElement);
}

function createEmbedWindowToolbarButton(windowElement, options, title) {
  const viewer = options.viewer ?? getViewer();
  const toolbarButtonOptions = normalizeToolbarButtonOptions(
    options.toolbarButton,
  );

  if (!toolbarButtonOptions) {
    return undefined;
  }

  const column = getWindowToolbarColumn(options, viewer);
  const button = document.createElement("button");
  const label = toolbarButtonOptions.label ?? `Open ${title}`;

  button.type = "button";
  button.className =
    "cesium-button cesium-toolbar-button extra-embed-window-toolbar-button";
  button.title = label;
  button.setAttribute("aria-label", label);
  appendToolbarButtonIcon(button, toolbarButtonOptions.icon);
  button.addEventListener("click", function () {
    showWindowFromToolbarButton(windowElement);
  });

  column.appendChild(button);
  return { button, options: toolbarButtonOptions };
}

function ensureMarkerClickHandler(viewer) {
  if (markerClickViewers.has(viewer)) {
    return;
  }

  markerClickViewers.add(viewer);
  viewer.scene.canvas.addEventListener("click", function (event) {
    const bounds = viewer.scene.canvas.getBoundingClientRect();
    const pickedObject = viewer.scene.pick(
      new Cesium.Cartesian2(
        event.clientX - bounds.left,
        event.clientY - bounds.top,
      ),
    );
    const entity = pickedObject?.id;

    if (
      entity?._extraHelpersWindowElement &&
      entity._extraHelpersMarkerResult
    ) {
      showWindowAtMarker(
        entity._extraHelpersWindowElement,
        entity._extraHelpersMarkerResult,
      );
    }
  });
}

function positionWindowAtMarker(windowElement, markerResult) {
  if (!markerResult) {
    return;
  }

  const scene = markerResult.viewer.scene;
  const screenPosition = Cesium.SceneTransforms.worldToWindowCoordinates(
    scene,
    markerResult.position,
  );

  if (!screenPosition) {
    return;
  }

  const layerBounds = windowLayer.getBoundingClientRect();
  windowElement.style.left = `${screenPosition.x - layerBounds.left + 20}px`;
  windowElement.style.top = `${screenPosition.y - layerBounds.top - windowElement.offsetHeight / 2}px`;
  keepWithinLayer(windowElement);
}

function pickCoordinatesOnce(button, onPick) {
  const viewer = getViewer();

  if (!viewer) {
    return;
  }

  const toolbar = button.closest("#toolbar");
  const canvas = viewer.scene.canvas;
  const originalText = button.textContent;
  const originalCanvasCursor = canvas.style.cursor;
  const originalToolbarVisibility = toolbar?.style.visibility ?? "";
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  button.textContent = "Click globe";
  button.disabled = true;
  canvas.style.cursor = "crosshair";

  if (toolbar) {
    toolbar.style.visibility = "hidden";
  }

  function finish() {
    handler.destroy();
    button.textContent = originalText;
    button.disabled = false;
    canvas.style.cursor = originalCanvasCursor;

    if (toolbar) {
      toolbar.style.visibility = originalToolbarVisibility;
    }
  }

  handler.setInputAction(function (movement) {
    const cartesian = pickCartesian(viewer.scene, viewer.camera, movement.position);

    if (Cesium.defined(cartesian)) {
      onPick(cartesianToCoordinates(cartesian));
    }

    finish();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

function keepWithinLayer(windowElement) {
  ensureWindowLayer();

  const layerBounds = windowLayer.getBoundingClientRect();
  const maxLeft = Math.max(0, layerBounds.width - windowElement.offsetWidth);
  const maxTop = Math.max(0, layerBounds.height - windowElement.offsetHeight);
  const left = Math.min(Math.max(0, windowElement.offsetLeft), maxLeft);
  const top = Math.min(Math.max(0, windowElement.offsetTop), maxTop);

  windowElement.style.left = `${formatPercent(
    pixelsToPercent(left, layerBounds.width),
  )}%`;
  windowElement.style.top = `${formatPercent(
    pixelsToPercent(top, layerBounds.height),
  )}%`;
}

function pixelsToPercent(pixels, totalPixels) {
  if (totalPixels <= 0) {
    return 0;
  }

  return (pixels / totalPixels) * 100;
}

function formatPercent(value) {
  return Number(value.toFixed(4));
}

function getWindowMetricPercent(windowElement, metric) {
  ensureWindowLayer();

  const layerBounds = windowLayer.getBoundingClientRect();
  const usesWidth = metric === "left" || metric === "width";
  const totalPixels = usesWidth ? layerBounds.width : layerBounds.height;
  const pixels = {
    left: windowElement.offsetLeft,
    top: windowElement.offsetTop,
    width: windowElement.offsetWidth,
    height: windowElement.offsetHeight,
  }[metric];

  return `${formatPercent(pixelsToPercent(pixels, totalPixels))}%`;
}

function getPlacementLength(value, fallbackPercent, optionName) {
  if (value === undefined) {
    return `${fallbackPercent}%`;
  }

  if (typeof value === "string" && /^\d+(?:\.\d+)?(?:px|%)$/.test(value)) {
    return value;
  }

  throw new Error(`${optionName} must be a string ending in px or %.`);
}

function createClipboardSnippet(windowElement, options) {
  const placement = {
    title: options.title,
    type: options.type,
    content: options.content,
  };

  if (windowElement) {
    placement.left = getWindowMetricPercent(windowElement, "left");
    placement.top = getWindowMetricPercent(windowElement, "top");
    placement.width = getWindowMetricPercent(windowElement, "width");
    placement.height = getWindowMetricPercent(windowElement, "height");
  }

  if (options.marker) {
    placement.marker = options.marker;
  }

  if (options.toolbarButton) {
    placement.toolbarButton = options.toolbarButton;
  }

  if (isTrueOption(options.hideCopy)) {
    placement.hideCopy = "true";
  }

  return `Helpers.Window.create(${JSON.stringify(placement, null, 2)});`;
}

function addGrafanaKioskMode(content, type) {
  if (type !== "url") {
    return content;
  }

  try {
    const url = new URL(content.trim());

    if (url.hostname !== "grafana.imic.lt") {
      return content;
    }

    url.searchParams.set("kiosk", "true");
    return url.toString();
  } catch {
    return content;
  }
}

function isTrueOption(value) {
  return value === true || value === "true";
}

function startDrag(event, windowElement) {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  windowElement.classList.add("is-dragging");
  windowElement.style.zIndex = `${++topZIndex}`;

  const startX = event.clientX;
  const startY = event.clientY;
  const startLeft = windowElement.offsetLeft;
  const startTop = windowElement.offsetTop;

  function drag(pointerEvent) {
    windowElement.style.left = `${startLeft + pointerEvent.clientX - startX}px`;
    windowElement.style.top = `${startTop + pointerEvent.clientY - startY}px`;
    keepWithinLayer(windowElement);
  }

  function stopDrag() {
    windowElement.classList.remove("is-dragging");
    globalThis.removeEventListener("pointermove", drag);
    globalThis.removeEventListener("pointerup", stopDrag);
  }

  globalThis.addEventListener("pointermove", drag);
  globalThis.addEventListener("pointerup", stopDrag);
}

function startResize(event, windowElement) {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  windowElement.classList.add("is-resizing");
  windowElement.style.zIndex = `${++topZIndex}`;

  const startX = event.clientX;
  const startY = event.clientY;
  const startWidth = windowElement.offsetWidth;
  const startHeight = windowElement.offsetHeight;
  const layerBounds = windowLayer.getBoundingClientRect();

  function resize(pointerEvent) {
    const width = startWidth + pointerEvent.clientX - startX;
    const height = startHeight + pointerEvent.clientY - startY;
    const maxWidth = layerBounds.width - windowElement.offsetLeft;
    const maxHeight = layerBounds.height - windowElement.offsetTop;

    windowElement.style.width = `${formatPercent(
      pixelsToPercent(
        Math.min(Math.max(240, width), maxWidth),
        layerBounds.width,
      ),
    )}%`;
    windowElement.style.height = `${formatPercent(
      pixelsToPercent(
        Math.min(Math.max(180, height), maxHeight),
        layerBounds.height,
      ),
    )}%`;
  }

  function stopResize() {
    windowElement.classList.remove("is-resizing");
    globalThis.removeEventListener("pointermove", resize);
    globalThis.removeEventListener("pointerup", stopResize);
  }

  globalThis.addEventListener("pointermove", resize);
  globalThis.addEventListener("pointerup", stopResize);
}
