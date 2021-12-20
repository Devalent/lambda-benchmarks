import * as aws from "@pulumi/aws";

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import axios from 'axios';
import * as b from 'benny';
import * as express from 'express';

import { project, region, stack } from './config';
import { role } from './iam';

const lambdas:string[] = [];

for (let arch in ['x86_64', 'arm64']) {
  for (let i = 1; i <= 1; i++) { // 7
    const name = `${project}-${stack}-${arch}-${i}`;
    const size = 128 * i;

    lambdas.push(name);

    new aws.lambda.CallbackFunction(`${project}-${stack}-lambda-${arch}-${i}`, {
      name: name,
      runtime: 'nodejs14.x',
      architectures: [arch],
      memorySize: size,
      timeout: 60,
      role: role,
      description: `${project}-${stack} - ${arch} (${size} MB).`,
      callback: (event, context, callback) => {
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
            maxTime: 30,
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
  timeout: 60,
  role: role,
  description: `${project}-${stack} runner`,
  callback: (event, context, callback) => {
    const client = new LambdaClient({ region });

    const tasks = lambdas.map((lambda) => {
      return client.send(
        new InvokeCommand({
          FunctionName: lambda,
          InvocationType: '',
        })
      ).then(x => x.Payload);
    });

    Promise.all(tasks)
      .then((results) => {

      })
      .catch((err) => callback(err));
  },
});
