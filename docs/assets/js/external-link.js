// External links handler - security best practices
(function () {
    'use strict';
    var links = document.querySelectorAll('a[href^="http"]:not([href*="' + location.hostname + '"])');
    for (var i = 0; i < links.length; i++) {
        links[i].target = '_blank';
        links[i].rel = 'noopener noreferrer';
    }
})();
