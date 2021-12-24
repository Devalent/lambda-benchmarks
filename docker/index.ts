import axios from 'axios';
import { Handler } from 'aws-lambda';
import * as b from 'benny';
import * as express from 'express';
import * as os from 'os';
import * as sharp from 'sharp';

type Request = {
  time?:number;
};

export const handler:Handler<Request> = (event, context, callback) => {
  const time = event.time || 10;

  const threads = os.cpus().length;

  sharp.cache(false);
  sharp.concurrency(threads);

  const app = express();

  app.post('/', (req, res) => {
    res.json(req.body);
  });
  
  const server = app.listen();

  console.log(`Using ${threads} threads`);

  const suite = b.suite('Lambda benchmark', 
    b.add('express', () => {
      const runner = async () => {
        await axios.post(`http://localhost:${server.address()!['port']}/`, {});
      };

      return runner;
    }, {
      maxTime: time,
    }),
    b.add('sharp', () => {
      const runner = async () => {
        if (parseInt(context.memoryLimitInMB) < 256) {
          return;
        }

        await sharp('./image.jpeg')
          .resize(640, 400)
          .jpeg({ quality: 80 })
          .toBuffer();
      };

      return runner;
    }, {
      maxTime: time,
    }),
    b.cycle(),
  );
  
  suite
    .then((s) => {
      callback(null, s);
    })
    .catch((err) => {
      callback(err);
    })
    .finally(() => {
      server.close();
    });
};
