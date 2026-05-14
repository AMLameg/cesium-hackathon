export async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const scratch = document.createElement("textarea");
    scratch.value = text;
    scratch.style.position = "fixed";
    scratch.style.opacity = "0";
    document.body.appendChild(scratch);
    scratch.select();
    document.execCommand("copy");
    scratch.remove();
  }

  if (!button) {
    return;
  }

  if (button.classList.contains("embed-copy-button")) {
    showEmbedCopied(button);
    return;
  }

  const checkPath = button.querySelector(
    ".extra-camera-button-check, .extra-coordinate-selector-button-check, .extra-polygon-selector-button-check, .extra-polyline-button-check",
  );
  if (checkPath) {
    showButtonCheck(button, checkPath);
    return;
  }

  const originalText = button.textContent;
  button.textContent = "Copied";
  clearTimeout(button._extraHelpersCopyTimeout);
  button._extraHelpersCopyTimeout = setTimeout(function () {
    button.textContent = originalText;
    button._extraHelpersCopyTimeout = undefined;
  }, 1000);
}

function showEmbedCopied(button) {
  const originalTitle = button.title;
  button.classList.add("is-copied");
  button.title = "Copied";
  clearTimeout(button._extraHelpersCopyTimeout);
  button._extraHelpersCopyTimeout = setTimeout(function () {
    button.classList.remove("is-copied");
    button.title = originalTitle;
    button._extraHelpersCopyTimeout = undefined;
  }, 1000);
}

function showButtonCheck(button, checkPath) {
  const originalTitle = button._extraHelpersOriginalTitle ?? button.title;
  button._extraHelpersOriginalTitle = originalTitle;
  checkPath.style.display = "block";
  button.title = "Copied";
  clearTimeout(button._extraHelpersCopyTimeout);
  button._extraHelpersCopyTimeout = setTimeout(function () {
    checkPath.style.display = "none";
    button.title = originalTitle;
    button._extraHelpersOriginalTitle = undefined;
    button._extraHelpersCopyTimeout = undefined;
  }, 2000);
}
