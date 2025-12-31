document.addEventListener("DOMContentLoaded", function () {
    var links = document.links;
    for (var i = 0; i < links.length; i++) {
        var link = links[i];

        // Skip links that should be handled by glightbox
        if (link.classList.contains('glightbox') || link.getAttribute('data-glightbox')) {
            continue;
        }

        // Only target external links (different hostname and not a relative path)
        if (link.hostname && link.hostname !== window.location.hostname) {
            link.target = '_blank';
            link.rel = 'noopener';
        }
    }
});
