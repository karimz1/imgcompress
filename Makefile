REGISTRY ?= docker.io/karimz1
IMAGE    ?= imgcompress
TAG      ?= latest
TRIVY    ?= aquasec/trivy:0.70.0@sha256:be1190afcb28352bfddc4ddeb71470835d16462af68d310f9f4bca710961a41e

IMAGE_REF := $(REGISTRY)/$(IMAGE):$(TAG)

.PHONY: build local trivy clean

# Multi-arch production build with SBOM + provenance attestations.
build:
	docker buildx build \
		--platform linux/amd64,linux/arm64 \
		--sbom="generator=docker/buildkit-syft-scanner:latest" \
		--provenance="mode=max" \
		-t $(IMAGE_REF) \
		.

# Local smoke-test build + run via the shared script.
local:
	@bash runLocalDockerBuildTester.sh

# Scan the built image for HIGH/CRITICAL CVEs.
trivy:
	docker run --rm \
		-v /var/run/docker.sock:/var/run/docker.sock \
		$(TRIVY) image \
		--severity HIGH,CRITICAL \
		--format table \
		--output scan-result.log \
		$(IMAGE_REF)

clean:
	-rm -f scan-result.log
