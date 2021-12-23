import * as aws from "@pulumi/aws";

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import axios from 'axios';
import * as Bluebird from 'bluebird';
import * as b from 'benny';
import * as express from 'express';
import * as fs from 'fs';

import { project, region, stack } from './config';
import { role } from './iam';

const RUN_TIME = 10;
const TOTAL_RUNS = 10;

const lambdas:string[] = [];

const LAYER_X64 = './layer/dist/layer-x64.zip';
const LAYER_ARM64 = './layer/dist/layer-arm64.zip';

if (!fs.existsSync(LAYER_X64) || !fs.existsSync(LAYER_ARM64)) {
  throw new Error('Layers not found. Run "npm run layer"');
}

const layerX64 = new aws.lambda.LayerVersion(`${project}-${stack}-layer-x64`, {
  code: LAYER_X64,
  layerName: `${project}-${stack}-x64`,
  compatibleArchitectures: ['x86_64'],
  compatibleRuntimes: ['nodejs14.x'],
  description: `${project}-${stack} - x64 dependencies`,
});

const layerArm64 = new aws.lambda.LayerVersion(`${project}-${stack}-layer-arm64`, {
  code: LAYER_ARM64,
  layerName: `${project}-${stack}-arm64`,
  compatibleArchitectures: ['arm64'],
  compatibleRuntimes: ['nodejs14.x'],
  description: `${project}-${stack} - arm64 dependencies`,
});

for (const arch of ['x86_64', 'arm64']) {
  for (let i = 7; i <= 13; i++) {
    const size = 2 ** i;
    const name = `${project}-${stack}-express-${arch}-${size}`;

    console.log(name);
    lambdas.push(name);

    new aws.lambda.CallbackFunction(`${project}-${stack}-lambda-express-${arch}-${i}`, {
      name: name,
      runtime: 'nodejs14.x',
      architectures: [arch],
      memorySize: size,
      timeout: Math.max(60, RUN_TIME),
      // layers: [
      //   arch === 'x86_64' ? layerX64.arn : layerArm64.arn,
      // ],
      role: role,
      description: `${project}-${stack} - Express.js (${arch} ${size} MB).`,
      callback: (event:any, context, callback) => {
        const PORT = 3000;

        const app = express();
        
        app.post('/', (req, res) => {
          res.json(req.body);
        });
        
        const server = app.listen(PORT);
        
        const suite = b.suite('Lambda benchmark', 
          b.add.only('Run Express', async () => {
            const runner = async () => {
              await axios.post(`http://localhost:${PORT}/`, {});
            };
        
            await runner();
        
            return runner;
          }, {
            maxTime: event.time,
          }),
          b.cycle(),
          b.complete(() => {
            server.close();
          }),
        );
        
        suite.then((s) => {
          callback(null, s);
        });
      },
    });
  }
}

export const runner = new aws.lambda.CallbackFunction(`${project}-${stack}-lambda-runner`, {
  name: `${project}-${stack}-runner`,
  runtime: 'nodejs14.x',
  memorySize: 128,
  timeout: 300,
  role: role,
  description: `${project}-${stack} runner`,
  callback: (event, context, callback) => {
    const client = new LambdaClient({ region });
    const tasks = [];

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
              data[lambdas[i]] = stats.results[0].ops;
            });

            console.log(`Run #${i}:`, data);

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
