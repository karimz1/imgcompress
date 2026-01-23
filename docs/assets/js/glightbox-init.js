// GLightbox initialization - optimized for performance
(function () {
    'use strict';

    var imagePattern = /\.(jpe?g|png|gif|webp|svg|bmp|avif)$/i;

    function init() {
        var images = document.querySelectorAll('article img');
        var i, img, parentLink, caption, link;

        for (i = 0; i < images.length; i++) {
            img = images[i];
            img.classList.remove('glightbox');
            parentLink = img.closest('a');
            caption = img.getAttribute('alt');

            if (!parentLink) {
                link = document.createElement('a');
                link.href = img.src;
                link.className = 'custom-glightbox';
                if (caption) {
                    link.setAttribute('data-title', caption);
                    img.removeAttribute('alt');
                }
                img.parentNode.insertBefore(link, img);
                link.appendChild(img);
            } else if (imagePattern.test(parentLink.href)) {
                parentLink.classList.add('custom-glightbox');
                if (caption && !parentLink.getAttribute('data-title')) {
                    parentLink.setAttribute('data-title', caption);
                    img.removeAttribute('alt');
                }
            }
        }

        GLightbox({
            selector: '.custom-glightbox',
            touchNavigation: true,
            loop: false,
            zoomable: true,
            draggable: true,
            openEffect: 'zoom',
            closeEffect: 'zoom'
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
