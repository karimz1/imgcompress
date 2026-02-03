#!/usr/bin/env python3
import os

import aws_cdk as cdk

from imgcompress_static_site_stack import ImgcompressStaticSiteStack

app = cdk.App()

account = os.getenv("CDK_DEFAULT_ACCOUNT") or os.getenv("AWS_ACCOUNT_ID")
region = (
    os.getenv("CDK_DEFAULT_REGION")
    or os.getenv("AWS_REGION")
    or os.getenv("AWS_DEFAULT_REGION")
)

if not account or not region:
    raise SystemExit(
        "AWS environment not detected. Run via `cdk deploy` with AWS credentials configured, "
        "or set AWS_ACCOUNT_ID and AWS_REGION (or AWS_DEFAULT_REGION)."
    )

ImgcompressStaticSiteStack(
    app,
    "ImgcompressDocsStack",
    env=cdk.Environment(account=account, region=region),
)

app.synth()
