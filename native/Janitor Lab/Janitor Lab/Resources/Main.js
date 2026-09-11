document.querySelector("#learning-lab").addEventListener("click", () => {
  webkit.messageHandlers.controller.postMessage({
    action: "openLearningLab"
  });
});

document.querySelector("#tip-jar").addEventListener("click", () => {
  webkit.messageHandlers.controller.postMessage({
    action: "openTipJar"
  });
});

for (const link of document.querySelectorAll("[data-external-url]")) {
  link.addEventListener("click", () => {
    webkit.messageHandlers.controller.postMessage({
      action: "openExternal",
      url: link.dataset.externalUrl
    });
  });
}
