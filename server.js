const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Data directory: use DATA_DIR env (for Fly.io volume) or local
const dataDir = process.env.DATA_DIR || __dirname;
const uploadsDir = path.join(dataDir, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database setup
const db = new Database(path.join(dataDir, "clipboard.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#6c5ce7',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('text', 'image')),
    content TEXT,
    filename TEXT,
    original_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    category_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    pinned INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  )
`);

// Seed default category
const catCount = db.prepare("SELECT COUNT(*) as c FROM categories").get().c;
if (catCount === 0) {
  db.prepare(
    "INSERT INTO categories (id, name, color, sort_order) VALUES (?, ?, ?, ?)",
  ).run(uuidv4(), "Chung", "#6c5ce7", 0);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadsDir));

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
});

// ========== Categories ==========

app.get("/api/categories", (req, res) => {
  const categories = db
    .prepare("SELECT * FROM categories ORDER BY sort_order, created_at")
    .all();
  const result = categories.map((cat) => {
    const { count } = db
      .prepare("SELECT COUNT(*) as count FROM items WHERE category_id = ?")
      .get(cat.id);
    return { ...cat, item_count: count };
  });
  const { count: uncategorized } = db
    .prepare("SELECT COUNT(*) as count FROM items WHERE category_id IS NULL")
    .get();
  const { count: totalCount } = db
    .prepare("SELECT COUNT(*) as count FROM items")
    .get();
  res.json({
    categories: result,
    uncategorized_count: uncategorized,
    total_count: totalCount,
  });
});

app.post("/api/categories", (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ error: "Category name is required" });

  const existing = db
    .prepare("SELECT id FROM categories WHERE name = ?")
    .get(name.trim());
  if (existing)
    return res.status(409).json({ error: "Category already exists" });

  const id = uuidv4();
  const maxOrder =
    db.prepare("SELECT MAX(sort_order) as m FROM categories").get().m || 0;
  db.prepare(
    "INSERT INTO categories (id, name, color, sort_order) VALUES (?, ?, ?, ?)",
  ).run(id, name.trim(), color || "#6c5ce7", maxOrder + 1);

  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
  res.status(201).json(category);
});

app.put("/api/categories/:id", (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;
  const cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
  if (!cat) return res.status(404).json({ error: "Category not found" });

  if (name) {
    const existing = db
      .prepare("SELECT id FROM categories WHERE name = ? AND id != ?")
      .get(name.trim(), id);
    if (existing) return res.status(409).json({ error: "Name already exists" });
  }

  db.prepare(
    "UPDATE categories SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?",
  ).run(name ? name.trim() : null, color || null, id);
  const updated = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
  res.json(updated);
});

app.delete("/api/categories/:id", (req, res) => {
  const { id } = req.params;
  const cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
  if (!cat) return res.status(404).json({ error: "Category not found" });

  db.prepare("UPDATE items SET category_id = NULL WHERE category_id = ?").run(
    id,
  );
  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  res.json({ message: "Category deleted" });
});

// ========== Items ==========

const ITEM_SELECT = `SELECT items.*, categories.name as category_name, categories.color as category_color 
  FROM items LEFT JOIN categories ON items.category_id = categories.id`;

app.get("/api/items", (req, res) => {
  const { type, search, category_id, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  let query = ITEM_SELECT + " WHERE 1=1";
  const params = [];

  if (type) {
    query += " AND items.type = ?";
    params.push(type);
  }
  if (category_id === "uncategorized") {
    query += " AND items.category_id IS NULL";
  } else if (category_id) {
    query += " AND items.category_id = ?";
    params.push(category_id);
  }
  if (search) {
    query += " AND (items.content LIKE ? OR items.original_name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  query +=
    " ORDER BY items.pinned DESC, items.created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));
  const items = db.prepare(query).all(...params);

  let countQuery = "SELECT COUNT(*) as total FROM items WHERE 1=1";
  const cp = [];
  if (type) {
    countQuery += " AND type = ?";
    cp.push(type);
  }
  if (category_id === "uncategorized") {
    countQuery += " AND category_id IS NULL";
  } else if (category_id) {
    countQuery += " AND category_id = ?";
    cp.push(category_id);
  }
  if (search) {
    countQuery += " AND (content LIKE ? OR original_name LIKE ?)";
    cp.push(`%${search}%`, `%${search}%`);
  }
  const { total } = db.prepare(countQuery).get(...cp);

  res.json({ items, total, page: Number(page), limit: Number(limit) });
});

app.post("/api/items/text", (req, res) => {
  const { content, category_id } = req.body;
  if (!content || !content.trim())
    return res.status(400).json({ error: "Content is required" });

  const id = uuidv4();
  db.prepare(
    "INSERT INTO items (id, type, content, category_id) VALUES (?, ?, ?, ?)",
  ).run(id, "text", content.trim(), category_id || null);
  const item = db.prepare(ITEM_SELECT + " WHERE items.id = ?").get(id);
  res.status(201).json(item);
});

app.post("/api/items/image", upload.single("image"), (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: "Image file is required" });
  const category_id = req.body.category_id || null;
  const id = uuidv4();
  db.prepare(
    "INSERT INTO items (id, type, filename, original_name, mime_type, file_size, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    "image",
    req.file.filename,
    req.file.originalname,
    req.file.mimetype,
    req.file.size,
    category_id,
  );
  const item = db.prepare(ITEM_SELECT + " WHERE items.id = ?").get(id);
  res.status(201).json(item);
});

app.post("/api/items/paste", (req, res) => {
  const { imageData, filename, category_id } = req.body;
  if (!imageData)
    return res.status(400).json({ error: "Image data is required" });

  const matches = imageData.match(/^data:(.+);base64,(.+)$/);
  if (!matches)
    return res.status(400).json({ error: "Invalid image data format" });

  const mimeType = matches[1];
  const base64Data = matches[2];
  const ext =
    mimeType.split("/")[1] === "jpeg" ? ".jpg" : `.${mimeType.split("/")[1]}`;
  const savedFilename = `${uuidv4()}${ext}`;
  const filePath = path.join(uploadsDir, savedFilename);
  fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
  const fileSize = fs.statSync(filePath).size;

  const id = uuidv4();
  db.prepare(
    "INSERT INTO items (id, type, filename, original_name, mime_type, file_size, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    "image",
    savedFilename,
    filename || `paste-${Date.now()}${ext}`,
    mimeType,
    fileSize,
    category_id || null,
  );
  const item = db.prepare(ITEM_SELECT + " WHERE items.id = ?").get(id);
  res.status(201).json(item);
});

app.patch("/api/items/:id/category", (req, res) => {
  const { id } = req.params;
  const { category_id } = req.body;
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  if (!item) return res.status(404).json({ error: "Item not found" });
  db.prepare("UPDATE items SET category_id = ? WHERE id = ?").run(
    category_id || null,
    id,
  );
  const updated = db.prepare(ITEM_SELECT + " WHERE items.id = ?").get(id);
  res.json(updated);
});

app.patch("/api/items/:id/pin", (req, res) => {
  const { id } = req.params;
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  if (!item) return res.status(404).json({ error: "Item not found" });
  db.prepare("UPDATE items SET pinned = ? WHERE id = ?").run(
    item.pinned ? 0 : 1,
    id,
  );
  const updated = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  res.json(updated);
});

app.put("/api/items/:id", (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  if (!item) return res.status(404).json({ error: "Item not found" });
  if (item.type !== "text")
    return res.status(400).json({ error: "Can only edit text items" });
  db.prepare("UPDATE items SET content = ? WHERE id = ?").run(content, id);
  const updated = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  res.json(updated);
});

app.delete("/api/items/:id", (req, res) => {
  const { id } = req.params;
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  if (!item) return res.status(404).json({ error: "Item not found" });
  if (item.type === "image" && item.filename) {
    const filePath = path.join(uploadsDir, item.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare("DELETE FROM items WHERE id = ?").run(id);
  res.json({ message: "Item deleted" });
});

app.get("/api/items/:id/download", (req, res) => {
  const { id } = req.params;
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  if (!item) return res.status(404).json({ error: "Item not found" });
  if (item.type !== "image")
    return res.status(400).json({ error: "Not an image item" });
  const filePath = path.join(uploadsDir, item.filename);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "File not found" });
  res.download(filePath, item.original_name || item.filename);
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof multer.MulterError)
    return res.status(400).json({ error: err.message });
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\nCloud Clipboard is running!`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://<your-ip>:${PORT}\n`);
});
