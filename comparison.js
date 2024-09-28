const teamNames = {
    'ATL': 'Atlanta Hawks',
    'BOS': 'Boston Celtics',
    'BKN': 'Brooklyn Nets',
    'CHA': 'Charlotte Hornets',
    'CHI': 'Chicago Bulls',
    'CLE': 'Cleveland Cavaliers',
    'DAL': 'Dallas Mavericks',
    'DEN': 'Denver Nuggets',
    'DET': 'Detroit Pistons',
    'GSW': 'Golden State Warriors',
    'HOU': 'Houston Rockets',
    'IND': 'Indiana Pacers',
    'LAC': 'Los Angeles Clippers',
    'LAL': 'Los Angeles Lakers',
    'MEM': 'Memphis Grizzlies',
    'MIA': 'Miami Heat',
    'MIL': 'Milwaukee Bucks',
    'MIN': 'Minnesota Timberwolves',
    'NOP': 'New Orleans Pelicans',
    'NYK': 'New York Knicks',
    'OKC': 'Oklahoma City Thunder',
    'ORL': 'Orlando Magic',
    'PHI': 'Philadelphia 76ers',
    'PHX': 'Phoenix Suns',
    'POR': 'Portland Trail Blazers',
    'SAC': 'Sacramento Kings',
    'SAS': 'San Antonio Spurs',
    'TOR': 'Toronto Raptors',
    'UTA': 'Utah Jazz',
    'WAS': 'Washington Wizards'
};

const positions = {
    'C': 'Center',
    'PF': 'Power Forward',
    'SF': 'Small Forward',
    'SG': 'Shooting Guard',
    'PG': 'Point Guard',
    'F': 'Forward',
    'G': 'Guard',
    'F-C': 'Forward-Center',
    'C-F': 'Center-Forward',
    'G-F': 'Guard-Forward',
    'F-G': 'Forward-Guard'
};

let playersData = {};

document.addEventListener('DOMContentLoaded', () => {
    fetchPlayersData().then(() => {
        console.log('Players data loaded:', playersData);
        setupEventListeners();
        initializePlayerSelection('trading');
        initializePlayerSelection('receiving');
    }).catch(error => {
        console.error('Error loading player data:', error);
    });
});

async function fetchPlayersData() {
    try {
        const response = await fetch('http://localhost:3000/api/players');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Raw data from API:', data);
        processPlayersData(data);
    } catch (error) {
        console.error('Error fetching player data:', error);
    }
}

function processPlayersData(data) {
    playersData = data.reduce((acc, player) => {
        acc[player.player_name] = player;
        return acc;
    }, {});
    console.log('Processed players data:', playersData);
}

function filterPlayers(input, playerId) {
    const query = input.value.toLowerCase();
    const resultsContainer = document.getElementById(`${playerId}-results`) || document.createElement('div');
    resultsContainer.id = `${playerId}-results`;
    resultsContainer.className = 'search-results';

    if (!resultsContainer.parentNode) {
        input.parentNode.appendChild(resultsContainer);
    }

    resultsContainer.style.top = `${input.offsetTop + input.offsetHeight}px`;
    resultsContainer.style.left = `${input.offsetLeft}px`;
    resultsContainer.style.width = `${input.offsetWidth}px`;

    const players = Object.keys(playersData);
    console.log('Available players:', players);
    resultsContainer.innerHTML = '';

    if (query.length === 0) {
        resultsContainer.style.display = 'none';
        const playerCard = document.getElementById(playerId);
        clearPlayerCard(playerCard);
        checkSelection();
        return;
    }

    const filteredPlayers = players.filter(player => 
        player.toLowerCase().includes(query)
    );

    console.log('Filtered players:', filteredPlayers);

    filteredPlayers.forEach(player => {
        const div = document.createElement('div');
        div.textContent = player;
        div.addEventListener('click', () => selectPlayer(input, player, playerId));
        resultsContainer.appendChild(div);
    });

    resultsContainer.style.display = filteredPlayers.length > 0 ? 'block' : 'none';
}

function setupEventListeners() {
    const addTradingPlayerButton = document.getElementById('add-trading-player');
    const addReceivingPlayerButton = document.getElementById('add-receiving-player');
    const compareButton = document.getElementById('compareButton');

    addTradingPlayerButton.addEventListener('click', () => addPlayer('trading'));
    addReceivingPlayerButton.addEventListener('click', () => addPlayer('receiving'));

    compareButton.addEventListener('click', comparePlayers);
}

function initializePlayerSelection(type) {
    const container = document.getElementById(`${type}-players`);
    addPlayerField(container, type, 0);
}

function addPlayerField(container, type, count) {
    const playerId = `${type}-player${count + 1}`;
    const playerCard = document.createElement('div');
    playerCard.className = 'player-card';
    playerCard.id = playerId;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Search for a player (Player ${count + 1})`;
    input.className = 'player-card-dropdown';
    input.addEventListener('input', (event) => filterPlayers(event.target, playerId));

    playerCard.appendChild(input);
    container.appendChild(playerCard);

    input.addEventListener('input', checkSelection);
}

function addPlayer(type) {
    const container = document.getElementById(`${type}-players`);
    const count = container.children.length;

    if (count < 5) {
        addPlayerField(container, type, count);

        const allPlayerCards = container.querySelectorAll('.player-card');
        allPlayerCards.forEach(card => {
            const img = card.querySelector('img');
            if (img) img.style.display = 'block';
            const infoContainer = card.querySelector('.player-info-container');
            if (infoContainer) infoContainer.style.display = 'flex';
        });

        if (count === 4) {
            const addPlayerButton = document.getElementById(`add-${type}-player`);
            addPlayerButton.style.display = 'none';
        }
    }
}

function selectPlayer(input, playerName, playerId) {
    input.value = playerName;
    const resultsContainer = document.getElementById(`${playerId}-results`);
    resultsContainer.style.display = 'none';

    const playerCard = document.getElementById(playerId);
    updatePlayerCard(playerCard, playerName);

    checkSelection();
}

function updatePlayerCard(card, playerName) {
    const playerInfo = playersData[playerName] || {};

    let img = card.querySelector('img');
    if (!img) {
        img = document.createElement('img');
        img.src = `nbaheadshots/player_images/${playerName.replace(' ', '-')}.jpg`;
        img.alt = playerName;
        card.appendChild(img);
    } else {
        img.src = `nbaheadshots/player_images/${playerName.replace(' ', '-')}.jpg`;
        img.alt = playerName;
        img.style.display = 'block';
    }

    let infoContainer = card.querySelector('.player-info-container');
    if (!infoContainer) {
        infoContainer = document.createElement('div');
        infoContainer.className = 'player-info-container';
        card.appendChild(infoContainer);
    }

    infoContainer.innerHTML = `
        <div class="player-info">
            <div class="player-ranking">Rank: ${playerInfo.rank || 'N/A'}</div>
            <div class="player-position">Position: ${positions[playerInfo.position] || 'N/A'}</div>
            <div class="player-team">Team: ${teamNames[playerInfo.team] || 'N/A'}</div>
        </div>
    `;
    infoContainer.style.display = 'flex';

    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'center';
}

function clearPlayerCard(card) {
    const img = card.querySelector('img');
    if (img) {
        img.style.display = 'none';
    }

    const infoContainer = card.querySelector('.player-info-container');
    if (infoContainer) {
        infoContainer.innerHTML = '';
        infoContainer.style.display = 'none';
    }
}

function checkSelection() {
    const tradingPlayers = document.querySelectorAll('#trading-players .player-card input');
    const receivingPlayers = document.querySelectorAll('#receiving-players .player-card input');
    const compareButton = document.getElementById('compareButton');

    let validTradingPlayer = false;
    let validReceivingPlayer = false;

    tradingPlayers.forEach(input => {
        if (input.value.trim()) {
            validTradingPlayer = true;
        }
    });

    receivingPlayers.forEach(input => {
        if (input.value.trim()) {
            validReceivingPlayer = true;
        }
    });

    compareButton.disabled = !(validTradingPlayer && validReceivingPlayer);
}

function comparePlayers() {
    const tradingPlayers = document.querySelectorAll('#trading-players .player-card input');
    const receivingPlayers = document.querySelectorAll('#receiving-players .player-card input');

    const tradingStats = {};
    const receivingStats = {};

    tradingPlayers.forEach(input => {
        const playerName = input.value.trim();
        if (playerName && playersData[playerName]) {
            combineStats(tradingStats, playersData[playerName]);
        }
    });

    receivingPlayers.forEach(input => {
        const playerName = input.value.trim();
        if (playerName && playersData[playerName]) {
            combineStats(receivingStats, playersData[playerName]);
        }
    });

    updateComparisonTable(tradingStats, receivingStats);

    // Enable the AI analysis button after comparison
    aiAnalysisButton.disabled = false;
}

function combineStats(accumulatedStats, playerStats) {
    for (let stat in playerStats) {
        if (stat !== 'rank' && stat !== 'player_name' && stat !== 'position' && stat !== 'team') {
            accumulatedStats[stat] = (accumulatedStats[stat] || 0) + parseFloat(playerStats[stat] || 0);
        }
    }
}

function updateComparisonTable(tradingStats, receivingStats) {
    const comparisonTableBody = document.getElementById('comparisonTable').getElementsByTagName('tbody')[0];
    comparisonTableBody.innerHTML = '';

    const allStats = new Set([
        ...Object.keys(tradingStats),
        ...Object.keys(receivingStats)
    ]);

    const excludedStats = ['rank', 'player_name', 'position', 'team'];

    function formatStatName(stat) {
        return stat.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    allStats.forEach(stat => {
        if (!excludedStats.includes(stat.toLowerCase())) {
            const row = comparisonTableBody.insertRow();
            const statCell = row.insertCell(0);
            statCell.innerText = formatStatName(stat) || 'N/A';
            statCell.style.fontWeight = 'bold';

            const tradingValue = tradingStats[stat] !== undefined ? tradingStats[stat].toFixed(2) : 'N/A';
            const receivingValue = receivingStats[stat] !== undefined ? receivingStats[stat].toFixed(2) : 'N/A';

            row.insertCell(1).innerText = tradingValue;
            row.insertCell(2).innerText = receivingValue;

            const projectionCell = row.insertCell(3);
            const difference = (receivingStats[stat] || 0) - (tradingStats[stat] || 0);
            projectionCell.innerText = `${difference >= 0 ? '+' : ''}${difference.toFixed(2)}`;
            projectionCell.style.color = difference >= 0 ? 'green' : 'red';
        }
    });
}

// AI Analysis Popup functionality
const aiAnalysisButton = document.getElementById('aiAnalysisButton');
const aiAnalysisPopup = document.getElementById('aiAnalysisPopup');
const closePopup = document.querySelector('.close-popup');

aiAnalysisButton.addEventListener('click', () => {
    if (!aiAnalysisButton.disabled) {
        aiAnalysisPopup.style.display = 'block';
        // Here you would typically call a function to generate and display the AI analysis
        // For now, we'll just display a placeholder message
        document.getElementById('aiAnalysisText').innerHTML = "AI analysis of the trade will be displayed here.";
    }
});

closePopup.addEventListener('click', () => {
  aiAnalysisPopup.style.display = 'none';
});

window.addEventListener('click', (event) => {
  if (event.target == aiAnalysisPopup) {
    aiAnalysisPopup.style.display = 'none';
  }
});

// Function to handle the "See what AI thinks about your trade" button click
async function handleAIAnalysis() {
  const tradedPlayers = getSelectedPlayers('traded-players');
  const receivedPlayers = getSelectedPlayers('received-players');

  const tradeData = {
    tradedPlayers,
    receivedPlayers
  };

  try {
    const response = await fetch('/api/analyze-trade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tradeData),
    });

    if (!response.ok) {
      throw new Error('Failed to get AI analysis');
    }

    const analysisResult = await response.json();
    displayAIAnalysis(analysisResult.analysis);
  } catch (error) {
    console.error('Error getting AI analysis:', error);
    displayAIAnalysis('An error occurred while analyzing the trade. Please try again.');
  }
}

function getSelectedPlayers(containerId) {
  const container = document.getElementById(containerId);
  const playerElements = container.querySelectorAll('.player');
  return Array.from(playerElements).map(el => ({
    name: el.querySelector('.player-name').textContent,
    stats: {
      points: parseFloat(el.querySelector('.player-points').textContent),
      assists: parseFloat(el.querySelector('.player-assists').textContent),
      rebounds: parseFloat(el.querySelector('.player-rebounds').textContent)
    }
  }));
}

function displayAIAnalysis(analysis) {
  const popup = document.getElementById('ai-analysis-popup');
  const content = document.getElementById('ai-analysis-content');
  content.textContent = analysis;
  popup.style.display = 'block';
}

// Add event listener to the AI analysis button
document.getElementById('ai-analysis-button').addEventListener('click', handleAIAnalysis);

// Close popup when clicking outside
window.addEventListener('click', function(event) {
  const popup = document.getElementById('ai-analysis-popup');
  if (event.target === popup) {
    popup.style.display = 'none';
  }
});

