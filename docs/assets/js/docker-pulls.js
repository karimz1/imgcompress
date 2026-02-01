document.addEventListener("DOMContentLoaded", function () {
    const pullCountElements = document.querySelectorAll(".docker-pull-count");
    const rawElements = document.querySelectorAll(".docker-pull-count-raw");
    const shortElements = document.querySelectorAll(".docker-pull-count-short");

    // 1. Initial State
    const setAll = (els, txt) => els.forEach(el => el.textContent = txt);
    setAll(pullCountElements, "Loading...");
    setAll(rawElements, "...");
    setAll(shortElements, "...");

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


    if (pullCountElements.length > 0 || rawElements.length > 0 || shortElements.length > 0) {
        const targetUrl = "https://dfyf412h8jisw.cloudfront.net/pulls/karimz1/imgcompress";
        const fallbackMessage = "Could not load";

        fetch(targetUrl)
            .then(response => response.json())
            .then(data => {
                const pullCount = Number(data.docker_pulls);
                const dockerHubSyncedAtRaw = data.dockerhub_synced_at;
                const dockerHubSyncedAtDate = dockerHubSyncedAtRaw ? new Date(dockerHubSyncedAtRaw) : null;
                const updatedAtText = formatDateTime(dockerHubSyncedAtDate);

                if (!Number.isFinite(pullCount)) {
                    throw new Error("Invalid pull count returned from proxy");
                }

                const dockerPullsFormattedString = formatDockerPullsFull(pullCount);
                const pullCountK = `${Math.round(pullCount / 1000)}k`;
                const mainText = `${dockerPullsFormattedString} imgcompress installs`;

                // Dynamically update browser title
                const baseTitle = "ImgCompress - The Open Source App Image Toolkit";
                document.title = `${baseTitle} (${pullCountK} downloads)`;

                const metaText = updatedAtText
                    ? `Synced from Docker Hub API at ${updatedAtText}`
                    : "Synced from Docker Hub API (UTC)";
                const infoText = "Install count refreshes once per day";
                const tooltipContent = `<div style="text-align: center; font-size: 0.8rem; line-height: 1.4;">
                    <div style="font-weight: 700; margin-bottom: 2px;">${metaText}</div>
                    <div style="opacity: 0.8;">${infoText}</div>
                </div>`;

                // Update standard elements with icons/tooltips
                pullCountElements.forEach(element => {
                    element.innerHTML = `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="color: #2496ED; vertical-align: middle; margin-right: 6px;">
                            <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"></path>
                        </svg>
                        <span style="vertical-align: middle;">${mainText}</span>
                        <i class="fa-solid fa-circle-info" style="font-size: 0.8rem; margin-left: 6px; opacity: 0.6; vertical-align: middle;"></i>
                    `;

                    if (typeof tippy !== 'undefined') {
                        tippy(element, {
                            content: tooltipContent,
                            allowHTML: true,
                            animation: 'shift-away',
                            theme: 'light-border',
                            interactive: true,
                            placement: 'bottom',
                        });
                    }
                });

                // Update raw and short in-page elements
                setAll(rawElements, dockerPullsFormattedString);
                setAll(shortElements, pullCountK);
            })
            .catch(error => {
                console.error("Error fetching docker pulls:", error);
                setAll(pullCountElements, fallbackMessage);
            });
    }
});
