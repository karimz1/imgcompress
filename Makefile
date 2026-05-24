REGISTRY ?= docker.io/karimz1
IMAGE ?= imgcompress
TAG ?= local-dev
IMAGE_REF ?= $(REGISTRY)/$(IMAGE):$(TAG)
LOCAL_PLATFORM ?= linux/amd64

.PHONY: build build-local scan trivy lint unit integration e2e feature-flags local simci

# Multi-arch build used for release validation. The CI deployment workflow is
# responsible for pushing published images.
build: lint
	docker buildx build \
		--platform linux/amd64,linux/arm64 \
		--sbom="generator=docker/buildkit-syft-scanner:latest" \
		--provenance="mode=max" \
		-t $(IMAGE_REF) \
		.

# Single-platform build loaded into the local Docker daemon, used by scan/local testing.
build-local: lint
	docker buildx build \
		--platform $(LOCAL_PLATFORM) \
		--load \
		-t $(IMAGE_REF) \
		.

scan: build-local
	IMAGE_REF="$(IMAGE_REF)" ./scripts/runTrivyImageScan.sh

deploy-local: lint
	./scripts/runLocalDockerBuildTester.sh

deploy-local-dev-mode: lint
	./scripts/runLocalDockerBuildTester.sh

trivy: scan

lint:
	./scripts/runPythonLint.sh

unit: lint
	./scripts/runUnitTests.sh

integration: lint
	./scripts/runIntegrationTests.sh

e2e: lint
	./scripts/run-e2e.sh

feature-flags: lint
	./scripts/runFeatureFlagsDockerE2E.sh

local: lint
	./scripts/runLocalDockerBuildTester.sh

# Simulate the full GitHub Actions CI locally: builds the devcontainer,
# runs lint + tests inside it, builds the app image, runs E2E.
simci: lint
	./scripts/simulateCiTests.sh
