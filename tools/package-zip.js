'use strict';

const crypto = require('crypto');

const crcTable = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  return c >>> 0;
});

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function sha256(data) { return crypto.createHash('sha256').update(data).digest('hex'); }

function manifest(version, build, minimumPluginVersion, signingKeySha256, files, entry = 'index.html', flags = 'flags.js') {
  return {
    schema: 1,
    version,
    build,
    minimumPluginVersion,
    signingKeySha256,
    entry,
    flags,
    files: files.map(file => ({path: file.path, size: file.data.length, sha256: sha256(file.data)})),
  };
}

function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(0, 8); header.writeUInt16LE(0, 10); header.writeUInt16LE(0x21, 12);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, data);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(0x0314, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(0x800, 8);
    record.writeUInt16LE(0, 10); record.writeUInt16LE(0, 12); record.writeUInt16LE(0x21, 14); record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(data.length, 20); record.writeUInt32LE(data.length, 24); record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(0x81a40000, 38); record.writeUInt32LE(offset, 42);
    central.push(record, name); offset += header.length + name.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

function releaseZip(files, metadata, manifestOverride) {
  const sorted = files.map(file => ({path: file.path.replace(/\\/g, '/'), data: Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data)})).sort((a, b) => a.path.localeCompare(b.path));
  const release = manifest(metadata.version, metadata.build, metadata.minimumPluginVersion, metadata.signingKeySha256, sorted, metadata.entry, metadata.flags);
  if (manifestOverride) manifestOverride(release);
  const body = Buffer.from(JSON.stringify(release, null, 2) + '\n');
  return zip([...sorted, {path: 'release.json', data: body}].sort((a, b) => a.path.localeCompare(b.path)));
}

module.exports = {manifest, releaseZip, sha256, zip};
