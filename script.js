// ---------- 설정 ----------
let cols = 20, rows = 15; // 기본 미로 셀 수
let cellSize = 32; // 픽셀
let showGrid = false;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const timerEl = document.getElementById('timer');
const movesEl = document.getElementById('moves');
const sizeRange = document.getElementById('sizeRange');
const sizeLabel = document.getElementById('sizeLabel');
const cellRange = document.getElementById('cellRange');
const cellLabel = document.getElementById('cellLabel');
const levelLabel = document.getElementById('levelLabel');

let maze = []; // 0 = 길, 1 = 벽
let player = {x:1,y:1};
let start = {x:1,y:1};
let goal = {x:cols-2,y:rows-2};
let moves = 0;
let startTime = null, running=false, timerReq=null;

// ---------- 미로 생성 (DFS 백트래킹) ----------
function makeEmptyMaze(c,r){
  const m = Array.from({length:r},()=>Array(c).fill(1));
  return m;
}

function carveMaze(c,r){
  const m = makeEmptyMaze(c,r);
  function inBounds(x,y){return x>0 && x< c-1 && y>0 && y< r-1}
  const stack = [];
  const sx = 1, sy = 1;
  m[sy][sx]=0; stack.push({x:sx,y:sy});
  const dirs = [{x:0,y:-2},{x:2,y:0},{x:0,y:2},{x:-2,y:0}];
  while(stack.length){
    const cur = stack[stack.length-1];
    const shuffled = dirs.sort(()=>Math.random()-0.5);
    let carved=false;
    for(const d of shuffled){
      const nx = cur.x + d.x, ny = cur.y + d.y;
      if(inBounds(nx,ny) && m[ny][nx]===1){
        m[ny][nx]=0;
        m[cur.y + d.y/2][cur.x + d.x/2]=0;
        stack.push({x:nx,y:ny});
        carved=true; break;
      }
    }
    if(!carved) stack.pop();
  }
  return m;
}

function generateMaze(){
  const c = cols % 2 === 0 ? cols+1 : cols;
  const r = rows % 2 === 0 ? rows+1 : rows;
  maze = carveMaze(c,r);
  start = findNearestPath(1,1);
  goal = findNearestPath(c-2,r-2);
  player = {x:start.x,y:start.y};
  moves = 0; updateHUD();
  stopTimer(); startTimer();
  draw();
}

function findNearestPath(x,y){
  if(maze[y] && maze[y][x]===0) return {x,y};
  const q=[{x,y}]; const seen=new Set([x+','+y]);
  const dirs=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
  while(q.length){
    const cur=q.shift();
    if(maze[cur.y] && maze[cur.y][cur.x]===0) return cur;
    for(const d of dirs){
      const nx=cur.x+d.x, ny=cur.y+d.y, key=nx+','+ny;
      if(nx<0||ny<0||ny>=maze.length||nx>=maze[0].length) continue;
      if(seen.has(key)) continue; seen.add(key); q.push({x:nx,y:ny});
    }
  }
  return {x:1,y:1};
}

// ---------- 그리기 ----------
function resizeCanvas(){
  const w = maze[0].length * cellSize;
  const h = maze.length * cellSize;
  canvas.width = w; canvas.height = h;
  canvas.style.width = w+'px'; canvas.style.height = h+'px';
}

function draw(){
  if(!maze.length) return;
  resizeCanvas();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--path') || '#f8fafc';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<maze.length;y++){
    for(let x=0;x<maze[0].length;x++){
      if(maze[y][x]===1){
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--wall') || '#222';
        ctx.fillRect(x*cellSize,y*cellSize,cellSize,cellSize);
      }
    }
  }
  if(showGrid){
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for(let x=0;x<=maze[0].length;x++){
      ctx.beginPath(); ctx.moveTo(x*cellSize,0); ctx.lineTo(x*cellSize,canvas.height); ctx.stroke();
    }
    for(let y=0;y<=maze.length;y++){
      ctx.beginPath(); ctx.moveTo(0,y*cellSize); ctx.lineTo(canvas.width,y*cellSize); ctx.stroke();
    }
  }
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--goal') || '#10b981';
  ctx.fillRect(goal.x*cellSize+4,goal.y*cellSize+4,cellSize-8,cellSize-8);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--player') || '#ef4444';
  ctx.beginPath();
  const cx = player.x*cellSize + cellSize/2;
  const cy = player.y*cellSize + cellSize/2;
  const r = Math.max(6, cellSize*0.26);
  ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
}

// ---------- 이동 ----------
function canMove(nx,ny){
  if(ny<0||nx<0||ny>=maze.length||nx>=maze[0].length) return false;
  return maze[ny][nx]===0;
}
function movePlayer(dx,dy){
  const nx = player.x + dx, ny = player.y + dy;
  if(canMove(nx,ny)){
    player.x = nx; player.y = ny; moves++; updateHUD(); draw();
    checkWin();
  }
}
function checkWin(){
  if(player.x===goal.x && player.y===goal.y){
    stopTimer(); drawWin();
  }
}
function drawWin(){
  ctx.fillStyle = 'rgba(2,6,23,0.7)';
  ctx.fillRect(0,canvas.height/2-60,canvas.width,120);
  ctx.fillStyle = '#e6eef8'; ctx.font = '20px sans-serif'; ctx.textAlign='center';
  ctx.fillText('탈출 성공! 시간: '+timerEl.textContent+'초  이동: '+moves+'회', canvas.width/2, canvas.height/2+8);
}

// ---------- 타이머 ----------
function startTimer(){ startTime = performance.now(); running=true; timerLoop(); }
function stopTimer(){ running=false; if(timerReq) cancelAnimationFrame(timerReq); }
function timerLoop(){
  if(!running) return;
  const t = (performance.now()-startTime)/1000; timerEl.textContent = t.toFixed(2);
  timerReq = requestAnimationFrame(timerLoop);
}

// ---------- HUD ----------
function updateHUD(){
  movesEl.textContent = moves;
  sizeLabel.textContent = (maze[0].length)+' × '+maze.length;
  cellLabel.textContent = cellSize;
}

// TODO: 자동 길찾기 함수(solveMaze) 이어서 작성 가능
// ---------- 입력 이벤트 ----------
document.addEventListener('keydown', e=>{
  switch(e.key){
    case 'ArrowUp': case 'w': case 'W': movePlayer(0,-1); break;
    case 'ArrowDown': case 's': case 'S': movePlayer(0,1); break;
    case 'ArrowLeft': case 'a': case 'A': movePlayer(-1,0); break;
    case 'ArrowRight': case 'd': case 'D': movePlayer(1,0); break;
  }
});

// 버튼: 새 미로
document.getElementById('newMaze').addEventListener('click', ()=>{
  cols = parseInt(sizeRange.value);
  rows = Math.floor(cols * 0.75); // 가로세로 비율 유지
  generateMaze();
});

// 버튼: 다시 시작
document.getElementById('reset').addEventListener('click', ()=>{
  player = {x:start.x,y:start.y};
  moves = 0; updateHUD(); stopTimer(); startTimer(); draw();
});

// Range: 미로 크기
sizeRange.addEventListener('input', ()=>{
  cols = parseInt(sizeRange.value);
  rows = Math.floor(cols * 0.75);
  sizeLabel.textContent = cols+' × '+rows;
});

// Range: 셀 크기
cellRange.addEventListener('input', ()=>{
  cellSize = parseInt(cellRange.value);
  cellLabel.textContent = cellSize;
  draw();
});

// 버튼: 그리드 토글
document.getElementById('toggleGrid').addEventListener('click', ()=>{
  showGrid = !showGrid;
  draw();
});

// ---------- 초기화 ----------
generateMaze();
