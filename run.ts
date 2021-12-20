import axios from 'axios';
import * as b from 'benny';
import * as express from 'express';

const PORT = 3000;

const app = express();

app.post('/', (req, res) => {
  res.json(req.body);
});

const server = app.listen(PORT);

b.suite('Lambda benchmark', 
  b.add.only('Run Express', async () => {
    const runner = async () => {
      await axios.post(`http://localhost:${PORT}/`, {});
    };

    await runner();

    return runner;
  }, {
    maxTime: 10,
  }),
  b.cycle(),
  b.complete(() => {
    server.close();
  }),
);
