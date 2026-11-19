// Starts Swagger UI for the imgcompress API. A file of its own, not inline,
// so a strict Content-Security-Policy at a reverse proxy keeps working.
window.addEventListener("load", function () {
  var root = document.getElementById("swagger-ui");
  var specUrl = root.getAttribute("data-spec-url");
  if (typeof window.SwaggerUIBundle !== "function") {
    root.textContent = "Swagger UI files are missing in this build. The spec is at " + specUrl;
    return;
  }

  // Every Try-it-out field starts empty and is only sent when the user fills it.
  // Swagger UI 5 would prefill request fields from the schema (first enum value,
  // minimum, true, "string") and mark empty fields as "Send empty value".
  var emptyForms = function () {
    return {
      // Runs after the OpenAPI 3.1 plugin has set fn.getSampleSchema.
      afterLoad: function (system) {
        var fn = system.fn;
        var original = fn.getSampleSchema;
        if (typeof original !== "function") return;
        fn.getSampleSchema = function (schema, contentType, config, exampleOverride) {
          // Request side only (Swagger asks with includeWriteOnly); response examples stay.
          if (!config || !config.includeWriteOnly || (exampleOverride !== undefined && exampleOverride !== null)) {
            return original.apply(this, arguments);
          }
          var raw = schema && typeof schema.toJS === "function" ? schema.toJS() : schema || {};
          var type = Array.isArray(raw.type) ? raw.type[0] : raw.type;
          if (type === "array") {
            // A file list keeps its first file picker; other lists start with no item.
            var binary = raw.items && (raw.items.format === "binary" || raw.items.contentMediaType);
            return binary ? original.apply(this, arguments) : [];
          }
          if (type === "object" || raw.properties) {
            // JSON body: only the required keys, each one still to be filled in.
            var body = {};
            (raw.required || []).forEach(function (key) {
              var prop = (raw.properties || {})[key] || {};
              body[key] = prop.type === "string" ? "" : null;
            });
            return contentType && /json/.test(contentType) ? JSON.stringify(body, null, 2) : body;
          }
          return "";
        };
      },
      wrapComponents: {
        // Always offer "--" so no choice is preselected, required ones included.
        Select: function (Original, system) {
          return function (props) {
            return system.React.createElement(Original, Object.assign({}, props, { allowEmptyValue: true }));
          };
        },
        // Empty fields are left out of the request instead of sent as "".
        ParameterIncludeEmpty: function () {
          return function () {
            return null;
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
    plugins: [emptyForms],
  });
});
