from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from aws_cdk import (
    CfnOutput,
    Duration,
    RemovalPolicy,
    Stack,
    Token,
)
from aws_cdk import aws_certificatemanager as acm
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_cloudfront_origins as origins
from aws_cdk import aws_route53 as route53
from aws_cdk import aws_route53_targets as route53_targets
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_s3_deployment as s3deploy
from constructs import Construct


@dataclass(frozen=True)
class SiteConfig:
    deploy_docs: bool
    docs_dir: Path
    enable_custom_domain: bool
    hosted_zone_domain: str
    site_domain: str

    @staticmethod
    def from_context(scope: Construct) -> "SiteConfig":
        """
        Reads CDK context values and enforces that domain settings are explicitly provided
        when enable_custom_domain is true.

        Required when enable_custom_domain=true:
          - hosted_zone_domain
          - site_domain
        """
        deploy_docs = scope.node.try_get_context("deploy_docs")
        if deploy_docs is None:
            deploy_docs = True

        docs_path = scope.node.try_get_context("docs_path")
        if not docs_path:
            docs_path = str(Path(__file__).resolve().parents[2] / "site")
        docs_dir = Path(docs_path).expanduser().resolve()

        enable_custom_domain = scope.node.try_get_context("enable_custom_domain")
        if enable_custom_domain is None:
            enable_custom_domain = True

        hosted_zone_domain = scope.node.try_get_context("hosted_zone_domain")
        site_domain = scope.node.try_get_context("site_domain")

        if bool(enable_custom_domain):
            if not hosted_zone_domain:
                raise ValueError(
                    "Missing required CDK context 'hosted_zone_domain' (because enable_custom_domain=true). "
                    "Example: -c hosted_zone_domain=karimzouine.com"
                )
            if not site_domain:
                raise ValueError(
                    "Missing required CDK context 'site_domain' (because enable_custom_domain=true). "
                    "Example: -c site_domain=imgcompress.karimzouine.com"
                )

        return SiteConfig(
            deploy_docs=bool(deploy_docs),
            docs_dir=docs_dir,
            enable_custom_domain=bool(enable_custom_domain),
            hosted_zone_domain=str(hosted_zone_domain) if hosted_zone_domain else "",
            site_domain=str(site_domain) if site_domain else "",
        )


class ImgcompressStaticSiteStack(Stack):
    """
    Static docs hosting: private S3 bucket behind CloudFront, optional custom domain via Route53 + ACM.
    Tuned for fast global delivery and low cost (PriceClass_100) with SEO-friendly clean URLs.
    """

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        cfg = SiteConfig.from_context(self)

        if cfg.deploy_docs and not cfg.docs_dir.exists():
            raise ValueError(
                f"Docs output directory not found: {cfg.docs_dir}. "
                "Run the build step before deploying."
            )

        bucket = self._create_bucket()

        oai = cloudfront.OriginAccessIdentity(self, "DocsOAI")
        bucket.grant_read(oai)

        origin = origins.S3BucketOrigin.with_origin_access_identity(
            bucket, origin_access_identity=oai
        )

        zone: Optional[route53.IHostedZone] = None
        certificate: Optional[acm.ICertificate] = None
        domain_names: Optional[list[str]] = None

        if cfg.enable_custom_domain:
            self._assert_cloudfront_cert_region()
            zone = route53.HostedZone.from_lookup(
                self, "HostedZone", domain_name=cfg.hosted_zone_domain
            )
            certificate = acm.Certificate(
                self,
                "SiteCertificate",
                domain_name=cfg.site_domain,
                validation=acm.CertificateValidation.from_dns(zone),
            )
            domain_names = [cfg.site_domain]

        html_cache_policy = cloudfront.CachePolicy(
            self,
            "HtmlCachePolicy",
            min_ttl=Duration.seconds(0),
            default_ttl=Duration.hours(1),
            max_ttl=Duration.days(1),
            cookie_behavior=cloudfront.CacheCookieBehavior.none(),
            header_behavior=cloudfront.CacheHeaderBehavior.none(),
            query_string_behavior=cloudfront.CacheQueryStringBehavior.none(),
            enable_accept_encoding_brotli=True,
            enable_accept_encoding_gzip=True,
        )

        assets_cache_policy = cloudfront.CachePolicy(
            self,
            "AssetsCachePolicy",
            min_ttl=Duration.days(1),
            default_ttl=Duration.days(30),
            max_ttl=Duration.days(365),
            cookie_behavior=cloudfront.CacheCookieBehavior.none(),
            header_behavior=cloudfront.CacheHeaderBehavior.none(),
            query_string_behavior=cloudfront.CacheQueryStringBehavior.none(),
            enable_accept_encoding_brotli=True,
            enable_accept_encoding_gzip=True,
        )

        origin_request_policy = cloudfront.OriginRequestPolicy(
            self,
            "StaticOriginRequestPolicy",
            comment="Static site: do not forward cookies/headers/querystrings",
            cookie_behavior=cloudfront.OriginRequestCookieBehavior.none(),
            header_behavior=cloudfront.OriginRequestHeaderBehavior.none(),
            query_string_behavior=cloudfront.OriginRequestQueryStringBehavior.none(),
        )

        html_headers_policy = self._headers_policy(
            "HtmlHeadersPolicy",
            cache_control="public, max-age=300",
        )
        assets_headers_policy = self._headers_policy(
            "AssetsHeadersPolicy",
            cache_control="public, max-age=31536000, immutable",
        )

        url_rewrite_fn = self._url_rewrite_function()

        distribution = cloudfront.Distribution(
            self,
            "DocsDistribution",
            certificate=certificate,
            domain_names=domain_names,
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,
            default_root_object="index.html",
            http_version=cloudfront.HttpVersion.HTTP2_AND_3,
            minimum_protocol_version=cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            default_behavior=cloudfront.BehaviorOptions(
                origin=origin,
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                compress=True,
                cache_policy=html_cache_policy,
                origin_request_policy=origin_request_policy,
                response_headers_policy=html_headers_policy,
                function_associations=[
                    cloudfront.FunctionAssociation(
                        event_type=cloudfront.FunctionEventType.VIEWER_REQUEST,
                        function=url_rewrite_fn,
                    )
                ],
            ),
            additional_behaviors={
                "assets/*": self._assets_behavior(
                    origin, assets_cache_policy, origin_request_policy, assets_headers_policy
                ),
                "images/*": self._assets_behavior(
                    origin, assets_cache_policy, origin_request_policy, assets_headers_policy
                ),
                "javascripts/*": self._assets_behavior(
                    origin, assets_cache_policy, origin_request_policy, assets_headers_policy
                ),
                "stylesheets/*": self._assets_behavior(
                    origin, assets_cache_policy, origin_request_policy, assets_headers_policy
                ),
                "fonts/*": self._assets_behavior(
                    origin, assets_cache_policy, origin_request_policy, assets_headers_policy
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

        if cfg.enable_custom_domain and zone is not None:
            record_name = self._relative_record_name(
                cfg.site_domain, cfg.hosted_zone_domain
            )
            route53.ARecord(
                self,
                "SiteAliasA",
                zone=zone,
                record_name=record_name,
                target=route53.RecordTarget.from_alias(
                    route53_targets.CloudFrontTarget(distribution)
                ),
            )
            route53.AaaaRecord(
                self,
                "SiteAliasAAAA",
                zone=zone,
                record_name=record_name,
                target=route53.RecordTarget.from_alias(
                    route53_targets.CloudFrontTarget(distribution)
                ),
            )

        if cfg.deploy_docs:
            s3deploy.BucketDeployment(
                self,
                "DeployDocs",
                sources=[
                    s3deploy.Source.asset(
                        str(cfg.docs_dir),
                        exclude=["**/.DS_Store", "**/__MACOSX/*"],
                    )
                ],
                destination_bucket=bucket,
                distribution=distribution,
                distribution_paths=["/*"],
            )

        CfnOutput(self, "CloudFrontUrl", value=f"https://{distribution.domain_name}")
        if cfg.enable_custom_domain:
            CfnOutput(self, "CustomDomainUrl", value=f"https://{cfg.site_domain}")
        CfnOutput(self, "BucketName", value=bucket.bucket_name)

    def _assert_cloudfront_cert_region(self) -> None:
        """CloudFront custom domains require the ACM certificate to be created in us-east-1."""
        if not Token.is_unresolved(self.region) and self.region != "us-east-1":
            raise ValueError(
                "Custom domain for CloudFront requires deploying this stack in us-east-1 "
                f"(current region: {self.region})."
            )

    def _create_bucket(self) -> s3.Bucket:
        """Creates a private S3 bucket; destroying the stack will delete the bucket and its contents."""
        return s3.Bucket(
            self,
            "DocsBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            encryption=s3.BucketEncryption.S3_MANAGED,
            object_ownership=s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

    def _url_rewrite_function(self) -> cloudfront.Function:
        """Rewrites clean URLs to folder index pages (e.g. /guide -> /guide/index.html)."""
        return cloudfront.Function(
            self,
            "DocsUrlRewriteFn",
            code=cloudfront.FunctionCode.from_inline(
                """
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
    return request;
  }

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

    def _headers_policy(
        self,
        logical_id: str,
        cache_control: str,
        extra_headers: Optional[dict[str, str]] = None,
    ) -> cloudfront.ResponseHeadersPolicy:
        """Security headers + cache-control headers suitable for static content."""
        custom_headers = [
            cloudfront.ResponseCustomHeader(
                header="Cache-Control",
                value=cache_control,
                override=True,
            )
        ]

        if extra_headers:
            for k, v in extra_headers.items():
                custom_headers.append(
                    cloudfront.ResponseCustomHeader(header=k, value=v, override=True)
                )

        return cloudfront.ResponseHeadersPolicy(
            self,
            logical_id,
            security_headers_behavior=cloudfront.ResponseSecurityHeadersBehavior(
                strict_transport_security=cloudfront.ResponseHeadersStrictTransportSecurity(
                    access_control_max_age=Duration.days(365),
                    include_subdomains=True,
                    preload=True,
                    override=True,
                ),
                content_type_options=cloudfront.ResponseHeadersContentTypeOptions(
                    override=True
                ),
                frame_options=cloudfront.ResponseHeadersFrameOptions(
                    frame_option=cloudfront.HeadersFrameOption.DENY,
                    override=True,
                ),
                referrer_policy=cloudfront.ResponseHeadersReferrerPolicy(
                    referrer_policy=cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
                    override=True,
                ),
                xss_protection=cloudfront.ResponseHeadersXSSProtection(
                    protection=True,
                    mode_block=True,
                    override=True,
                ),
            ),
            custom_headers_behavior=cloudfront.ResponseCustomHeadersBehavior(
                custom_headers=custom_headers
            ),
        )

    def _assets_behavior(
        self,
        origin: origins.S3BucketOrigin,
        cache_policy: cloudfront.ICachePolicy,
        origin_request_policy: cloudfront.IOriginRequestPolicy,
        headers_policy: cloudfront.IResponseHeadersPolicy,
    ) -> cloudfront.BehaviorOptions:
        """Behavior for cacheable static assets (CSS/JS/images/fonts)."""
        return cloudfront.BehaviorOptions(
            origin=origin,
            viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            compress=True,
            cache_policy=cache_policy,
            origin_request_policy=origin_request_policy,
            response_headers_policy=headers_policy,
        )

    @staticmethod
    def _relative_record_name(site_domain: str, hosted_zone_domain: str) -> str:
        """Converts a FQDN into the Route53 record_name relative to the hosted zone."""
        suffix = f".{hosted_zone_domain}"
        if site_domain.endswith(suffix):
            return site_domain[: -len(suffix)]
        return site_domain