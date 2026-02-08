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
    def _parse_bool(value: object, default: bool) -> bool:
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "y", "on"}:
                return True
            if normalized in {"0", "false", "no", "n", "off"}:
                return False
        return bool(value)

    @staticmethod
    def from_context(scope: Construct) -> "SiteConfig":
        deploy_docs = SiteConfig._parse_bool(
            scope.node.try_get_context("deploy_docs"), default=True
        )

        docs_path = scope.node.try_get_context("docs_path")
        if not docs_path:
            docs_path = str(Path(__file__).resolve().parents[2] / "site")
        docs_dir = Path(docs_path).expanduser().resolve()

        enable_custom_domain = SiteConfig._parse_bool(
            scope.node.try_get_context("enable_custom_domain"), default=True
        )

        hosted_zone_domain = scope.node.try_get_context("hosted_zone_domain")
        site_domain = scope.node.try_get_context("site_domain")

        if bool(enable_custom_domain):
            if not hosted_zone_domain:
                raise ValueError("Missing required CDK context 'hosted_zone_domain'")
            if not site_domain:
                raise ValueError("Missing required CDK context 'site_domain'")

        return SiteConfig(
            deploy_docs=deploy_docs,
            docs_dir=docs_dir,
            enable_custom_domain=enable_custom_domain,
            hosted_zone_domain=str(hosted_zone_domain) if hosted_zone_domain else "",
            site_domain=str(site_domain) if site_domain else "",
        )


class ImgcompressStaticSiteStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        cfg = SiteConfig.from_context(self)

        if cfg.deploy_docs and not cfg.docs_dir.exists():
            raise ValueError(f"Docs directory not found: {cfg.docs_dir}")

        bucket = self._create_bucket()
        origin = origins.S3BucketOrigin.with_origin_access_control(bucket)

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

        html_cache = cloudfront.CachePolicy(
            self,
            "HtmlCachePolicy",
            default_ttl=Duration.hours(1),
            enable_accept_encoding_brotli=True,
            enable_accept_encoding_gzip=True,
        )

        assets_cache = cloudfront.CachePolicy(
            self,
            "AssetsCachePolicy",
            default_ttl=Duration.days(30),
            max_ttl=Duration.days(365),
            enable_accept_encoding_brotli=True,
            enable_accept_encoding_gzip=True,
        )

        request_policy = cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN

        html_headers = self._headers_policy("HtmlHeaders", "public, max-age=300")
        assets_headers = self._headers_policy(
            "AssetsHeaders", "public, max-age=31536000, immutable"
        )

        url_rewrite_fn = self._url_rewrite_function()

        asset_behavior = cloudfront.BehaviorOptions(
            origin=origin,
            viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            compress=True,
            cache_policy=assets_cache,
            origin_request_policy=request_policy,
            response_headers_policy=assets_headers,
        )

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
                cache_policy=html_cache,
                origin_request_policy=request_policy,
                response_headers_policy=html_headers,
                function_associations=[
                    cloudfront.FunctionAssociation(
                        event_type=cloudfront.FunctionEventType.VIEWER_REQUEST,
                        function=url_rewrite_fn,
                    )
                ],
            ),
            additional_behaviors={
                pattern: asset_behavior
                for pattern in [
                    "assets/*",
                    "images/*",
                    "javascripts/*",
                    "stylesheets/*",
                    "fonts/*",
                ]
            },
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=404,
                    response_page_path="/404/index.html",
                ),
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=404,
                    response_page_path="/404/index.html",
                ),
            ],
        )

        if cfg.enable_custom_domain and zone:
            record_name = self._relative_record_name(
                cfg.site_domain, cfg.hosted_zone_domain
            )
            target = route53.RecordTarget.from_alias(
                route53_targets.CloudFrontTarget(distribution)
            )
            route53.ARecord(self, "AliasA", zone=zone, record_name=record_name, target=target)
            route53.AaaaRecord(self, "AliasAAAA", zone=zone, record_name=record_name, target=target)

        if cfg.deploy_docs:
            s3deploy.BucketDeployment(
                self,
                "DeployDocs",
                sources=[
                    s3deploy.Source.asset(
                        str(cfg.docs_dir), exclude=["**/.DS_Store", "**/__MACOSX/*"]
                    )
                ],
                destination_bucket=bucket,
                distribution=distribution,
                distribution_paths=["/*"],
            )

        CfnOutput(self, "CloudFrontUrl", value=f"https://{distribution.domain_name}")
        if cfg.enable_custom_domain:
            CfnOutput(self, "CustomDomainUrl", value=f"https://{cfg.site_domain}")

    def _assert_cloudfront_cert_region(self) -> None:
        if not Token.is_unresolved(self.region) and self.region != "us-east-1":
            raise ValueError(f"CloudFront certificates require us-east-1 (current: {self.region})")

    def _create_bucket(self) -> s3.Bucket:
        return s3.Bucket(
            self,
            "DocsBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            encryption=s3.BucketEncryption.S3_MANAGED,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

    def _url_rewrite_function(self) -> cloudfront.Function:
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
  } else if (!uri.includes('.')) {
    request.uri = uri + '/index.html';
  }
  return request;
}
                """.strip()
            ),
        )

    def _headers_policy(
        self, logical_id: str, cache_control: str
    ) -> cloudfront.ResponseHeadersPolicy:
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
                content_type_options=cloudfront.ResponseHeadersContentTypeOptions(override=True),
                frame_options=cloudfront.ResponseHeadersFrameOptions(
                    frame_option=cloudfront.HeadersFrameOption.DENY, override=True
                ),
                referrer_policy=cloudfront.ResponseHeadersReferrerPolicy(
                    referrer_policy=cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
                    override=True,
                ),
                xss_protection=cloudfront.ResponseHeadersXSSProtection(
                    protection=True, mode_block=True, override=True
                ),
            ),
            custom_headers_behavior=cloudfront.ResponseCustomHeadersBehavior(
                custom_headers=[
                    cloudfront.ResponseCustomHeader(
                        header="Cache-Control", value=cache_control, override=True
                    )
                ]
            ),
        )

    @staticmethod
    def _relative_record_name(site_domain: str, hosted_zone_domain: str) -> str:
        suffix = f".{hosted_zone_domain}"
        return site_domain[: -len(suffix)] if site_domain.endswith(suffix) else site_domain