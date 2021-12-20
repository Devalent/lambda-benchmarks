import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export const project = pulumi.getProject();
export const region = aws.config.requireRegion().toString();
export const stack = pulumi.getStack();
