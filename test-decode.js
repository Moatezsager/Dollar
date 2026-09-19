const fs = require('fs');
const atob = str => Buffer.from(str, 'base64').toString('binary');
function decodeData(encodedData) {
  try {
    const jsonStr = atob(encodedData);
    let result = '';
    for (let i = 0; i < jsonStr.length; i++) {
      result += String.fromCharCode(jsonStr.charCodeAt(i) ^ 42); // Example XOR key
    }
    return JSON.parse(decodeURIComponent(escape(result)));
  } catch (e) {
    return null;
  }
}
const encoded = "P2sAPmd5LnAqOVRZUV9YXRV+awA8Z293IiQtU1xeU1UTDWYWL3FpYSUgIClbX0dFdldRLSo2Milhb3AaL10SHhRJQ1IyIDAmNhM0ICQzXlVeFAMTaDQ5fX9nLzQhMQpCVFNCXFUVfmsAJ2dvdz4kLEZzWldXVlIga2VxGi82cGl9Z2N2FAMTQnVrc3EAFgdwf31XAhAaG3Z1FGtlcSJwd35nC2BpEAwbRQNmZX0UCg8RcH99VQUQGhtkZAAWHBsAAB4BZ2UQRVEAGx0VERobDA8BFBwOfQgSR1wOE0poawA3Z3kucBowEApJFEwAFX5/cWBzemF+ZzoAEggBFwIDdn5zcSJwd2h9cQcIAwMVE2MKDX1pd21kZXJpHhJGAhsLB2p4bGN8b3cXAg8QCgIYCAMDcnpuZ3RwYWJzaAADAgUVE30LDX1pfW1sZnduBQICAQoCA3Z+bGVpYRQXAX0IARwBCgUGaGsMEhdhb2NraQsFBRobc38";
console.log(decodeData(encoded));
