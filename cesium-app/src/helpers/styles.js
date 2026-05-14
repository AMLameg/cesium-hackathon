import { customToolbarStyleId, embedWindowStyleId } from "./constants.js";

export function ensureCustomToolbarStyles() {
  if (document.getElementById(customToolbarStyleId)) {
    return;
  }

  const style = document.createElement("style");
  style.id = customToolbarStyleId;
  style.textContent = `
    .extra-helpers-toolbar-row {
      display: block;
      clear: both;
      margin-top: 6px;
      text-align: right;
      white-space: nowrap;
    }

    .extra-embed-window-toolbar-column {
      position: absolute;
      top: 50%;
      right: 6px;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transform: translateY(-50%);
    }
  `;
  document.head.appendChild(style);
}

export function ensureEmbedWindowStyles() {
  if (document.getElementById(embedWindowStyleId)) {
    return;
  }

  const style = document.createElement("style");
  style.id = embedWindowStyleId;
  style.textContent = `
    #toolbar {
      max-width: 420px;
    }

    #toolbar label {
      display: block;
      margin-top: 8px;
      font-weight: 600;
    }

    #toolbar input,
    #toolbar select,
    #toolbar textarea {
      box-sizing: border-box;
      width: 100%;
      margin-top: 4px;
    }

    #toolbar textarea {
      min-height: 82px;
      resize: vertical;
    }

    #toolbar button {
      margin-top: 8px;
    }

    .embed-coordinate-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 6px;
      align-items: start;
    }

    #toolbar .embed-coordinate-row button {
      height: 23px;
      min-width: 68px;
      margin-top: 4px;
      padding: 0 7px;
      cursor: pointer;
    }

    .embed-copy-row {
      display: flex;
      justify-content: flex-end;
    }

    .embed-show-window-option {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      font-weight: 600;
    }

    #toolbar .embed-show-window-option input {
      width: auto;
      margin-top: 0;
    }

    .embed-show-window-options {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    #toolbar input[type="color"] {
      height: 28px;
      padding: 2px;
    }

    .embed-marker-options,
    .embed-toolbar-button-options {
      display: none;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.28);
    }

    .embed-marker-options.is-visible,
    .embed-toolbar-button-options.is-visible {
      display: block;
    }

    #windowLayer {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }

    .embed-window {
      position: absolute;
      min-width: 240px;
      min-height: 180px;
      background: #101821;
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 8px;
      box-shadow: 0 16px 44px rgba(0, 0, 0, 0.45);
      color: #f4f8ff;
      overflow: hidden;
      pointer-events: auto;
    }

    .embed-window.is-dragging,
    .embed-window.is-resizing {
      user-select: none;
    }

    .embed-titlebar {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 34px;
      padding: 0 8px 0 12px;
      background: linear-gradient(90deg, #162435, #253f5a);
      cursor: move;
    }

    .embed-title {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .embed-copy-button,
    .embed-close-button {
      display: grid;
      place-content: center;
      position: relative;
      flex: none;
      width: 24px;
      height: 24px;
      box-sizing: border-box;
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 0;
      background: rgba(255, 255, 255, 0.12);
      color: #f4f8ff;
      cursor: pointer;
      font: inherit;
      line-height: 0;
      padding: 0;
      appearance: none;
    }

    .embed-copy-button::before,
    .embed-close-button::before {
      display: block;
      width: 14px;
      height: 14px;
      background: #f4f8ff;
      content: "";
    }

    .embed-copy-button::before {
      -webkit-mask: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5 2.5h6.5v8H5z' stroke='%23000000' stroke-width='1.5' stroke-linejoin='round'/%3E%3Cpath d='M3 5.5v8h6.5' stroke='%23000000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
      mask: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5 2.5h6.5v8H5z' stroke='%23000000' stroke-width='1.5' stroke-linejoin='round'/%3E%3Cpath d='M3 5.5v8h6.5' stroke='%23000000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
    }

    .embed-copy-button.is-copied::before {
      opacity: 0.45;
    }

    .embed-copy-button.is-copied::after {
      position: absolute;
      right: 4px;
      bottom: 5px;
      width: 11px;
      height: 9px;
      background: #58d68d;
      content: "";
      -webkit-mask: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 8l3 3 7-7' stroke='%23000000' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
      mask: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 8l3 3 7-7' stroke='%23000000' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
    }

    .embed-close-button::before {
      -webkit-mask: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4.5 4.5l7 7m0-7l-7 7' stroke='%23000000' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
      mask: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4.5 4.5l7 7m0-7l-7 7' stroke='%23000000' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
    }

    .embed-copy-button:hover,
    .embed-close-button:hover {
      background: rgba(255, 255, 255, 0.22);
    }

    .embed-frame {
      display: block;
      width: 100%;
      height: calc(100% - 34px);
      border: 0;
      background: white;
    }

    .embed-resize-handle {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 18px;
      height: 18px;
      cursor: nwse-resize;
    }

    .embed-resize-handle::after {
      position: absolute;
      right: 4px;
      bottom: 4px;
      width: 8px;
      height: 8px;
      border-right: 2px solid rgba(255, 255, 255, 0.75);
      border-bottom: 2px solid rgba(255, 255, 255, 0.75);
      content: "";
    }
  `;
  document.head.appendChild(style);
}
