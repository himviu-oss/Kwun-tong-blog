const express = require('express');
const multer = require('multer');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const app = express();
let db;

// Initialize database
async function initDB() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  const dbPath = path.join(__dirname, 'database.sqlite');
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      image TEXT,
      post_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      image TEXT,
      "order" INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS makingof (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      image TEXT,
      "order" INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  saveDB();
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(path.join(__dirname, 'database.sqlite'), buffer);
  
  // Auto backup
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
  const date = new Date().toISOString().split('T')[0];
  fs.writeFileSync(path.join(backupDir, `backup-${date}.sqlite`), buffer);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/admin', express.static('admin'));

// Create uploads directory
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|webm|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) cb(null, true);
    else cb(new Error('Only images and videos allowed'));
  }
});

// ============ POSTS ROUTES ============

app.get('/api/posts', (req, res) => {
  const result = db.exec('SELECT * FROM posts ORDER BY post_date DESC, created_at DESC');
  const posts = result[0] ? result[0].values.map(row => ({
    id: row[0],
    title: row[1],
    content: row[2],
    image: row[3],
    post_date: row[4],
    created_at: row[5]
  })) : [];
  res.json(posts);
});

app.post('/api/posts', (req, res) => {
  const { title, content, image, post_date } = req.body;
  try {
    db.run('INSERT INTO posts (title, content, image, post_date) VALUES (?, ?, ?, ?)', [title, content, image, post_date || null]);
    saveDB();
    const result = db.exec('SELECT last_insert_rowid()');
    res.json({ success: true, id: result[0].values[0][0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/posts/:id', (req, res) => {
  const { title, content, image, post_date } = req.body;
  try {
    db.run('UPDATE posts SET title = ?, content = ?, image = ?, post_date = ? WHERE id = ?', [title, content, image, post_date || null, req.params.id]);
    saveDB();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/posts/:id', (req, res) => {
  try {
    const result = db.exec(`SELECT image FROM posts WHERE id = ${req.params.id}`);
    if (result[0] && result[0].values[0]) {
      const image = result[0].values[0][0];
      if (image) {
        const imagePath = path.join('uploads', image);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      }
    }
    db.run(`DELETE FROM posts WHERE id = ${req.params.id}`);
    saveDB();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GALLERY ROUTES ============

app.get('/api/gallery', (req, res) => {
  const result = db.exec('SELECT * FROM gallery ORDER BY "order" ASC, created_at ASC');
  const gallery = result[0] ? result[0].values.map(row => ({
    id: row[0],
    title: row[1],
    description: row[2],
    image: row[3],
    order: row[4],
    created_at: row[5]
  })) : [];
  res.json(gallery);
});

app.post('/api/gallery', (req, res) => {
  const { title, description, image, order } = req.body;
  try {
    db.run('INSERT INTO gallery (title, description, image, "order") VALUES (?, ?, ?, ?)', [title, description, image, order || 0]);
    saveDB();
    const result = db.exec('SELECT last_insert_rowid()');
    res.json({ success: true, id: result[0].values[0][0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/gallery/:id', (req, res) => {
  const { title, description, image, order } = req.body;
  try {
    db.run('UPDATE gallery SET title = ?, description = ?, image = ?, "order" = ? WHERE id = ?', [title, description, image, order || 0, req.params.id]);
    saveDB();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/gallery/:id', (req, res) => {
  try {
    db.run(`DELETE FROM gallery WHERE id = ${req.params.id}`);
    saveDB();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ MAKING OF ROUTES ============

app.get('/api/makingof', (req, res) => {
  const result = db.exec('SELECT * FROM makingof ORDER BY "order" ASC, created_at ASC');
  const items = result[0] ? result[0].values.map(row => ({
    id: row[0],
    title: row[1],
    description: row[2],
    image: row[3],
    order: row[4],
    created_at: row[5]
  })) : [];
  res.json(items);
});

app.post('/api/makingof', (req, res) => {
  const { title, description, image, order } = req.body;
  try {
    db.run('INSERT INTO makingof (title, description, image, "order") VALUES (?, ?, ?, ?)', [title, description, image, order || 0]);
    saveDB();
    const result = db.exec('SELECT last_insert_rowid()');
    res.json({ success: true, id: result[0].values[0][0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/makingof/:id', (req, res) => {
  const { title, description, image, order } = req.body;
  try {
    db.run('UPDATE makingof SET title = ?, description = ?, image = ?, "order" = ? WHERE id = ?', [title, description, image, order || 0, req.params.id]);
    saveDB();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/makingof/:id', (req, res) => {
  try {
    db.run(`DELETE FROM makingof WHERE id = ${req.params.id}`);
    saveDB();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ MEDIA ROUTES ============

app.get('/api/media', (req, res) => {
  const result = db.exec('SELECT * FROM media ORDER BY created_at DESC');
  const media = result[0] ? result[0].values.map(row => ({
    id: row[0],
    filename: row[1],
    original_name: row[2],
    mimetype: row[3],
    size: row[4],
    created_at: row[5]
  })) : [];
  
  // Get usage info
  const postImages = db.exec('SELECT image FROM posts WHERE image IS NOT NULL AND image != ""');
  const galleryImages = db.exec('SELECT image FROM gallery WHERE image IS NOT NULL AND image != ""');
  const makingofImages = db.exec('SELECT image FROM makingof WHERE image IS NOT NULL AND image != ""');
  
  const postSet = new Set(postImages[0] ? postImages[0].values.map(r => r[0]) : []);
  const gallerySet = new Set(galleryImages[0] ? galleryImages[0].values.map(r => r[0]) : []);
  const makingofSet = new Set(makingofImages[0] ? makingofImages[0].values.map(r => r[0]) : []);
  
  // Also check post content for inline images
  const postContents = db.exec('SELECT content FROM posts WHERE content IS NOT NULL');
  const inlineImages = new Set();
  if (postContents[0]) {
    postContents[0].values.forEach(row => {
      const matches = (row[0] || '').match(/\/uploads\/([^"'<>\s]+)/g);
      if (matches) {
        matches.forEach(m => inlineImages.add(m.replace('/uploads/', '')));
      }
    });
  }
  
  media.forEach(m => {
    m.usedIn = [];
    if (postSet.has(m.filename) || inlineImages.has(m.filename)) m.usedIn.push('Blog');
    if (gallerySet.has(m.filename)) m.usedIn.push('Gallery');
    if (makingofSet.has(m.filename)) m.usedIn.push('Making Of');
  });
  
  res.json(media);
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    db.run('INSERT INTO media (filename, original_name, mimetype, size) VALUES (?, ?, ?, ?)', [req.file.filename, req.file.originalname, req.file.mimetype, req.file.size]);
    saveDB();
    const result = db.exec('SELECT last_insert_rowid()');
    res.json({ success: true, file: { id: result[0].values[0][0], filename: req.file.filename, original_name: req.file.originalname, url: `/uploads/${req.file.filename}` } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/media/:id', (req, res) => {
  try {
    const result = db.exec(`SELECT filename FROM media WHERE id = ${req.params.id}`);
    if (result[0] && result[0].values[0]) {
      const filename = result[0].values[0][0];
      const filePath = path.join('uploads', filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.run(`DELETE FROM media WHERE id = ${req.params.id}`);
    saveDB();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
initDB().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n✅ CMS running at http://localhost:${PORT}`);
    console.log(`📝 Admin panel: http://localhost:${PORT}/admin/index.html`);
    console.log(`🌐 View site: http://localhost:${PORT}\n`);
  });
});
