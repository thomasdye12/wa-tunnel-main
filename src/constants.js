module.exports = Object.freeze({
  LOGGER_TYPES: {
    INFO: 'INFO',
    ERROR: 'ERROR'
  },
  STATUS_CODES: {
    END: 'e',
    FULL: 'f',
    CACHE: 'c'
  },
  CHUNKSIZE: 50000,
  DELIMITER: new Uint8Array([255, 255, 255, 255, 255]),
  SEND_DELAY: 1200 // send data timeout
});
