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
      
      const parsed = JSON.parse(result);
      console.log("Official USD:", parsed.official.USD);
      console.log("Parallel USD:", parsed.parallel.USD);
      console.log("Parallel EUR:", parsed.parallel.EUR);
      console.log("Parallel GBP:", parsed.parallel.GBP);
    } catch(e) {
      console.error(e);
    }
  });
});
