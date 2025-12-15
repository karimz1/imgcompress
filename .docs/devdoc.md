# commands to use in devcontainer to simulate the behaviour of ci-auto-merge.yml

## integration tests

``` bash
cd .devcontainer/
docker build -f Dockerfile.base -t my-base-image .
docker build -t devcontainer:local-test .

cd ..
docker run --rm --entrypoint /bin/sh  -v /var/run/docker.sock:/var/run/docker.sock  -v "$(pwd):/app/"  -e IS_RUNNING_IN_GITHUB_ACTIONS=false  --name devcontainer  devcontainer:local-test /app/runIntegrationTests.sh
```

## unit tests

``` bash
cd .devcontainer/
docker build -f Dockerfile.base -t my-base-image .
docker build -t devcontainer:local-test .

cd ..
docker run --rm --entrypoint /bin/sh  -v /var/run/docker.sock:/var/run/docker.sock  -v "$(pwd):/app/"  -e IS_RUNNING_IN_GITHUB_ACTIONS=false  --name devcontainer  devcontainer:local-test /app/runUnitTests.sh
```



## e2e tests

```bash
docker run --rm -d \
        --network host \
        --name app \
        karimz1/imgcompress:local-test web


docker run --rm \
            --entrypoint /bin/sh \
            --network host \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v "$(pwd):/app/" \
            -e IS_RUNNING_IN_GITHUB_ACTIONS=false \
            -e PLAYWRIGHT_BASE_URL=http://localhost:5000 \
            --name devcontainer_e2e \
            devcontainer:local-test -c "/app/run-e2e.sh"
```