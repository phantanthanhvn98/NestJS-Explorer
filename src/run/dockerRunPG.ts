import dns from 'node:dns';
import cors from 'cors';
import express from 'express';
import Noco from 'src/Plus0';

// ref: https://github.com/nodejs/node/issues/40702#issuecomment-1103623246
dns.setDefaultResultOrder('ipv4first');

const server = express();
server.enable('trust proxy');
server.disable('etag');
server.disable('x-powered-by');
server.use(
  cors({
    exposedHeaders: 'xc-db-response',
  }),
);

server.set('view engine', 'ejs');

const date = new Date();
const metaDb = `meta_v2_${date.getFullYear()}_${(date.getMonth() + 1)
  .toString()
  .padStart(2, '0')}_${date.getDate().toString().padStart(2, '0')}`;
process.env[`PLUS0_DB`] = 

process.env[`DEBUG`] = 'xc*';

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
