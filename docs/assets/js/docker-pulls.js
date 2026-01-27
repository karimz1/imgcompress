document.addEventListener("DOMContentLoaded", function () {
    const pullCountElements = document.querySelectorAll(".docker-pull-count");

    // 1. Initial State
    pullCountElements.forEach(el => el.textContent = "Loading...");

    // 2. Formatting Helper (Future-proof)
    function formatDockerPulls(num) {
        if (isNaN(num) || num === null) return "0+";

        // If it's over 1 million
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace(/\.0$/, '') + "M+";
        }
        // If it's over 1 thousand
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + "k+";
        }
        return num + "+";
    }

    if (pullCountElements.length > 0) {
        const targetUrl = "https://hub.docker.com/v2/repositories/karimz1/imgcompress/";
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

        fetch(proxyUrl)
            .then(response => response.json())
            .then(data => {
                const dockerData = JSON.parse(data.contents);
                // Ensure we are passing a Number to the formatter
                const pullCount = Number(dockerData.pull_count);

                const finalString = formatDockerPulls(pullCount);

                pullCountElements.forEach(element => {
                    element.textContent = finalString;
                });
            })
            .catch(error => {
                console.error("Error:", error);
                pullCountElements.forEach(el => el.textContent = "21k+"); // Fallback to a static string
            });
    }
});