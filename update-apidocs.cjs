const fs = require('fs');
let content = fs.readFileSync('src/components/ApiDocs.tsx', 'utf8');
content = content.replace(
  "console.log('سعر الدولار كاش:', result.data.USD);\n      console.log('سعر اليورو:', result.data.EUR);",
  "console.log('سعر الدولار كاش:', result.data.USD);\n      console.log('سعر اليورو:', result.data.EUR);\n      console.log('سعر الجنيه الإسترليني:', result.data.GBP);"
);
content = content.replace(
  "print('سعر الدولار كاش:', result['data']['USD'])\n        print('سعر اليورو:', result['data']['EUR'])",
  "print('سعر الدولار كاش:', result['data']['USD'])\n        print('سعر اليورو:', result['data']['EUR'])\n        print('سعر الجنيه الإسترليني:', result['data']['GBP'])"
);
content = content.replace(
  "وصول مجاني لأسعار الدولار (USD) واليورو (EUR) اللحظية في السوق الموازي",
  "وصول مجاني لأسعار الدولار (USD)، اليورو (EUR)، والجنيه الإسترليني (GBP) اللحظية في السوق الموازي"
);
fs.writeFileSync('src/components/ApiDocs.tsx', content);
