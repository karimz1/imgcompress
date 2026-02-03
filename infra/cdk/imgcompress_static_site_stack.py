from __future__ import annotations

from pathlib import Path

from aws_cdk import (
    CfnOutput,
    Duration,
    RemovalPolicy,
    Stack,
)
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_cloudfront_origins as origins
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_s3_deployment as s3deploy
from constructs import Construct


class ImgcompressStaticSiteStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        deploy_docs = self.node.try_get_context("deploy_docs")
        if deploy_docs is None:
            deploy_docs = True

        docs_path = self.node.try_get_context("docs_path")
        if not docs_path:
            docs_path = str(Path(__file__).resolve().parents[2] / "site")

        docs_dir = Path(docs_path).expanduser().resolve()

        if deploy_docs and not docs_dir.exists():
            raise ValueError(
                f"Docs output directory not found: {docs_dir}. "
                "Run the build step before deploying."
            )

        bucket = s3.Bucket(
            self,
            "DocsBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            object_ownership=s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # SEO + UX: keep HTML reasonably fresh while still benefiting from CDN caching.
        html_cache_policy = cloudfront.CachePolicy(
            self,
            "DocsHtmlCachePolicy",
            min_ttl=Duration.seconds(0),
            default_ttl=Duration.minutes(5),
            max_ttl=Duration.hours(1),
            cookie_behavior=cloudfront.CacheCookieBehavior.none(),
            header_behavior=cloudfront.CacheHeaderBehavior.none(),
            query_string_behavior=cloudfront.CacheQueryStringBehavior.none(),
            enable_accept_encoding_brotli=True,
            enable_accept_encoding_gzip=True,
        )

        # Static assets can be cached longer; deployments invalidate paths anyway.
        assets_cache_policy = cloudfront.CachePolicy(
            self,
            "DocsAssetsCachePolicy",
            min_ttl=Duration.minutes(5),
            default_ttl=Duration.days(1),
            max_ttl=Duration.days(7),
            cookie_behavior=cloudfront.CacheCookieBehavior.none(),
            header_behavior=cloudfront.CacheHeaderBehavior.none(),
            query_string_behavior=cloudfront.CacheQueryStringBehavior.none(),
            enable_accept_encoding_brotli=True,
            enable_accept_encoding_gzip=True,
        )

        origin_request_policy = cloudfront.OriginRequestPolicy(
            self,
            "DocsOriginRequestPolicy",
            comment="Do not forward cookies/headers/querystrings for a static docs site",
            cookie_behavior=cloudfront.OriginRequestCookieBehavior.none(),
            header_behavior=cloudfront.OriginRequestHeaderBehavior.none(),
            query_string_behavior=cloudfront.OriginRequestQueryStringBehavior.none(),
        )

        url_rewrite_fn = cloudfront.Function(
            self,
            "DocsUrlRewriteFn",
            code=cloudfront.FunctionCode.from_inline(
                """
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // If the URI ends with '/', serve index.html in that directory
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
    return request;
  }

  // If the URI has no file extension, assume directory and serve index.html
  var lastSegment = uri.split('/').pop();
  if (lastSegment && lastSegment.indexOf('.') === -1) {
    request.uri = uri + '/index.html';
    return request;
  }

  return request;
}
                """.strip()
            ),
        )

        origin_access_identity = cloudfront.OriginAccessIdentity(
            self, "DocsOriginAccessIdentity"
        )
        bucket.grant_read(origin_access_identity)

        origin = origins.S3BucketOrigin.with_origin_access_identity(
            bucket, origin_access_identity=origin_access_identity
        )

        distribution = cloudfront.Distribution(
            self,
            "DocsDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origin,
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                compress=True,
                cache_policy=html_cache_policy,
                origin_request_policy=origin_request_policy,
                response_headers_policy=cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
                function_associations=[
                    cloudfront.FunctionAssociation(
                        event_type=cloudfront.FunctionEventType.VIEWER_REQUEST,
                        function=url_rewrite_fn,
                    )
                ],
            ),
            default_root_object="index.html",
            http_version=cloudfront.HttpVersion.HTTP2_AND_3,
            additional_behaviors={
                "assets/*": cloudfront.BehaviorOptions(
                    origin=origin,
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    compress=True,
                    cache_policy=assets_cache_policy,
                    origin_request_policy=origin_request_policy,
                    response_headers_policy=cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
                ),
                "images/*": cloudfront.BehaviorOptions(
                    origin=origin,
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    compress=True,
                    cache_policy=assets_cache_policy,
                    origin_request_policy=origin_request_policy,
                    response_headers_policy=cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
                ),
                "javascripts/*": cloudfront.BehaviorOptions(
                    origin=origin,
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    compress=True,
                    cache_policy=assets_cache_policy,
                    origin_request_policy=origin_request_policy,
                    response_headers_policy=cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
                ),
                "stylesheets/*": cloudfront.BehaviorOptions(
                    origin=origin,
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    compress=True,
                    cache_policy=assets_cache_policy,
                    origin_request_policy=origin_request_policy,
                    response_headers_policy=cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
                ),
            },
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=404,
                    response_page_path="/404/index.html",
                    ttl=Duration.seconds(0),
                ),
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=404,
                    response_page_path="/404/index.html",
                    ttl=Duration.seconds(0),
                ),
            ],
        )

        if deploy_docs:
            s3deploy.BucketDeployment(
                self,
                "DeployDocs",
                sources=[s3deploy.Source.asset(str(docs_dir))],
                destination_bucket=bucket,
                distribution=distribution,
                distribution_paths=["/*"],
            )

        CfnOutput(
            self,
            "CloudFrontUrl",
            value=f"https://{distribution.domain_name}",
        )

        CfnOutput(
            self,
            "BucketName",
            value=bucket.bucket_name,
        )
