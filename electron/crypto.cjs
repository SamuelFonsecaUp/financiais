const crypto = require('crypto');

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPin(pin, salt) {
  return crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256').toString('hex');
}

function verifyPin(pin, storedHash, storedSalt) {
  if (!storedHash || !storedSalt) return false;
  const hash = hashPin(pin, storedSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

module.exports = {
  generateSalt,
  hashPin,
  verifyPin,
};
