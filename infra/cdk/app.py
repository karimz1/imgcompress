#!/usr/bin/env python3
import aws_cdk as cdk

from imgcompress_static_site_stack import ImgcompressStaticSiteStack

app = cdk.App()

ImgcompressStaticSiteStack(
    app,
    "ImgcompressDocsStack",
)

app.synth()
