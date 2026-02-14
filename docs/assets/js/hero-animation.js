document.addEventListener("DOMContentLoaded", function () {
    const desc = document.querySelector('.imgcompress-description');
    if (!desc) return;
    desc.classList.add('animated');

    // Check for phrases from data attribute (set in index.md)
    const dataPhrases = desc.getAttribute('data-phrases');
    const phrases = dataPhrases ? dataPhrases.split(':::') : [];

    // If no phrases, do not animate (leave static text)
    if (!phrases.length) return;

    desc.innerHTML = '<div class="phrase-container"></div>';
    const container = desc.querySelector('.phrase-container');

    // Pre-create phrases for smooth transitions
    const phraseElements = phrases.map((text, i) => {
        const el = document.createElement('div');
        el.className = 'description-phrase';
        el.textContent = text;
        container.appendChild(el);
        return el;
    });

    let currentIndex = 0;
    let itemHeightPx = 0;

    function updateItemHeight() {
        if (!phraseElements[0]) return;
        itemHeightPx = phraseElements[0].getBoundingClientRect().height;
    }

    function showNextPhrase() {
        currentIndex = (currentIndex + 1) % phrases.length;

        // Update container transform to "scroll" up
        container.style.transform = `translateY(-${currentIndex * itemHeightPx}px)`;

        // Update active class for opacity/blur effects
        phraseElements.forEach((el, i) => {
            el.classList.toggle('active', i === currentIndex);
        });
    }

    // Initial state
    phraseElements[0].classList.add('active');
    updateItemHeight();

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(updateItemHeight);
    }

    window.addEventListener('resize', updateItemHeight);

    // Cycle every 2.5 seconds (slightly faster for a modern feel)
    setInterval(showNextPhrase, 2500);
});
