document.addEventListener("DOMContentLoaded", function () {
    const pullCountElements = document.querySelectorAll(".docker-pull-count");

    // 1. Initial State
    pullCountElements.forEach(el => el.textContent = "Loading...");

    function getFormatedDockerPulls(num) {
        if (isNaN(num) || num === null) return "0+";

        if (num >= 1_000_000) {
            return (num / 1_000_000).toFixed(1) + "M+";
        }

        if (num >= 1_000) {
            return (num / 1_000).toFixed(1) + "k+";
        }

        return num + "+";
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

                const dockerPullsFormatedString = getFormatedDockerPulls(pullCount);

                pullCountElements.forEach(element => {
                    element.textContent = dockerPullsFormatedString;
                });
            })
            .catch(error => {
                console.error("Error fetching docker pulls:", error);
                pullCountElements.forEach(el => el.textContent = fallbackMessage);
            });
    }
});
