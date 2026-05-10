REGISTRY ?= docker.io/karimz1
IMAGE ?= imgcompress
TAG ?= latest
SCOUT_TAG ?= 1-debian13-dev
CLOUD_BUILDER=

# Build image with sbom and provenance, 
# good for Docker Scout to indexing layers and attestation.
build:
	docker buildx build \
	--platform linux/amd64,linux/arm64 \
	--sbom="generator=docker/buildkit-syft-scanner:latest" \
	--provenance="mode=max" \
	-t $(REGISTRY)/$(IMAGE):$(TAG) \
	.

# Use Docker Hub Cloudbuild for faster build. 
# Need a Docker Hub account and must init a Cloud Builder first.
# cloud_build:
# 	docker buildx build \
# 	--platform linux/amd64,linux/arm64 \
# 	--builder $(CLOUD_BUILDER) \
# 	--sbom="generator=docker/buildkit-syft-scanner:latest" \
# 	--provenance="mode=max" \
# 	-t $(REGISTRY)/$(IMAGE):$(TAG) \
# 	--push \
# 	.

# Call Trivy to scan image for vulnerabilites. 
# It is a best practice to check the image after you build it.
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