import * as aws from "@pulumi/aws";

import { project, region, stack } from './config';

export const role = new aws.iam.Role(`${project}-${stack}-role`, {
  name: `${project}-${stack}`,
  description: `${project}-${stack}`,
  assumeRolePolicy: {
    "Version": '2012-10-17',
    "Statement": [
      {
        "Effect": 'Allow',
        "Principal": {
          "Service": 'lambda.amazonaws.com',
        },
        "Action": 'sts:AssumeRole',
      },
    ],
  },
});

new aws.iam.RolePolicy(`${project}-${stack}-role-policy`, {
  name: `${project}-${stack}`,
  role: role,
  policy: {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "lambda:InvokeFunction",
        ],
        "Resource": [
          `arn:aws:lambda:${region}:*:function:${project}-${stack}-*`,
        ],
      },
      {
        "Effect": "Allow",
        "Action": [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        "Resource": [
          "*"
        ],
      },
    ],
  },
});
