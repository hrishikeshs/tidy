document.querySelector("#learning-lab").addEventListener("click", () => {
  webkit.messageHandlers.controller.postMessage({
    action: "openLearningLab"
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
