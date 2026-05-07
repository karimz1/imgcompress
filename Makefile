REGISTRY ?= docker.io/karimz1
IMAGE ?= imgcompress
TAG ?= docker-hardened
CLOUD_BUILDER=

# Build image with sbom and provenance, good for Docker Scout to indexing layers and attestation.
build:
	docker buildx build \
	--sbom="generator=docker/buildkit-syft-scanner:latest" \
	--provenance="mode=max" \
	-t $(REGISTRY)/$(IMAGE):$(TAG) \
	.

# Use Cloudbuild for faster build. Need a Docker Hub account and init a Cloud Builder
# cloud_build:
# 	docker buildx build \
# 	--builder $(CLOUD_BUILDER) \
# 	--sbom="generator=docker/buildkit-syft-scanner:latest" \
# 	--provenance="mode=max" \
# 	-t $(REGISTRY)/$(IMAGE):$(TAG) \
# 	--push \
# 	.

# Call Trivy scan image for vulnerabilites. It is a best practice to check the image after you build it.
trivy:
	docker run --rm -v \
	/var/run/docker.sock:/var/run/docker.sock \
	aquasec/trivy image \
	--severity HIGH,CRITICAL \
	--format table \
	--output scan-result.log \
	$(REGISTRY)/$(IMAGE):$(TAG)

local_build:
	@bash runLocalDockerBuildTester.sh