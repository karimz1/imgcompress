// Starts Swagger UI for the imgcompress API. A file of its own, not inline,
// so a strict Content-Security-Policy at a reverse proxy keeps working.
window.addEventListener("load", function () {
  var root = document.getElementById("swagger-ui");
  var specUrl = root.getAttribute("data-spec-url");
  if (typeof window.SwaggerUIBundle !== "function") {
    root.textContent = "Swagger UI files are missing in this build. The spec is at " + specUrl;
    return;
  }
  // Swagger UI fills Try-it-out with getSampleSchema (first enum, boolean true, minimum).
  // Optional fields must start empty, so this plugin returns "" when a field has no default or example.
  // Required enums still have no prefill; Swagger's Select adds "--" only when the field is optional.
  var noPrefill = function () {
    return {
      wrapFn: {
        getSampleSchema: function (ori) {
          return function (schema, contentType, config, exampleOverride) {
            if (exampleOverride !== undefined && exampleOverride !== null) {
              return ori(schema, contentType, config, exampleOverride);
            }
            var raw = schema && typeof schema.toJS === "function" ? schema.toJS() : schema;
            if (raw && (raw.example !== undefined || raw.examples !== undefined || raw.default !== undefined)) {
              return ori(schema, contentType, config, exampleOverride);
            }
            var type = raw && raw.type;
            if (type === "object" || type === "array") {
              return ori(schema, contentType, config, exampleOverride);
            }
            return "";
          };
        },
      },
    };
  };
  window.ui = window.SwaggerUIBundle({
    url: specUrl,
    dom_id: "#swagger-ui",
    deepLinking: true,
    tryItOutEnabled: true,
    displayRequestDuration: true,
    // Never ask validator.swagger.io: the container works offline.
    validatorUrl: null,
    plugins: [noPrefill],
  });
});
