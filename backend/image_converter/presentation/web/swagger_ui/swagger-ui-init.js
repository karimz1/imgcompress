// Starts Swagger UI for the imgcompress API. A file of its own, not inline,
// so a strict Content-Security-Policy at a reverse proxy keeps working.
window.addEventListener("load", function () {
  var root = document.getElementById("swagger-ui");
  var specUrl = root.getAttribute("data-spec-url");
  if (typeof window.SwaggerUIBundle !== "function") {
    root.textContent = "Swagger UI files are missing in this build. The spec is at " + specUrl;
    return;
  }
  window.ui = window.SwaggerUIBundle({
    url: specUrl,
    dom_id: "#swagger-ui",
    deepLinking: true,
    tryItOutEnabled: true,
    displayRequestDuration: true,
    // Never ask validator.swagger.io: the container works offline.
    validatorUrl: null,
  });
});
