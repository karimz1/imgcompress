document.addEventListener("DOMContentLoaded", function () {
    const pullCountElements = document.querySelectorAll(".docker-pull-count");

    // 1. Initial State
    pullCountElements.forEach(el => el.textContent = "Loading...");

    function formatDockerPullsFull(num) {
        // Show the full count with dot thousands separators
        if (!Number.isFinite(num)) return "0";
        return Math.trunc(num).toLocaleString("de-DE");
    }

    function formatDateTime(date) {
        if (!(date instanceof Date) || Number.isNaN(date)) return null;
        return date.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
            timeZoneName: "short",
        });
    }


    if (pullCountElements.length > 0) {
        const targetUrl = "https://dfyf412h8jisw.cloudfront.net/pulls/karimz1/imgcompress";
        const fallbackMessage = "Could not load";
        const dockerHubUrl = "https://hub.docker.com/r/karimz1/imgcompress";

        fetch(targetUrl)
            .then(response => response.json())
            .then(data => {
                const pullCount = Number(data.docker_pulls);
                const dockerHubSyncedAtRaw = data.dockerhub_synced_at;
                const dockerHubSyncedAtDate = dockerHubSyncedAtRaw ? new Date(dockerHubSyncedAtRaw) : null;
                const updatedAtDate = dockerHubSyncedAtDate || null;
                const updatedAtText = formatDateTime(updatedAtDate);

                if (!Number.isFinite(pullCount)) {
                    throw new Error("Invalid pull count returned from proxy");
                }

                const dockerPullsFormattedString = formatDockerPullsFull(pullCount);
                const mainText = `${dockerPullsFormattedString} total imgcompress installs`;
                const metaText = updatedAtText
                    ? `Synced from Docker Hub at ${updatedAtText}`
                    : "Synced from Docker Hub (UTC)";
                const infoText = "Install count refreshes once per day";
                const titleText = `${metaText} · ${infoText}`;

                pullCountElements.forEach(element => {
                    element.innerHTML = `
                        <div class="docker-pulls-main">${mainText}</div>
                        <div class="docker-pulls-meta">${metaText}</div>
                        <div class="docker-pulls-meta">${infoText}</div>
                    `;
                    element.setAttribute("title", titleText);

                    const statsContainer = element.closest(".imgcompress-stats");
                    const dockerIcon = statsContainer ? statsContainer.querySelector(".fa-docker") : null;
                    const openHub = () => window.open(dockerHubUrl, "_blank", "noopener");

                    if (statsContainer) {
                        statsContainer.style.cursor = "pointer";
                        statsContainer.setAttribute("role", "link");
                        statsContainer.setAttribute("tabindex", "0");
                        statsContainer.setAttribute("title", "Open Docker Hub");
                        statsContainer.classList.add("stats-link");
                        statsContainer.addEventListener("click", openHub);
                        statsContainer.addEventListener("keydown", (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openHub();
                            }
                        });
                    }

                    if (dockerIcon) {
                        dockerIcon.setAttribute("aria-hidden", "true");
                    }
                });
            })
            .catch(error => {
                console.error("Error fetching docker pulls:", error);
                pullCountElements.forEach(el => el.textContent = fallbackMessage);
            });
    }
});
