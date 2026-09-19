const http = require('http');
http.get('http://localhost:3000/api/rates', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      let str = data.replace(/^"|"$/g, '');
      const jsonStr = Buffer.from(str, 'base64').toString('binary');
      let result = '';
      for (let i = 0; i < jsonStr.length; i++) {
        result += String.fromCharCode(jsonStr.charCodeAt(i) ^ 42);
      }
      console.log(decodeURIComponent(escape(result)));
    } catch(e) {
      console.error(e);
    }
  });
});
