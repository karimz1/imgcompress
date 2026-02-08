# Documentation Hosting for ImgCompress (AWS CDK)

This folder contains the AWS CDK setup that deploys the ImgCompress documentation site. The site is a static build hosted on S3 and served through CloudFront, with Route 53 managing DNS.

I share the infra because it makes the project easier to learn from, review, and reuse. If it helps you, great. If you want to support the project, there is a sponsor link at https://github.com/sponsors/karimz1.

---

## Overview

The stack provisions:

- **Amazon S3 (private bucket)** for static files
- **Amazon CloudFront** as the CDN (HTTP/2 + HTTP/3)
- **AWS Certificate Manager (ACM)** for TLS certificates
- **Amazon Route 53** for DNS (A/AAAA alias records to CloudFront)

---

## Prerequisites

- AWS credentials configured locally (AWS CLI, SSO, or env vars)
- `uv` installed (used to manage the venv and dependencies)
- `python` available locally
- `zip` available locally
- `cdk` CLI installed (`npm i -g aws-cdk`)
- A Route 53 public hosted zone for your domain

Note: CloudFront custom domains require the ACM certificate to live in `us-east-1`. The scripts default to `CDK_REGION=us-east-1`.

---

## Configuration

The deploy scripts read configuration via environment variables:

- `HOSTED_ZONE_DOMAIN` (required)  
  Example: `karimzouine.com`
- `SITE_DOMAIN` (required)  
  Example: `imgcompress.karimzouine.com`
- `CDK_REGION` (optional, default: `us-east-1`)
- `DOCS_OUTPUT_DIR` (optional, default: `./site`)

Important: the current scripts always pass `enable_custom_domain=true`, so a custom domain and Route 53 hosted zone are required unless you edit the scripts.

---

## First-Time Setup

If you have not used CDK in this AWS account/region before, bootstrap once:

```bash
cd infra/cdk
AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1 cdk bootstrap
```

---

## Deploy

Deploy the documentation site:

```bash
HOSTED_ZONE_DOMAIN=karimzouine.com SITE_DOMAIN=imgcompress.karimzouine.com ./infra/deploy.sh
```

What this does:

- Builds the static docs site
- Uploads the output to S3
- Creates/updates the CloudFront distribution
- Creates/updates Route 53 alias records for `SITE_DOMAIN`
- Invalidates CloudFront paths so updates are visible immediately

After deployment, the script prints the CloudFront URL and (if enabled) the custom domain URL.

---

## Destroy

Warning: destroying the stack deletes the S3 bucket and all uploaded site files.

```bash
HOSTED_ZONE_DOMAIN=karimzouine.com SITE_DOMAIN=imgcompress.karimzouine.com ./infra/distroy.sh
```

Note: the script is named `distroy.sh` (spelling).

---

## Switching from a Test Domain to the Final Domain

A clean flow is:

1. Deploy to a test subdomain and verify everything works.
2. Destroy the test stack (optional).
3. Deploy again with the final domain.

```bash
# 1) test deploy
HOSTED_ZONE_DOMAIN=karimzouine.com SITE_DOMAIN=test-imgcompress.karimzouine.com ./infra/deploy.sh

# 2) destroy test (optional)
HOSTED_ZONE_DOMAIN=karimzouine.com SITE_DOMAIN=test-imgcompress.karimzouine.com ./infra/distroy.sh

# 3) final deploy
HOSTED_ZONE_DOMAIN=karimzouine.com SITE_DOMAIN=imgcompress.karimzouine.com ./infra/deploy.sh
```

---

## DNS Notes

This setup assumes `HOSTED_ZONE_DOMAIN` is delegated to Route 53.

CDK will create:

- A (Alias) record → CloudFront
- AAAA (Alias) record → CloudFront

If your DNS is hosted elsewhere (e.g., Cloudflare), create equivalent records with your provider (commonly a CNAME to the CloudFront domain).

---

## Troubleshooting

### CloudFront URL works, but the custom domain does not

- DNS may still be propagating or cached locally.
- Verify records resolve:
  - `dig SITE_DOMAIN +short`
  - `dig AAAA SITE_DOMAIN +short`

### TLS / certificate issues

- CloudFront custom domains require the ACM certificate in `us-east-1`.
- Make sure you deploy with `CDK_REGION=us-east-1`.

### Subpages return 404

- Ensure the static build output includes an `index.html` per folder.
- This setup includes a CloudFront Function that rewrites `/path` → `/path/index.html`.
