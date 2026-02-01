document.addEventListener("DOMContentLoaded", function () {
    const pullCountElements = document.querySelectorAll(".docker-pull-count");

    // 1. Initial State
    pullCountElements.forEach(el => el.textContent = "Loading...");

    function formatDockerPullsFull(num) {
        // Show the full count with dot thousands separators
        if (!Number.isFinite(num)) return "0";
        return Math.trunc(num).toLocaleString("de-DE");
    }


    if (pullCountElements.length > 0) {
        const targetUrl = "https://dfyf412h8jisw.cloudfront.net/pulls/karimz1/imgcompress";
        const fallbackMessage = "Could not load";

        fetch(targetUrl)
            .then(response => response.json())
            .then(data => {
                const pullCount = Number(data.docker_pulls);

                if (!Number.isFinite(pullCount)) {
                    throw new Error("Invalid pull count returned from proxy");
                }

                const dockerPullsFormattedString = formatDockerPullsFull(pullCount);
                const mainText = `${dockerPullsFormattedString} total installs`;
                const metaText = "cache refreshes daily";

                pullCountElements.forEach(element => {
                    element.innerHTML = `${mainText}<br><small class="docker-pulls-meta">${metaText}</small>`;
                    element.setAttribute("title", "Install count cache refreshes once per day");
                });
            })
            .catch(error => {
                console.error("Error fetching docker pulls:", error);
                pullCountElements.forEach(el => el.textContent = fallbackMessage);
            });
    }
});
