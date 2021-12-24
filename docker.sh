#!/bin/bash

NAME=lambda-benchmarks
REGION=us-east-1
STAGE=main

AWS_ACCOUNT_ID=`aws sts get-caller-identity --query "Account" --output text`

ECR=$AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

npx tsc --project ./docker

cd docker

docker build -t $NAME-x64:latest -f Dockerfile.x64 .
docker build -t $NAME-arm64:latest -f Dockerfile.arm64 .

docker tag $NAME-x64:latest $ECR/$NAME-$STAGE-x64:latest
docker tag $NAME-arm64:latest $ECR/$NAME-$STAGE-arm64:latest

cd ..

echo aws configure set default.region $REGION
aws configure set default.region $REGION

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR

docker push $ECR/$NAME-$STAGE-x64:latest
docker push $ECR/$NAME-$STAGE-arm64:latest
