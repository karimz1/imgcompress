#!/usr/bin/env python3
import os
import aws_cdk as cdk
from imgcompress_static_site_stack import ImgcompressStaticSiteStack

app = cdk.App()

env = cdk.Environment(
    account=os.getenv("CDK_DEFAULT_ACCOUNT"),
    region=os.getenv("CDK_DEFAULT_REGION")
)

stack_id = "ImgcompressStaticSiteStack"

stack = ImgcompressStaticSiteStack(
    app,
    stack_id,
    env=env,
)

cdk.Tags.of(stack).add("Project", "Imgcompress")
cdk.Tags.of(stack).add("Component", "Documentation")

app.synth()