const net = require('net');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const { logger } = require('./utils/logger');
const { startSock, sendData } = require('./wasocket');
const { LOGGER_TYPES, DELIMITER, SEND_DELAY } = require('./constants');

const argv = yargs(hideBin(process.argv))
  .command(
    '$0 <local-port> <server-wa-num> [disable-files]',
    'Start a wa-tunnel client listening on <localport>',
    (yargsData) => {
      yargsData
        .positional('local-port', {
          demandOption: true,
          describe: 'Port to be forwarded'
        })
        .positional('server-wa-num', {
          demandOption: true,
          describe: 'Server WhatsApp number following this format: 12345678901'
        })
        .option('disable-files', {
          description:
            'Disable sending WhatsApp files to reduce the amount of messages (sometimes not allowed)',
          default: false,
          type: 'boolean'
        })
        .version(false);
    }
  )
  .parse();

//
const sockets = {};
const host = '0.0.0.0';
const { disableFiles } = argv;
const localport = argv.localPort;
const server = net.createServer();
const remoteNum = `${argv.serverWaNum}@s.whatsapp.net`;

const cacheTimers = {};
const cacheRequests = {}; // Stores incoming data temporarily


const callback = (socketNumber, decryptedText) => {
  if (sockets[socketNumber]) {
    sockets[socketNumber].write(decryptedText);
  } else {
    logger(`SOCKET ALREADY DEAD -> ${socketNumber}`, LOGGER_TYPES.ERROR);
  }
};

const waSock = startSock(remoteNum, callback, 'client');

const sockFunc = (sock) => {
  logger(`CONNECTED -> ${sock.remotePort}`);

  sockets[sock.remotePort] = sock;

  logger(`ACTIVE SOCKETS -> ${Object.keys(sockets)}`);

  // sock.on('data', async (data) => {
  //   sock.pause();
  //   await sendData(waSock, data, sock.remotePort, remoteNum, disableFiles);
  //   sock.resume();
  // });

  sock.on('data', (data) => {
    const socketNumber = sock.remotePort;

    // Clear existing timeout if more data arrives before sending
    if (cacheTimers[socketNumber]) clearTimeout(cacheTimers[socketNumber]);

    // Cache data
    if (!cacheRequests[socketNumber]) cacheRequests[socketNumber] = data;
    else
        cacheRequests[socketNumber] = Buffer.concat([
            cacheRequests[socketNumber],
            DELIMITER,
            data
        ]);

    // Set a timeout to send cached data after 900ms
    cacheTimers[socketNumber] = setTimeout(async () => {
        sock.pause();
        await sendData(waSock, cacheRequests[socketNumber], socketNumber, remoteNum, disableFiles);
        sock.resume();
        delete cacheRequests[socketNumber]; // Clear cache after sending
    }, SEND_DELAY);
});


  sock.on('close', () => {
    delete sockets[sock.remotePort];
    logger(`CLOSED -> ${sock.remotePort}`);
  });

  sock.on('error', (e) => {
    logger(`ERROR SOCKET -> ${sock.remotePort}`, LOGGER_TYPES.ERROR);
    logger(e.stack, LOGGER_TYPES.ERROR);
    sock.end();
    delete sockets[sock.remotePort];
  });
};

server.listen(localport, host, () => {
  logger(`TCP Server is running on port ${localport}.`);
});
server.on('connection', sockFunc);
