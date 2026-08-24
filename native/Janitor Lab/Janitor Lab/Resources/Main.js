document.querySelector("#learning-lab").addEventListener("click", () => {
  webkit.messageHandlers.controller.postMessage({
    action: "openLearningLab",
    url: "http://127.0.0.1:8765/learning?tidy_seed=1"
  });
});
