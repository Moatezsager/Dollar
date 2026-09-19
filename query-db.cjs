const Database = require('better-sqlite3');
const db = new Database('database.sqlite');
try {
  const p = db.prepare("SELECT * FROM latest_rates WHERE is_parallel = 1 ORDER BY timestamp DESC LIMIT 1").get();
  const o = db.prepare("SELECT * FROM latest_rates WHERE is_parallel = 0 ORDER BY timestamp DESC LIMIT 1").get();
  console.log("Parallel USD:", p.usd);
  console.log("Official USD:", o.usd);
  console.log("Parallel Rates JSON:", p.rates);
} catch(e) {
  console.error(e);
}
