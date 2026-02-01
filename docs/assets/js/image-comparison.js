function initImageSliders() {
    const sliders = document.querySelectorAll('.comparison-slider');

    sliders.forEach(slider => {
        const modifiedImg = slider.querySelector('.modified');
        const handle = slider.querySelector('.slider-handle');
        let isResizing = false;

        // Default to showing the original image (0% of the modified top layer visible)
        let position = slider.getAttribute('data-start-pos') || 0;
        updateSliderPosition(position);

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;
        });
        window.addEventListener('mouseup', () => isResizing = false);
        window.addEventListener('mousemove', e => {
            if (!isResizing) return;

            const rect = slider.getBoundingClientRect();
            let x = e.pageX - rect.left - window.scrollX;

            // Boundary checks
            if (x < 0) x = 0;
            if (x > rect.width) x = rect.width;

            position = (x / rect.width) * 100;
            updateSliderPosition(position);
            switchButtons.forEach(b => b.classList.remove('active'));
        });

        // Touch support
        handle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isResizing = true;
        });
        window.addEventListener('touchend', () => isResizing = false);
        window.addEventListener('touchmove', e => {
            if (!isResizing) return;

            const rect = slider.getBoundingClientRect();
            const touch = e.touches[0];
            let x = touch.pageX - rect.left - window.scrollX;

            if (x < 0) x = 0;
            if (x > rect.width) x = rect.width;

            position = (x / rect.width) * 100;
            updateSliderPosition(position);
            switchButtons.forEach(b => b.classList.remove('active'));
        });

        // Switch Button Support
        const wrapper = slider.closest('.comparison-slider-wrapper') || slider.parentElement;
        const switchButtons = wrapper.querySelectorAll('.comparison-switch-btn');

        switchButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPos = btn.getAttribute('data-pos');
                if (targetPos === null) return;

                // Add animating class for smooth easing
                slider.classList.add('is-animating');
                position = parseInt(targetPos);
                updateSliderPosition(position);

                // Remove animating class after transition finishes
                setTimeout(() => {
                    slider.classList.remove('is-animating');
                }, 600);

                // Update active state of buttons
                switchButtons.forEach(b => b.classList.toggle('active', b === btn));
            });
        });

        function updateSliderPosition(pos) {
            modifiedImg.style.clipPath = `inset(0 ${100 - pos}% 0 0)`;
            handle.style.left = `${pos}%`;
        }
    });
}

document.addEventListener('DOMContentLoaded', initImageSliders);
document.addEventListener('DOMContentUpdated', initImageSliders); // For MkDocs search/nav
