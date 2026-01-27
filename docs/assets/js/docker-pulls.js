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
        const targetUrl = "https://hub.docker.com/v2/repositories/karimz1/imgcompress/";

        fetch(targetUrl)
            .then(response => response.json())
            .then(data => {
                const dockerData = JSON.parse(data.contents);
                const pullCount = Number(dockerData.pull_count);

                const dockerPullsFormatedString = getFormatedDockerPulls(pullCount);

                pullCountElements.forEach(element => {
                    element.textContent = dockerPullsFormatedString;
                });
            })
            .catch(error => {
                console.error("Error:", error);
                pullCountElements.forEach(el => el.textContent = "21k+"); // Fallback to a static string
            });
    }
});