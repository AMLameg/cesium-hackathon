import { toolbarButtonIcons } from "./constants.js";

export function getToolbarButtonIcon(iconName) {
  return (
    toolbarButtonIcons.find(function (icon) {
      return icon.value === iconName;
    }) ?? toolbarButtonIcons[0]
  );
}

export function normalizeToolbarButtonIcon(iconName) {
  return getToolbarButtonIcon(iconName).value;
}

export function createToolbarButtonIconSvgMarkup(iconName) {
  const icon = getToolbarButtonIcon(iconName);
  const paths = icon.paths ?? [icon.path];

  return `<svg class="embed-toolbar-button-icon-preview" viewBox="${icon.viewBox}" aria-hidden="true" focusable="false">${paths
    .map(function (path) {
      return `<path d="${path}"></path>`;
    })
    .join("")}</svg>`;
}

export function appendToolbarButtonIcon(button, iconName) {
  const iconDefinition = getToolbarButtonIcon(iconName);
  const paths = iconDefinition.paths ?? [iconDefinition.path];
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "cesium-svgPath-svg");
  icon.setAttribute("viewBox", iconDefinition.viewBox);
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");

  paths.forEach(function (iconPath) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", iconPath);
    icon.appendChild(path);
  });

  button.appendChild(icon);
}

export function normalizeToolbarButtonOptions(toolbarButton) {
  if (!toolbarButton) {
    return undefined;
  }

  if (toolbarButton === true) {
    return { icon: toolbarButtonIcons[0].value };
  }

  if (typeof toolbarButton === "string") {
    return { icon: normalizeToolbarButtonIcon(toolbarButton) };
  }

  return {
    ...toolbarButton,
    icon: normalizeToolbarButtonIcon(toolbarButton.icon),
  };
}
