const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const cors = require('cors');
const cron = require('node-cron');
const { google } = require('googleapis');
const mysql = require('mysql2/promise');
const fs = require('fs');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// Load your service account credentials
const credentials = JSON.parse(fs.readFileSync('Ballhog IAM Admin.json'));

// Authenticate using the service account
const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// Create a connection pool
const pool = mysql.createPool({
  host: 'ballhog-db',
  user: 'root',
  password: 'qNnqP5Artz4opjwbOLGCayu3',
  database: 'ballhog_googlespreadsheet',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Get the spreadsheet data
async function getSheetData() {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: '1OGVWwKgwZVZ-uHAt6DqodCclY4gl1SRhtoowKaY2qIg',
    range: 'Sheet1!A1:T348',
  });

  return res.data.values;
}

// Clear the table and insert Google Sheets data into MySQL
async function updateDatabase(data) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute('TRUNCATE TABLE ballhog_projections');
    console.log('Existing data cleared from the table.');

    const query = `INSERT INTO ballhog_projections (
      \`rank\`, player_name, position, team, games_played, minutes_per_game, 
      field_goals_made, field_goals_attempted, field_goal_percentage, 
      free_throws_made, free_throws_attempted, free_throw_percentage, 
      three_pointers_made, points_per_game, rebounds_per_game, assists_per_game, 
      steals_per_game, blocks_per_game, turnovers_per_game, z_scores
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    for (const row of data.slice(1)) { // Skip header row
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

let nextUpdateTime;

function updateCountdown() {
  const now = new Date();
  const timeLeft = nextUpdateTime - now;
  
  if (timeLeft > 0) {
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    process.stdout.write(`\rNext update in ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
  }
}

// Function to update data
async function updateData() {
    console.log('\nUpdating data...');
    try {
        const data = await getSheetData();
        await updateDatabase(data);
        console.log('Data update completed successfully');
        
        // Set the next update time to 1 hour from now
        nextUpdateTime = new Date(Date.now() + 60 * 60 * 1000);
    } catch (error) {
        console.error('Error updating data:', error);
    }
}

// Allow requests from localhost:3000
app.use(cors({ origin: `http://localhost:${PORT}` }));

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// Create an endpoint to fetch all player data as JSON
app.get('/api/players', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM ballhog_projections');
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'An error occurred while fetching player data' });
    }
});

// Create an endpoint to display data from MySQL as HTML
app.get('/htmltable', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ballhog_projections');
    res.send(`
      <html>
        <head>
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <th>Rank</th>
              <th>Player Name</th>
              <th>Position</th>
              <th>Team</th>
              <th>Games Played</th>
              <th>Minutes Per Game</th>
              <th>FG Made</th>
              <th>FG Attempted</th>
              <th>FG%</th>
              <th>FT Made</th>
              <th>FT Attempted</th>
              <th>FT%</th>
              <th>3PM</th>
              <th>PPG</th>
              <th>RPG</th>
              <th>APG</th>
              <th>SPG</th>
              <th>BPG</th>
              <th>TOPG</th>
              <th>Z-Scores</th>
            </tr>
            ${rows.map(row => `
              <tr>
                <td>${row.rank}</td>
                <td>${row.player_name}</td>
                <td>${row.position}</td>
                <td>${row.team}</td>
                <td>${row.games_played}</td>
                <td>${row.minutes_per_game}</td>
                <td>${row.field_goals_made}</td>
                <td>${row.field_goals_attempted}</td>
                <td>${row.field_goal_percentage}</td>
                <td>${row.free_throws_made}</td>
                <td>${row.free_throws_attempted}</td>
                <td>${row.free_throw_percentage}</td>
                <td>${row.three_pointers_made}</td>
                <td>${row.points_per_game}</td>
                <td>${row.rebounds_per_game}</td>
                <td>${row.assists_per_game}</td>
                <td>${row.steals_per_game}</td>
                <td>${row.blocks_per_game}</td>
                <td>${row.turnovers_per_game}</td>
                <td>${row.z_scores}</td>
              </tr>
            `).join('')}
          </table>
        </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('An error occurred');
  }
});

// Update data immediately when server starts
updateData();

// Schedule data update to run every hour
cron.schedule('0 * * * *', updateData);

//Every minute
//cron.schedule('* * * * *', updateData);

// Start the countdown update
setInterval(updateCountdown, 1000);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/analyze-trade', async (req, res) => {
  try {
    const { tradedPlayers, receivedPlayers } = req.body;

    // Ensure we have exactly two players for comparison
    if (tradedPlayers.length !== 1 || receivedPlayers.length !== 1) {
      throw new Error('This analysis requires exactly two players (one traded, one received)');
    }

    const player1 = tradedPlayers[0];
    const player2 = receivedPlayers[0];

    // Prepare the prompt for Gemini
    const prompt = `I need help evaluating a potential trade between two players based on their current season's stats, injury history, and overall performance. Here are the detailed stats for both players:

Player 1 (${player1.name}):
Games Played: ${player1.stats.gamesPlayed}
Minutes Per Game: ${player1.stats.minutesPerGame}
Field Goal Percentage: ${player1.stats.fieldGoalPercentage}
Points: ${player1.stats.points}
Rebounds: ${player1.stats.rebounds}
Assists: ${player1.stats.assists}
Turnovers: ${player1.stats.turnovers}
Last Season Injuries: ${player1.stats.lastSeasonInjuries}

Player 2 (${player2.name}):
Games Played: ${player2.stats.gamesPlayed}
Minutes Per Game: ${player2.stats.minutesPerGame}
Field Goal Percentage: ${player2.stats.fieldGoalPercentage}
Points: ${player2.stats.points}
Rebounds: ${player2.stats.rebounds}
Assists: ${player2.stats.assists}
Turnovers: ${player2.stats.turnovers}
Last Season Injuries: ${player2.stats.lastSeasonInjuries}

Please provide the analysis in the following format:

Start by summarizing the games played and who has the edge in health and availability. Discuss the injury history of both players, mentioning any significant injuries and missed games. Compare their performance stats (points, efficiency, rebounds, assists, etc.). Conclude by discussing versatility and reliability, identifying who is the better trade overall, and why. 

I want an answer exactly like this format:

'Based on the provided stats and last season's performance:

Games Played: [Player 1] played X games, while [Player 2] played Y, giving [Player 1/2] the edge in terms of health and availability.

Injuries: [Player 1] had multiple injury issues last season, including [details], whereas [Player 2] missed [X] games and remained [injury status].

Performance Stats: While [Player 1] scores more points per game (X vs. Y), [Player 2] has better overall efficiency, with a higher field goal percentage (X% vs. Y%), fewer turnovers (X vs. Y), and superior [rebounds/assists/other categories].

Versatility and Reliability: [Player 2] offers a more balanced stat line, contributing heavily in multiple areas with fewer injury risks and more consistency across the board.

Given [Player 2]'s superior availability, fewer injuries, and all-around game, trading [Player 1] for [Player 2] would likely be a good decision if you're seeking more reliability and balanced contributions, despite losing some [category] output.'

Make sure to include detailed analysis of the players' stats and their injury history for an informed decision.`;

    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysis = response.text();

    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing trade:', error);
    res.status(500).json({ error: 'An error occurred while analyzing the trade' });
  }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`View HTML table at http://localhost:${PORT}/htmltable`);
});
