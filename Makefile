# Build production image with sbom and provenance
build_production_image:
	docker buildx build \
	--sbom="generator=docker/buildkit-syft-scanner:latest" \
	--provenance="mode=max" \
	-t <tên-image>:<tag> \
	.

run_tester_image:
	@bash runLocalDockerBuildTester.sh