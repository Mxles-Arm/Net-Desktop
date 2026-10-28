'use strict';
// IPv4 helpers. Addresses are handled as unsigned 32-bit integers.

const IP_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function parseIp(str) {
  if (typeof str !== 'string') return null;
  const m = IP_RE.exec(str.trim());
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function formatIp(n) {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

function isValidIp(str) {
  return parseIp(str) !== null;
}

// Returns the prefix length (e.g. 24) for a contiguous mask, or null when the mask is invalid.
function maskToPrefix(str) {
  const n = parseIp(str);
  if (n === null) return null;
  const inverted = ~n >>> 0;
  // A valid mask is all ones followed by all zeros, so its inverse + 1 is a power of two.
  if ((inverted & (inverted + 1)) !== 0) return null;
  let prefix = 0;
  for (let bit = 31; bit >= 0; bit--) if ((n >>> bit) & 1) prefix++;
  return prefix;
}

// Usable for hosts: contiguous and leaves room for at least two host addresses.
function isValidMask(str) {
  const p = maskToPrefix(str);
  return p !== null && p >= 1 && p <= 30;
}

function prefixToMask(prefix) {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

function networkOf(ipStr, maskStr) {
  const ip = parseIp(ipStr), mask = parseIp(maskStr);
  if (ip === null || mask === null) return null;
  return (ip & mask) >>> 0;
}

function broadcastOf(ipStr, maskStr) {
  const ip = parseIp(ipStr), mask = parseIp(maskStr);
  if (ip === null || mask === null) return null;
  return ((ip & mask) | (~mask >>> 0)) >>> 0;
}

function sameSubnet(ipA, ipB, maskStr) {
  const a = networkOf(ipA, maskStr), b = networkOf(ipB, maskStr);
  return a !== null && a === b;
}

// 'network' | 'broadcast' | 'loopback' | 'unspecified' | 'multicast' | null (usable)
function hostAddressProblem(ipStr, maskStr) {
  const ip = parseIp(ipStr);
  if (ip === null) return 'invalid';
  const first = ip >>> 24;
  if (ip === 0) return 'unspecified';
  if (first === 127) return 'loopback';
  if (first >= 224) return 'multicast';
  if (isValidMask(maskStr)) {
    if (ip === networkOf(ipStr, maskStr)) return 'network';
    if (ip === broadcastOf(ipStr, maskStr)) return 'broadcast';
  }
  return null;
}

module.exports = {
  parseIp,
  formatIp,
  isValidIp,
  isValidMask,
  maskToPrefix,
  prefixToMask,
  networkOf,
  broadcastOf,
  sameSubnet,
  hostAddressProblem,
};
