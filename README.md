# AWS Lambda performance benchmark

Runs basic [Express](https://www.npmjs.com/package/express) and [Sharp](https://www.npmjs.com/package/sharp) benchmarks on AWS Lambda on x86-64 and ARM64 functions of various sizes.

## Requirements

* Node.js
* Docker
* AWS CLI
* Pulumi

## Setup

1. `npm i && cd docker && npm i && cd ..`
2. `pulumi up -y`
3. `npm run docker`
4. Go to the AWS Lambda console and run `lambda-benchmarks-main-runner` function.

## Credits

Photo by [Errin Casano]([https://www.pexels.com/@errin-casano-1240439?utm_content=attributionCopyText&utm_medium=referral&utm_source=pexels) from [Pexels](https://www.pexels.com/photo/rocky-mountains-under-blue-sky-2356059/?utm_content=attributionCopyText&utm_medium=referral&utm_source=pexels)