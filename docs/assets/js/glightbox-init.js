document.addEventListener("DOMContentLoaded", function () {
    const images = document.querySelectorAll('article img');

    images.forEach(img => {
        // 1. Remove any glightbox class from the image itself 
        // to prevent GLightbox from finding it via its default selectors
        img.classList.remove('glightbox');

        let parentLink = img.closest('a');
        const caption = img.getAttribute('alt');

        if (!parentLink) {
            // 2. Wrap in a special link if not already linked
            const link = document.createElement('a');
            link.href = img.src;
            link.className = 'custom-glightbox';
            if (caption) {
                link.setAttribute('data-title', caption);
                // Important: clear alt to prevent GLightbox from reading it again
                img.removeAttribute('alt');
            }
            img.parentNode.insertBefore(link, img);
            link.appendChild(img);
        } else {
            // 3. Configure the existing link
            if (parentLink.href.match(/\.(jupyter|jpg|jpeg|png|gif|webp|svg|bmp)$/i)) {
                parentLink.classList.add('custom-glightbox');
                if (caption && !parentLink.getAttribute('data-title')) {
                    parentLink.setAttribute('data-title', caption);
                    img.removeAttribute('alt');
                }
            }
        }
    });

    // Initialize with a custom selector to avoid conflicts with default behaviors
    const lightbox = GLightbox({
        selector: '.custom-glightbox',
        touchNavigation: true,
        loop: false,
        zoomable: true,
        draggable: true,
        openEffect: 'zoom',
        closeEffect: 'zoom',
    });
});


