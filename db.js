const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'assets.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Enforce foreign key constraints
  db.run('PRAGMA foreign_keys = ON;');

  // Staff Table - Email must be unique
  db.run(`CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL
  )`);

  // Assets Table - Asset Tag & Serial Number must be unique
  db.run(`CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('laptop', 'monitor', 'phone', 'other')) NOT NULL,
    asset_tag TEXT UNIQUE NOT NULL,
    serial_number TEXT UNIQUE NOT NULL,
    status TEXT CHECK(status IN ('available', 'assigned', 'under repair')) DEFAULT 'available'
  )`);

  // Assignments Table
  db.run(`CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    returned_at DATETIME NULL,
    FOREIGN KEY(asset_id) REFERENCES assets(id),
    FOREIGN KEY(staff_id) REFERENCES staff(id)
  )`);
});

module.exports = db;