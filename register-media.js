const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

async function run() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'database.sqlite');
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  const uploadsDir = path.join(__dirname, 'uploads');
  const files = fs.readdirSync(uploadsDir).filter(f => !f.startsWith('.'));

  files.forEach(filename => {
    const ext = path.extname(filename).toLowerCase();
    let mimetype = 'image/jpeg';
    if (ext === '.png') mimetype = 'image/png';
    if (ext === '.gif') mimetype = 'image/gif';
    if (ext === '.mp4') mimetype = 'video/mp4';
    
    const filePath = path.join(uploadsDir, filename);
    const size = fs.statSync(filePath).size;

    // Check if already registered
    const existing = db.exec(`SELECT id FROM media WHERE filename = '${filename}'`);
    if (!existing[0]) {
      db.run('INSERT INTO media (filename, original_name, mimetype, size) VALUES (?, ?, ?, ?)', [filename, filename, mimetype, size]);
      console.log(`Registered: ${filename}`);
    }
  });

  // Save
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log('\nDone! All files registered in media library.');
}

run();
