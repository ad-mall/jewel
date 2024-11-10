const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const pdfkit = require('pdfkit');
const fs = require('fs');

const app = express();
const port = 3000;

// Initialize database
const db = new sqlite3.Database('./database/invoices.db', (err) => {
  if (err) {
    console.error("Error opening database: " + err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));  // Serve static files

// API to create a new invoice
app.post('/create-invoice', (req, res) => {
  const { customerName, items, totalAmount } = req.body;

  // Insert invoice into the database
  const query = 'INSERT INTO invoices (customerName, items, totalAmount) VALUES (?, ?, ?)';
  db.run(query, [customerName, JSON.stringify(items), totalAmount], function(err) {
    if (err) {
      return res.status(500).send({ error: 'Database error' });
    }
    const invoiceId = this.lastID;
    return res.status(200).json({ invoiceId });
  });
});

// API to generate PDF invoice
app.get('/generate-pdf/:invoiceId', (req, res) => {
  const invoiceId = req.params.invoiceId;
  
  // Retrieve invoice from DB
  db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId], (err, row) => {
    if (err || !row) {
      return res.status(404).send({ error: 'Invoice not found' });
    }

    const doc = new pdfkit();
    const fileName = `invoice-${invoiceId}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/pdf');
    
    // Generate PDF content
    doc.pipe(res);
    doc.fontSize(20).text(`Invoice #${invoiceId}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Customer: ${row.customerName}`);
    doc.moveDown();
    const items = JSON.parse(row.items);
    items.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.name} - $${item.price}`);
    });
    doc.moveDown();
    doc.fontSize(18).text(`Total Amount: $${row.totalAmount}`, { align: 'right' });
    doc.end();
  });
});

// API to get all invoices (for listing)
app.get('/invoices', (req, res) => {
  db.all('SELECT * FROM invoices', [], (err, rows) => {
    if (err) {
      return res.status(500).send({ error: 'Database error' });
    }
    return res.status(200).json(rows);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
