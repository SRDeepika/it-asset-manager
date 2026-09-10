const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

// --- BASIC HTTP AUTHENTICATION ---
app.use((req, res, next) => {
  const auth = { login: 'admin', password: 'password123' };
  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

  if (login && password && login === auth.login && password === auth.password) {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="401"');
  res.status(401).send('Authentication required to access IT Asset Management System.');
});

// --- ASSET ROUTES ---

// 1. Dashboard: List all assets + current holder info
app.get('/', (req, res) => {
  const query = `
    SELECT assets.*, COALESCE(staff.name, '-') AS holder_name 
    FROM assets 
    LEFT JOIN assignments ON assets.id = assignments.asset_id AND assignments.returned_at IS NULL
    LEFT JOIN staff ON assignments.staff_id = staff.id
  `;
  db.all(query, [], (err, assets) => {
    if (err) return res.status(500).send("Database error: " + err.message);
    res.render('index', { 
      assets: assets || [], 
      selectedType: '', 
      selectedStatus: '' 
    });
  });
});

// 2. Search & Filter Assets
app.get('/assets/search', (req, res) => {
  const { type, status } = req.query;
  let query = `
    SELECT assets.*, COALESCE(staff.name, '-') AS holder_name 
    FROM assets 
    LEFT JOIN assignments ON assets.id = assignments.asset_id AND assignments.returned_at IS NULL
    LEFT JOIN staff ON assignments.staff_id = staff.id
    WHERE 1=1
  `;
  const params = [];

  if (type) {
    query += ` AND assets.type = ?`;
    params.push(type);
  }
  if (status) {
    query += ` AND assets.status = ?`;
    params.push(status);
  }

  db.all(query, params, (err, assets) => {
    if (err) return res.status(500).send("Search error: " + err.message);
    res.render('index', { 
      assets: assets || [], 
      selectedType: type || '', 
      selectedStatus: status || '' 
    });
  });
});

// 3. Export Asset List to CSV
app.get('/assets/export/csv', (req, res) => {
  const query = `
    SELECT assets.id, assets.name, assets.type, assets.asset_tag, assets.serial_number, assets.status, COALESCE(staff.name, 'None') AS holder_name
    FROM assets 
    LEFT JOIN assignments ON assets.id = assignments.asset_id AND assignments.returned_at IS NULL
    LEFT JOIN staff ON assignments.staff_id = staff.id
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).send("Export error: " + err.message);

    let csv = "ID,Name,Type,Asset Tag,Serial Number,Status,Current Holder\n";
    rows.forEach(r => {
      csv += `"${r.id}","${r.name}","${r.type}","${r.asset_tag}","${r.serial_number}","${r.status}","${r.holder_name}"\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('assets_inventory.csv');
    return res.send(csv);
  });
});

// 4. Add Asset form & POST with duplicate handling
app.get('/assets/add', (req, res) => res.render('add_asset'));

app.post('/assets/add', (req, res) => {
  const { name, type, asset_tag, serial_number, status } = req.body;
  const query = `INSERT INTO assets (name, type, asset_tag, serial_number, status) VALUES (?, ?, ?, ?, ?)`;

  db.run(query, [name, type, asset_tag, serial_number, status || 'available'], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).send(`
          <div style="font-family: Arial, sans-serif; margin: 30px;">
            <h2 style="color: #dc3545;">Cannot Add Asset: Duplicate Detected</h2>
            <p>An asset with Asset Tag <strong>"${asset_tag}"</strong> or Serial Number <strong>"${serial_number}"</strong> already exists.</p>
            <a href="/assets/add">← Go Back and Try Again</a>
          </div>
        `);
      }
      return res.status(500).send("Database error: " + err.message);
    }
    res.redirect('/');
  });
});

// 5. Edit Asset form & POST with duplicate handling
app.get('/assets/edit/:id', (req, res) => {
  db.get(`SELECT * FROM assets WHERE id = ?`, [req.params.id], (err, asset) => {
    if (err || !asset) return res.status(404).send("Asset not found");
    res.render('edit_asset', { asset });
  });
});

app.post('/assets/edit/:id', (req, res) => {
  const { name, type, asset_tag, serial_number, status } = req.body;
  const query = `UPDATE assets SET name = ?, type = ?, asset_tag = ?, serial_number = ?, status = ? WHERE id = ?`;

  db.run(query, [name, type, asset_tag, serial_number, status, req.params.id], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).send(`
          <div style="font-family: Arial, sans-serif; margin: 30px;">
            <h2 style="color: #dc3545;">Cannot Update Asset: Duplicate Detected</h2>
            <p>Asset Tag <strong>"${asset_tag}"</strong> or Serial Number <strong>"${serial_number}"</strong> is already in use.</p>
            <a href="/assets/edit/${req.params.id}">← Go Back and Try Again</a>
          </div>
        `);
      }
      return res.status(500).send("Database error: " + err.message);
    }
    res.redirect('/');
  });
});

// --- STAFF ROUTES ---

// 6. Staff Directory
app.get('/staff', (req, res) => {
  db.all(`SELECT * FROM staff`, [], (err, staff) => {
    if (err) return res.status(500).send("Database error: " + err.message);
    res.render('staff', { staff: staff || [] });
  });
});

// 7. Add Staff POST with duplicate email handling
app.post('/staff/add', (req, res) => {
  const { name, email, department } = req.body;
  const query = `INSERT INTO staff (name, email, department) VALUES (?, ?, ?)`;

  db.run(query, [name, email, department], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).send(`
          <div style="font-family: Arial, sans-serif; margin: 30px;">
            <h2 style="color: #dc3545;">Cannot Add Staff: Duplicate Email</h2>
            <p>A staff member with email <strong>"${email}"</strong> is already registered.</p>
            <a href="/staff">← Go Back and Try Again</a>
          </div>
        `);
      }
      return res.status(500).send("Database error: " + err.message);
    }
    res.redirect('/staff');
  });
});

// 8. View assets currently held by a specific staff member
app.get('/staff/:id/assets', (req, res) => {
  const staffId = req.params.id;
  const query = `
    SELECT assets.*, assignments.assigned_at 
    FROM assets 
    JOIN assignments ON assets.id = assignments.asset_id 
    WHERE assignments.staff_id = ? AND assignments.returned_at IS NULL
  `;

  db.get(`SELECT * FROM staff WHERE id = ?`, [staffId], (err, staff) => {
    if (err || !staff) return res.status(404).send("Staff member not found");

    db.all(query, [staffId], (err, assets) => {
      if (err) return res.status(500).send("Database error: " + err.message);
      res.render('staff_assets', { staff, assets: assets || [] });
    });
  });
});

// --- ASSIGNMENT ROUTES ---

// 9. Assign / Return Page GET
app.get('/assign', (req, res) => {
  db.all(`SELECT * FROM assets WHERE status = 'available'`, [], (err, availableAssets) => {
    if (err) return res.status(500).send("Database error: " + err.message);

    const assignedQuery = `
      SELECT assets.id, assets.name, assets.asset_tag, staff.name AS holder_name
      FROM assets
      JOIN assignments ON assets.id = assignments.asset_id AND assignments.returned_at IS NULL
      JOIN staff ON assignments.staff_id = staff.id
      WHERE assets.status = 'assigned'
    `;

    db.all(assignedQuery, [], (err, assignedAssets) => {
      if (err) return res.status(500).send("Database error: " + err.message);

      db.all(`SELECT * FROM staff`, [], (err, staff) => {
        if (err) return res.status(500).send("Database error: " + err.message);

        res.render('assign', { 
          availableAssets: availableAssets || [], 
          assignedAssets: assignedAssets || [], 
          staff: staff || [] 
        });
      });
    });
  });
});

// 10. POST /assign - Assign an available asset to a staff member
app.post('/assign', (req, res) => {
  const { asset_id, staff_id } = req.body;

  if (!asset_id || !staff_id) {
    return res.status(400).send("Please select both an asset and a staff member.");
  }

  db.run(`INSERT INTO assignments (asset_id, staff_id) VALUES (?, ?)`, [asset_id, staff_id], function(err) {
    if (err) return res.status(500).send("Assignment error: " + err.message);

    db.run(`UPDATE assets SET status = 'assigned' WHERE id = ?`, [asset_id], (err) => {
      if (err) return res.status(500).send("Status update error: " + err.message);
      res.redirect('/');
    });
  });
});

// 11. POST /return - Return an assigned asset
app.post('/return', (req, res) => {
  const { asset_id } = req.body;

  if (!asset_id) {
    return res.status(400).send("Please select an asset to return.");
  }

  const query = `UPDATE assignments SET returned_at = CURRENT_TIMESTAMP WHERE asset_id = ? AND returned_at IS NULL`;

  db.run(query, [asset_id], function(err) {
    if (err) return res.status(500).send("Return log error: " + err.message);

    db.run(`UPDATE assets SET status = 'available' WHERE id = ?`, [asset_id], (err) => {
      if (err) return res.status(500).send("Status update error: " + err.message);
      res.redirect('/');
    });
  });
});

// --- HISTORY ROUTES ---

// Alias route to support /assets/history/:id
app.get('/assets/history/:id', (req, res) => {
  res.redirect(`/assets/${req.params.id}/history`);
});

// Primary history route: /assets/:id/history
app.get('/assets/:id/history', (req, res) => {
  const assetId = req.params.id;
  const historyQuery = `
    SELECT assignments.*, staff.name AS staff_name, staff.email 
    FROM assignments 
    JOIN staff ON assignments.staff_id = staff.id 
    WHERE assignments.asset_id = ? 
    ORDER BY assignments.assigned_at DESC
  `;

  db.all(historyQuery, [assetId], (err, history) => {
    if (err) return res.status(500).send("History query error: " + err.message);

    db.get(`SELECT * FROM assets WHERE id = ?`, [assetId], (err, asset) => {
      if (err || !asset) return res.status(404).send("Asset not found");
      res.render('history', { asset, history: history || [] });
    });
  });
});

// --- SERVER START ---

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});