// Connect to server
const socket = io('http://localhost:3000'); // Corrected port to 3000

// Initialize canvas
let canvas = null;
const cursorsLayer = document.getElementById('cursors-layer');
const cursors = new Map();

socket.on('connect', () => {
  console.log('✅ Connected to server');
  document.getElementById('connection-status').textContent = '🟢 Connected';
  document.getElementById('connection-status').style.background = '#e8f5e9';
  
  if (!canvas) {
    canvas = new CollaborativeCanvas('canvas', socket);
  }
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
  document.getElementById('connection-status').textContent = '🔴 Disconnected';
  document.getElementById('connection-status').style.background = '#ffebee';
});

socket.on('init', (data) => {
  console.log('📥 Received initial state:', data);
  if (canvas) { // Ensure canvas is initialized before accessing
    canvas.operations = data.operations || [];
    canvas.redrawCanvas();
    canvas.updateStats();
  }
});

socket.on('draw', (operation) => {
  if (canvas) { // Ensure canvas is initialized
    canvas.operations.push(operation);
    canvas.drawOperation(operation);
    canvas.updateStats();
  }
});

socket.on('cursor', (data) => { // Event name 'cursor'
  updateCursor(data);
});

socket.on('redraw', (data) => {
  if (canvas) { // Ensure canvas is initialized
    canvas.operations = data.operations || [];
    canvas.redrawCanvas();
    canvas.updateStats();
  }
});

socket.on('clear', () => {
  if (canvas) { // Ensure canvas is initialized
    canvas.operations = [];
    canvas.redrawCanvas();
    canvas.updateStats();
  }
});

socket.on('users', (count) => {
  document.getElementById('user-count').textContent = count;
});

socket.on('userDisconnected', (userId) => {
  const cursorEl = cursors.get(userId);
  if (cursorEl) {
    cursorEl.remove();
    cursors.delete(userId);
  }
});

// Cursor management
function updateCursor(data) {
  const cursorId = data.userId;
  
  let cursorEl = cursors.get(cursorId);
  
  if (!cursorEl) {
    cursorEl = document.createElement('div');
    cursorEl.className = 'cursor';
    // Fixed template literal with backticks
    cursorEl.innerHTML = `<div class="cursor-pointer" style="background: ${data.userColor}"></div>
                          <div class="cursor-label" style="background: ${data.userColor}">
                            ${data.userId ? data.userId.slice(0, 8) : 'Guest'}
                          </div>`;
    cursorsLayer.appendChild(cursorEl);
    cursors.set(cursorId, cursorEl);
  }
  
  // Fixed template literals with backticks
  cursorEl.style.left = `${data.x}px`;
  cursorEl.style.top = `${data.y}px`;
  
  // Remove cursor after inactivity
  clearTimeout(cursorEl.timeout);
  cursorEl.timeout = setTimeout(() => {
    cursorEl.remove();
    cursors.delete(cursorId);
  }, 3000);
}

// UI Event Handlers
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (canvas) canvas.setTool(btn.dataset.tool); // Ensure canvas is initialized
  });
});

document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (canvas) canvas.setColor(btn.dataset.color); // Ensure canvas is initialized
  });
});

document.getElementById('color-picker').addEventListener('input', (e) => {
  if (canvas) canvas.setColor(e.target.value); // Ensure canvas is initialized
});

document.getElementById('line-width').addEventListener('input', (e) => {
  const width = e.target.value;
  if (canvas) canvas.setLineWidth(Number(width)); // Ensure canvas is initialized
  document.getElementById('line-width-value').textContent = width;
});

document.getElementById('undo-btn').addEventListener('click', () => {
  if (canvas) canvas.undo(); // Ensure canvas is initialized
});
document.getElementById('redo-btn').addEventListener('click', () => {
  if (canvas) canvas.redo(); // Ensure canvas is initialized
});

document.getElementById('clear-btn').addEventListener('click', () => {
  if (confirm('Clear the entire canvas? This will affect all users!')) {
    if (canvas) canvas.clear(); // Ensure canvas is initialized
  }
});

document.getElementById('download-btn').addEventListener('click', () => {
  if (canvas) canvas.download(); // Ensure canvas is initialized
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (!canvas) return; // Don't process shortcuts if canvas isn't ready

  // Undo: Ctrl+Z
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    canvas.undo(); // Fixed incomplete statement
  }
  // Redo: Ctrl+Y or Ctrl+Shift+Z
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    canvas.redo(); // Added redo shortcut
  }
  // Tool selection
  if (e.key === 'b' || e.key === 'B') {
    e.preventDefault();
    document.querySelector('.tool-btn[data-tool="brush"]').click();
  }
  if (e.key === 'e' || e.key === 'E') {
    e.preventDefault();
    document.querySelector('.tool-btn[data-tool="eraser"]').click();
  }
});
