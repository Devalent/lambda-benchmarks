import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import * as Bluebird from 'bluebird';

import { account, project, region, stack } from './config';
import { role } from './iam';

const RUN_TIME = 10;
const TOTAL_RUNS = 10;
const TOTAL_RUNS_PYTHON = 2;

const lambdas:string[] = [];
const lambdasPython:string[] = [];

for (const arch of ['x64', 'arm64']) {
  const repository = new aws.ecr.Repository(`${project}-${stack}-repository-${arch}`, {
    name: `${project}-${stack}-${arch}`,
    imageTagMutability: 'MUTABLE',
  });

  const repositoryPython = new aws.ecr.Repository(`${project}-${stack}-repository-python-${arch}`, {
    name: `${project}-${stack}-python-${arch}`,
    imageTagMutability: 'MUTABLE',
  });

  new aws.ecr.RepositoryPolicy(`${project}-${stack}-repository-${arch}-policy`, {
    repository: repository.name,
    policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        "Sid": `GetImage-${project}-${stack}`,
        "Effect": "Allow",
        "Principal": {
          "Service": "lambda.amazonaws.com"
        },
        "Action": [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ],
      }],
    }),
  });

  new aws.ecr.RepositoryPolicy(`${project}-${stack}-repository-python-${arch}-policy`, {
    repository: repositoryPython.name,
    policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        "Sid": `GetImage-${project}-${stack}`,
        "Effect": "Allow",
        "Principal": {
          "Service": "lambda.amazonaws.com"
        },
        "Action": [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ],
      }],
    }),
  });

  for (let i = 7; i <= 14; i++) {
    const size = Math.min(2 ** i, 10240);
    const name = `${project}-${stack}-${arch}-${size}`;

    lambdas.push(name);

    new aws.lambda.Function(name, {
      name: name,
      architectures: [arch === 'x64' ? 'x86_64' : 'arm64'],
      memorySize: size,
      timeout: Math.max(60, RUN_TIME),
      role: role.arn,
      description: `${project}-${stack} - Worker (${arch} ${size} MB).`,
      imageUri: pulumi.interpolate`${account}.dkr.ecr.${region}.amazonaws.com/${repository.name}:latest`,
      packageType: 'Image',
    });
  }

  for (let i = 8; i <= 14; i++) {
    const size = Math.min(2 ** i, 10240);
    const name = `${project}-${stack}-python-${arch}-${size}`;

    lambdasPython.push(name);

    new aws.lambda.Function(name, {
      name: name,
      architectures: [arch === 'x64' ? 'x86_64' : 'arm64'],
      memorySize: size,
      timeout: 180,
      role: role.arn,
      description: `${project}-${stack} - Python worker (${arch} ${size} MB).`,
      imageUri: pulumi.interpolate`${account}.dkr.ecr.${region}.amazonaws.com/${repositoryPython.name}:latest`,
      packageType: 'Image',
    });
  }
}

export const runner = new aws.lambda.CallbackFunction(`${project}-${stack}-lambda-runner`, {
  name: `${project}-${stack}-runner`,
  runtime: 'nodejs14.x',
  memorySize: 128,
  timeout: 600,
  role: role,
  description: `${project}-${stack} runner`,
  callback: (event, context, callback) => {
    const tasks = [];
    const client = new LambdaClient({ region });

    let num = 0;

    for (let i = 0; i < TOTAL_RUNS; i++) {
      const task = async () => {
        const subtasks = lambdas.map((lambda) => {
          return client.send(
            new InvokeCommand({
              FunctionName: lambda,
              Payload: Buffer.from(JSON.stringify({ time: RUN_TIME })),
            })
          ).then(x => x.Payload);
        });

        return Promise.all(subtasks)
          .then((results) => {
            const data:{ [x:string]:number; } = {};

            results.forEach((res, i) => {
              const stats = JSON.parse(Buffer.from(res!).toString('utf-8'));

              if (stats.results) {
                stats.results.forEach((stat:any) => {
                  data[lambdas[i] + '_' + stat.name] = stat.ops;
                })
              } else {
                console.error(`Result from ${lambdas[i]}: no data`, stats);
              }
            });

            num += 1;

            console.log(`Run #${num}:`, data);

            return data;
          });
      }

      tasks.push(task);
    }

    Bluebird.map(tasks, t => t(), { concurrency: 1 })
      .then((results) => {
        const result:{ [x:string]:number; } = {};

        results.forEach((res, i) => {
          Object.keys(res).forEach((x) => {
            if (!result[x]) {
              result[x] = 0;
            }

            result[x] += res[x];
          });
        });

        Object.keys(result).forEach((x) => {
          result[x] = Math.round(result[x] / results.length);
        });

        console.log('Result:', result);

        callback(null, result);
      })
      .catch(err => callback(err));
  },
});

export const runnerPython = new aws.lambda.CallbackFunction(`${project}-${stack}-lambda-runner-python`, {
  name: `${project}-${stack}-runner-python`,
  runtime: 'nodejs14.x',
  memorySize: 128,
  timeout: 600,
  role: role,
  description: `${project}-${stack} Python runner`,
  callback: (event, context, callback) => {
    const tasks = [];
    const client = new LambdaClient({ region });

    let num = 0;

    for (let i = 0; i < TOTAL_RUNS_PYTHON; i++) {
      const task = async () => {
        const subtasks = lambdasPython.map((lambda) => {
          return client.send(
            new InvokeCommand({
              FunctionName: lambda,
              Payload: Buffer.from(JSON.stringify({})),
            })
          ).then(x => x.Payload);
        });

        return Promise.all(subtasks)
          .then((results) => {
            const data:{ [x:string]:number; } = {};

            results.forEach((res, i) => {
              const stats = JSON.parse(Buffer.from(res!).toString('utf-8'));

              data[lambdasPython[i]] = stats;
            });

            num += 1;

            console.log(`Run #${num}:`, data);

            return data;
          });
      }

      tasks.push(task);
    }

    Bluebird.map(tasks, t => t(), { concurrency: 1 })
      .then((results) => {
        const result:{ [x:string]:number; } = {};

        results.forEach((res, i) => {
          Object.keys(res).forEach((x) => {
            if (!result[x]) {
              result[x] = 0;
            }

            result[x] += res[x];
          });
        });

        Object.keys(result).forEach((x) => {
          result[x] = Math.round(result[x] / results.length);
        });

        console.log('Result:', result);

        callback(null, result);
      })
      .catch(err => callback(err));
  },
});

export const lambdaNames = lambdas;
