const photoFiles = [
  "mom_01.jpg",
  "mom_02.jpg",
  "mom_03.jpg",
  "mom_04.jpg",
  "mom_05.jpg",
  "mom_06.jpg",
  "mom_07.jpg",
  "mom_08.jpg",
  "mom_09.jpg",
  "mom_10.jpg",
  "mom_11.jpg",
  "mom_12.jpg",
  "mom_13.jpg",
  "mom_14.jpg",
  "mom_15.jpg",
  "mom_16.jpg",
  "mom_17.jpg",
  "mom_18.jpg"
];

const imageFolders = ["image/", "images/", "Image/", "Images/"];
const pairCount = 7; // 7 組照片配對卡 = 14 張，再加 2 張烏龜 bonus 卡，總共 16 張
const startSeconds = 25;
const bonusTimeSeconds = 5;
const bonusScorePoints = 300;
const leaderboardKey = "mothersDayCardGameLeaderboardV1";

const board = document.getElementById("gameBoard");
const timerEl = document.getElementById("timer");
const scoreEl = document.getElementById("score");
const matchedEl = document.getElementById("matched");
const totalPairsEl = document.getElementById("totalPairs");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restartBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const tryAgainBtn = document.getElementById("tryAgainBtn");
const winModal = document.getElementById("winModal");
const loseModal = document.getElementById("loseModal");
const finalScoreEl = document.getElementById("finalScore");
const loseScoreEl = document.getElementById("loseScore");
const encourageTextEl = document.getElementById("encourageText");
const leaderboardListEl = document.getElementById("leaderboardList");
const modalLeaderboardListEl = document.getElementById("modalLeaderboardList");
const nicknameArea = document.getElementById("nicknameArea");
const nicknameInput = document.getElementById("nicknameInput");
const saveScoreBtn = document.getElementById("saveScoreBtn");
const rankMessageEl = document.getElementById("rankMessage");

let firstCard = null;
let secondCard = null;
let lockBoard = false;
let matchedPairs = 0;
let score = 0;
let timeLeft = startSeconds;
let timerId = null;
let timerStarted = false;
let gameOver = false;
let pendingRecordScore = null;
let pendingRecordSaved = false;
let gameToken = 0;
let cachedPhotoSources = null;
let cachedBonusSources = null;

const encourageTexts = [
  "再試一次一定可以！",
  "訓練手腳協調，下一次會更順！",
  "這次只是熱身，再試一次喔",
  "再試一次噢，嘿嘿！"
];

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function testImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function resolveImage(file) {
  for (const folder of imageFolders) {
    const src = `${folder}${file}`;
    const workingSrc = await testImage(src);
    if (workingSrc) return workingSrc;
  }
  return null;
}

async function getAvailableImages() {
  if (cachedPhotoSources && cachedBonusSources) {
    return { photos: cachedPhotoSources, bonus: cachedBonusSources };
  }

  const photoResults = await Promise.all(
    photoFiles.map(async (file) => {
      const src = await resolveImage(file);
      return src ? { file, src } : null;
    })
  );

  const bonusTimeSrc = await resolveImage("bonus_time.jpg");
  const bonusScoreSrc = await resolveImage("bonus_score.jpg");

  cachedPhotoSources = photoResults.filter(Boolean);
  cachedBonusSources = {
    time: bonusTimeSrc,
    score: bonusScoreSrc
  };

  return { photos: cachedPhotoSources, bonus: cachedBonusSources };
}

function getLeaderboard() {
  try {
    const saved = JSON.parse(localStorage.getItem(leaderboardKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

function saveLeaderboard(records) {
  const topFive = records
    .filter((record) => record && typeof record.score === "number")
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  localStorage.setItem(leaderboardKey, JSON.stringify(topFive));
  return topFive;
}

function qualifiesForLeaderboard(finalScore) {
  const records = getLeaderboard();
  return records.length < 5 || finalScore > records[records.length - 1].score;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLeaderboard(targetEl) {
  const records = getLeaderboard();
  targetEl.innerHTML = "";

  if (records.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-record";
    empty.textContent = "還沒有紀錄，第一名等媽媽來拿！";
    targetEl.appendChild(empty);
    return;
  }

  records.forEach((record) => {
    const item = document.createElement("li");
    const dateText = record.date ? ` · ${record.date}` : "";
    item.innerHTML = `<span class="record-name">${escapeHtml(record.name)}</span>${dateText}<span class="record-score">${record.score}</span>`;
    targetEl.appendChild(item);
  });
}

function renderAllLeaderboards() {
  renderLeaderboard(leaderboardListEl);
  renderLeaderboard(modalLeaderboardListEl);
}

function todayText() {
  const now = new Date();
  return `${now.getMonth() + 1}/${now.getDate()}`;
}

function prepareLeaderboardEntry(finalScore) {
  pendingRecordScore = null;
  pendingRecordSaved = false;
  nicknameInput.value = "";
  nicknameArea.classList.add("hidden");
  saveScoreBtn.disabled = false;
  saveScoreBtn.textContent = "儲存成績";

  if (!qualifiesForLeaderboard(finalScore)) {
    rankMessageEl.textContent = "這次沒有進入前五名，但已經很棒了！";
    return;
  }

  pendingRecordScore = finalScore;
  const records = getLeaderboard();
  const rank = records.filter((record) => record.score > finalScore).length + 1;
  rankMessageEl.textContent = `破紀錄了！目前可以排第 ${rank} 名，輸入暱稱留下成績吧。`;
  nicknameArea.classList.remove("hidden");
  setTimeout(() => nicknameInput.focus(), 550);
}

function savePendingRecord() {
  if (pendingRecordScore === null || pendingRecordSaved) return;

  const name = nicknameInput.value.trim() || "媽媽";
  const cleanName = name.slice(0, 12);
  const records = getLeaderboard();
  saveLeaderboard([
    ...records,
    {
      name: cleanName,
      score: pendingRecordScore,
      date: todayText()
    }
  ]);

  pendingRecordSaved = true;
  saveScoreBtn.disabled = true;
  saveScoreBtn.textContent = "已儲存 ❤️";
  rankMessageEl.textContent = `${cleanName} 的成績已經放進排行榜！`;
  renderAllLeaderboards();
}

function createCard(cardData, index) {
  const card = document.createElement("button");
  card.className = "card";
  card.type = "button";
  card.dataset.kind = cardData.kind;
  card.dataset.id = cardData.id;
  card.setAttribute("aria-label", cardData.kind === "photo" ? "翻開一張照片卡" : "翻開一張烏龜獎勵卡");

  const frontContent = cardData.kind === "photo"
    ? `<img src="${cardData.src}" alt="媽媽照片 ${index + 1}" loading="eager" />`
    : `<div class="bonus-front">
         ${cardData.src ? `<img src="${cardData.src}" alt="${cardData.label}" loading="eager" />` : `<div class="bonus-placeholder">🐢</div>`}
         <span>${cardData.label}</span>
       </div>`;

  card.innerHTML = `
    <div class="card-inner">
      <div class="card-face card-back"><span>♥</span></div>
      <div class="card-face card-front">${frontContent}</div>
    </div>
  `;

  card.addEventListener("click", () => flipCard(card));
  return card;
}

function buildDeck(photos, bonusSources) {
  const selectedPhotos = shuffle(photos).slice(0, pairCount);
  const photoCards = selectedPhotos.flatMap((photo) => [
    { kind: "photo", id: photo.file, src: photo.src },
    { kind: "photo", id: photo.file, src: photo.src }
  ]);

  const bonusCards = [
    { kind: "bonus-time", id: "bonus-time", src: bonusSources.time, label: `+${bonusTimeSeconds} 秒` },
    { kind: "bonus-score", id: "bonus-score", src: bonusSources.score, label: `+${bonusScorePoints} 分` }
  ];

  return shuffle([...photoCards, ...bonusCards]);
}

function resetState() {
  clearInterval(timerId);
  timerId = null;
  timerStarted = false;
  gameOver = false;
  firstCard = null;
  secondCard = null;
  lockBoard = false;
  matchedPairs = 0;
  score = 0;
  timeLeft = startSeconds;

  document.body.classList.remove("urgent");
  timerEl.textContent = timeLeft;
  scoreEl.textContent = score;
  matchedEl.textContent = matchedPairs;
  totalPairsEl.textContent = pairCount;
  messageEl.textContent = "正在準備照片...";
  winModal.classList.add("hidden");
  loseModal.classList.add("hidden");
  board.innerHTML = "";
  nicknameArea.classList.add("hidden");
  pendingRecordScore = null;
  pendingRecordSaved = false;
  renderAllLeaderboards();
}

async function startGame() {
  const thisGame = ++gameToken;
  resetState();

  const buttons = [restartBtn, playAgainBtn, tryAgainBtn];
  buttons.forEach((button) => button.disabled = true);

  const { photos, bonus } = await getAvailableImages();
  if (thisGame !== gameToken) return;

  buttons.forEach((button) => button.disabled = false);

  if (photos.length < pairCount) {
    messageEl.textContent = `照片讀取不到足夠數量，目前只找到 ${photos.length} 張。請確認 image 資料夾和 index.html 在同一層。`;
    return;
  }

  messageEl.textContent = "點第一張牌後開始倒數。";
  buildDeck(photos, bonus).forEach((cardData, index) => {
    board.appendChild(createCard(cardData, index));
  });
}

function startTimer() {
  if (timerStarted) return;
  timerStarted = true;
  messageEl.textContent = "加油！越快配對，分數越高。";

  timerId = setInterval(() => {
    timeLeft -= 1;
    timerEl.textContent = timeLeft;

    if (timeLeft <= 5) {
      document.body.classList.add("urgent");
    }

    if (timeLeft <= 0) {
      endGame(false);
    }
  }, 1000);
}

function flipCard(card) {
  if (lockBoard || gameOver) return;
  if (card.classList.contains("matched") || card.classList.contains("used-bonus")) return;
  if (card === firstCard) return;

  startTimer();
  card.classList.add("flipped");

  if (card.dataset.kind === "bonus-time" || card.dataset.kind === "bonus-score") {
    applyBonus(card);
    return;
  }

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  checkMatch();
}

function applyBonus(card) {
  card.classList.add("used-bonus");
  card.disabled = true;

  if (card.dataset.kind === "bonus-time") {
    timeLeft += bonusTimeSeconds;
    timerEl.textContent = timeLeft;
    messageEl.textContent = `烏龜加時間！+${bonusTimeSeconds} 秒 🐢`;
    document.body.classList.remove("urgent");
  }

  if (card.dataset.kind === "bonus-score") {
    score += bonusScorePoints;
    scoreEl.textContent = score;
    messageEl.textContent = `烏龜加分！+${bonusScorePoints} 分 🐢`;
  }
}

function checkMatch() {
  const isMatch = firstCard.dataset.id === secondCard.dataset.id;

  if (isMatch) {
    firstCard.classList.add("matched");
    secondCard.classList.add("matched");
    firstCard.disabled = true;
    secondCard.disabled = true;

    matchedPairs += 1;
    const matchPoints = 100 + timeLeft * 10;
    score += matchPoints;

    matchedEl.textContent = matchedPairs;
    scoreEl.textContent = score;
    messageEl.textContent = `配對成功！+${matchPoints} 分 ❤️`;
    resetTurn();

    if (matchedPairs === pairCount) {
      endGame(true);
    }
    return;
  }

  lockBoard = true;
  messageEl.textContent = "這兩張不一樣，再找找看～";
  setTimeout(() => {
    if (firstCard) firstCard.classList.remove("flipped");
    if (secondCard) secondCard.classList.remove("flipped");
    resetTurn();
  }, 700);
}

function resetTurn() {
  [firstCard, secondCard] = [null, null];
  lockBoard = false;
}

function endGame(isWin) {
  if (gameOver) return;
  gameOver = true;
  clearInterval(timerId);
  timerId = null;
  lockBoard = true;
  document.body.classList.remove("urgent");

  if (isWin) {
    const speedBonus = Math.max(0, timeLeft) * 20;
    score += speedBonus;
    scoreEl.textContent = score;
    finalScoreEl.textContent = score;
    messageEl.textContent = `完成！速度獎勵 +${speedBonus} 分。`;
    renderAllLeaderboards();
    prepareLeaderboardEntry(score);
    setTimeout(() => winModal.classList.remove("hidden"), 450);
  } else {
    timeLeft = 0;
    timerEl.textContent = 0;
    loseScoreEl.textContent = score;
    encourageTextEl.textContent = encourageTexts[Math.floor(Math.random() * encourageTexts.length)];
    messageEl.textContent = "時間到！可以再挑戰一次。";
    setTimeout(() => loseModal.classList.remove("hidden"), 250);
  }
}

restartBtn.addEventListener("click", startGame);
playAgainBtn.addEventListener("click", startGame);
tryAgainBtn.addEventListener("click", startGame);
saveScoreBtn.addEventListener("click", savePendingRecord);
nicknameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") savePendingRecord();
});

renderAllLeaderboards();
startGame();
