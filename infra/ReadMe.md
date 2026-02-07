# Documentation Hosting of Imgcompress using AWS CDK

This document explains how the documentation site at https://imgcompress.karimzouine.com is deployed on AWS.

If you’re wondering how **imgcompress** hosts its documentation site: it’s a fully static site deployed on AWS using the **AWS CDK (CloudFormation) in Python**.

I prefer infrastructure-as-code over manual console setup because it’s reproducible, reviewable, and easy to evolve over time.

## Why do I share the infra?

I love open source, and I believe that if a project is open source, the hosting and infrastructure can be open as well. There’s no reason to hide it—sharing the setup makes it easier for others to learn, reuse, and improve on it.

I hope **imgcompress** is something you enjoy using.

If you’d like to support the project, a donation is always appreciated—but only if it’s comfortable for you. https://github.com/sponsors/karimz1

Thanks for using the tool, and have a great day 👋
---

## Overview

This project deploys a static documentation site using:

- **Amazon S3 (private bucket)** to store the static files
- **Amazon CloudFront** as a global CDN (fast delivery, compression, HTTP/2 + HTTP/3)
- **AWS Certificate Manager (ACM)** for free TLS certificates (HTTPS)
- **Amazon Route 53** to manage DNS (A/AAAA alias records to CloudFront)

---

## Prerequisites

- AWS credentials configured locally (e.g. `aws configure`, AWS SSO, or env vars)
- A **Route 53 public hosted zone** for your domain (e.g. `karimzouine.com`)
- CloudFront custom domains require the ACM certificate to be created in **us-east-1**
  - This repo defaults to `CDK_REGION=us-east-1`

---

## Configuration

The deploy scripts read configuration via environment variables:

- `HOSTED_ZONE_DOMAIN` (required when using a custom domain)  
  Example: `karimzouine.com`
- `SITE_DOMAIN` (required when using a custom domain)  
  Example: `imgcompress.karimzouine.com`
- `CDK_REGION` (optional, default: `us-east-1`)
- `DOCS_OUTPUT_DIR` (optional, default: `./site`)

---

## Deploy

Deploy the documentation site to a test subdomain:

```bash
HOSTED_ZONE_DOMAIN=karimzouine.com SITE_DOMAIN=imgcompress.karimzouine.com ./infra/deploy.sh
```

What happens during deployment:

- Builds the static docs site
- Uploads the output to S3
- Creates/updates the CloudFront distribution
- Creates/updates Route 53 alias records for the configured SITE_DOMAIN
- Invalidates CloudFront paths so updates are visible immediately

After deployment, the script prints the CloudFront URL and (if enabled) the custom domain URL.



## **Destroy**

⚠️ **Warning:** Destroying the stack deletes the S3 bucket and all uploaded site files.

``` bash
HOSTED_ZONE_DOMAIN=karimzouine.com SITE_DOMAIN=imgcompress.karimzouine.com ./infra/distroy.sh
```



## **Switching from a Test Domain to the Final Domain**



A recommended flow is:

1. Deploy to test-imgcompress.* and verify everything works
2. Destroy the test stack (optional)
3. Deploy again using the final domain

``` bash
# 1) test deploy
HOSTED_ZONE_DOMAIN=karimzouine.com SITE_DOMAIN=test-imgcompress.karimzouine.com ./infra/deploy.sh

# 2) destroy test (optional)
HOSTED_ZONE_DOMAIN=karimzouine.com SITE_DOMAIN=test-imgcompress.karimzouine.com ./infra/distroy.sh

# 3) final deploy
HOSTED_ZONE_DOMAIN=karimzouine.com SITE_DOMAIN=imgcompress.karimzouine.com ./infra/deploy.sh
```



## **DNS Notes**

This setup assumes HOSTED_ZONE_DOMAIN is delegated to **Route 53** (Route 53 is authoritative DNS).

CDK will create:

- A (Alias) record → CloudFront
- AAAA (Alias) record → CloudFront

If your DNS is hosted elsewhere (e.g. Cloudflare), you must create the equivalent record with your DNS provider instead (commonly a CNAME to the CloudFront domain).


------

## **SEO Notes**

For good indexing:

- ensure robots.txt is not blocking crawlers
- generate and submit a sitemap.xml (recommended)
- add the domain/subdomain to Google Search Console and request indexing for key pages

------


## **Troubleshooting**


### **The CloudFront URL works, but the custom domain doesn’t**

- DNS may still be propagating or cached locally

- verify records resolve:

  - dig SITE_DOMAIN +short
  - dig AAAA SITE_DOMAIN +short

  
### **TLS / certificate issues**

- CloudFront custom domains require the ACM certificate in **us-east-1**
- ensure you deploy with CDK_REGION=us-east-1


### **Subpages return 404**

- ensure the static build output includes an index.html per folder
- this setup includes a CloudFront Function that rewrites /path → /path/index.html
