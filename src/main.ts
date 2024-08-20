import dns from 'node:dns';
import cors from 'cors';
import express from 'express';
import Plus0 from './Plus0';

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

process.env[`DEBUG`] = 'xc*';
// process.env[`DATABASE_URL`] = 

async function bootstrap() {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Plus0.init({}, httpServer, server));
  });
}

bootstrap();
