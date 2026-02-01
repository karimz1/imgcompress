document.addEventListener("DOMContentLoaded", function () {
    const desc = document.querySelector('.imgcompress-description');
    if (!desc) return;

    const phrases = [
        "Shrink images.",
        "Remove backgrounds using local AI.",
        "Convert formats fully offline."
    ];

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
    const itemHeight = 1.4; // em

    function showNextPhrase() {
        currentIndex = (currentIndex + 1) % phrases.length;

        // Update container transform to "scroll" up
        container.style.transform = `translateY(-${currentIndex * itemHeight}em)`;

        // Update active class for opacity/blur effects
        phraseElements.forEach((el, i) => {
            el.classList.toggle('active', i === currentIndex);
        });
    }

    // Initial state
    phraseElements[0].classList.add('active');

    // Cycle every 2.5 seconds (slightly faster for a modern feel)
    setInterval(showNextPhrase, 2500);
});
