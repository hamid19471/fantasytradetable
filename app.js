const { google } = require('googleapis');
const mysql = require('mysql2/promise');
const express = require('express');
const fs = require('fs');

// Create an Express app
const app = express();

// Load your service account credentials
const credentials = JSON.parse(fs.readFileSync('Ballhog IAM Admin.json'));

// Authenticate using the service account
const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// Create a connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'ballhog_googlespreadsheet',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Get the spreadsheet data
async function getSheetData() {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  // Fetch data from your spreadsheet (columns A-T and up to 348 rows)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: '1OGVWwKgwZVZ-uHAt6DqodCclY4gl1SRhtoowKaY2qIg', // Replace with your actual spreadsheet ID
    range: 'Sheet1!A1:T348', // Adjust this range to fit your sheet
  });

  const rows = res.data.values;
  if (rows.length) {
    console.log('Data from Google Sheets:');
    console.log(rows);
    await clearAndInsertIntoDatabase(rows);
  } else {
    console.log('No data found.');
  }
}

// Clear the table and insert Google Sheets data into MySQL
async function clearAndInsertIntoDatabase(data) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Clear the existing data
    await connection.execute('TRUNCATE TABLE ballhog_projections');
    console.log('Existing data cleared from the table.');

    const headers = data[0];
    const rows = data.slice(1); // Skip headers

    const query = `INSERT INTO ballhog_projections (
      \`rank\`, 
      player_name, 
      position, 
      team, 
      games_played, 
      minutes_per_game, 
      field_goals_made, 
      field_goals_attempted, 
      field_goal_percentage, 
      free_throws_made, 
      free_throws_attempted, 
      free_throw_percentage, 
      three_pointers_made, 
      points_per_game, 
      rebounds_per_game, 
      assists_per_game, 
      steals_per_game, 
      blocks_per_game, 
      turnovers_per_game, 
      z_scores
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    for (const row of rows) {
      // Ensure each row has exactly 20 values (columns A-T)
      const sanitizedRow = row.slice(0, 20);
      await connection.execute(query, sanitizedRow);
    }

    await connection.commit();
    console.log('New data inserted into database.');
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}


// Create an endpoint to fetch all player data
app.get('/api/players', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM ballhog_projections');
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'An error occurred while fetching player data' });
    }
});

// Create an endpoint to display data from MySQL
app.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ballhog_projections');
    res.send(`<table>
      <tr>
        <th>Rank</th><th>Player Name</th><th>Position</th><th>Team</th><th>Games Played</th>
        <th>Minutes Per Game</th><th>FG Made</th><th>FG Attempted</th><th>FG%</th><th>FT Made</th>
        <th>FT Attempted</th><th>FT%</th><th>3PM</th><th>PPG</th><th>RPG</th><th>APG</th>
        <th>SPG</th><th>BPG</th><th>TOPG</th><th>Z-Scores</th>
      </tr>
      ${rows.map(row => `<tr>
        <td>${row.rank}</td><td>${row.player_name}</td><td>${row.position}</td><td>${row.team}</td>
        <td>${row.games_played}</td><td>${row.minutes_per_game}</td><td>${row.field_goals_made}</td>
        <td>${row.field_goals_attempted}</td><td>${row.field_goal_percentage}</td><td>${row.free_throws_made}</td>
        <td>${row.free_throws_attempted}</td><td>${row.free_throw_percentage}</td><td>${row.three_pointers_made}</td>
        <td>${row.points_per_game}</td><td>${row.rebounds_per_game}</td><td>${row.assists_per_game}</td>
        <td>${row.steals_per_game}</td><td>${row.blocks_per_game}</td><td>${row.turnovers_per_game}</td>
        <td>${row.z_scores}</td>
      </tr>`).join('')}
    </table>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('An error occurred');
  }
});

module.exports = { pool };