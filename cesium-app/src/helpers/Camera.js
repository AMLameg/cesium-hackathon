import { CameraButton } from "./CameraButton.js";
import { setViewer } from "./state.js";

export class Camera {
  static createButton(options) {
    return CameraButton.create(options);
  }

  static setViewer(viewer) {
    setViewer(viewer);
  }
}
