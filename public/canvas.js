class CollaborativeCanvas {
  constructor(canvasId, socket) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.socket = socket;
    
    // State
    this.isDrawing = false;
    this.tool = 'brush';
    this.color = '#000000';
    this.lineWidth = 3;
    this.currentPath = [];
    this.operations = [];
    this.redoStack = [];
    this.operationId = 0;
    
    // Performance
    this.lastPoint = null;
    this.frameCount = 0;
    this.lastFpsUpdate = Date.now();
    
    this.init();
  }

  init() {
    // Setup canvas size
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // Fill white background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Start FPS counter
    this.startFpsCounter();
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    
    // Redraw after resize
    this.redrawCanvas();
  }

  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
    this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
    
    // Touch events for mobile
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.handleMouseDown(touch);
    });
    
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.handleMouseMove(touch);
    });
    
    this.canvas.addEventListener('touchend', () => this.handleMouseUp());
  }

  getCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  handleMouseDown(e) {
    this.isDrawing = true;
    const coords = this.getCoords(e);
    this.currentPath = [coords];
    this.lastPoint = coords;
  }

  handleMouseMove(e) {
    const coords = this.getCoords(e);
    
    // Send cursor position
    this.socket.emit('cursor', coords); // Event name 'cursor'
    
    if (!this.isDrawing) return;
    
    this.currentPath.push(coords);
    
    // Draw locally
    if (this.currentPath.length > 1) {
      this.drawSegment(
        this.currentPath[this.currentPath.length - 2],
        this.currentPath[this.currentPath.length - 1]
      );
    }
    
    this.lastPoint = coords;
    this.frameCount++;
  }

  handleMouseUp() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    
    if (this.currentPath.length > 0) {
      const operation = {
        tool: this.tool,
        color: this.color,
        lineWidth: this.lineWidth,
        points: this.currentPath,
        id: `op_${this.operationId++}_${Date.now()}`
      };
      
      this.socket.emit('draw', operation); // Event name 'draw'
      this.operations.push(operation);
      this.redoStack = [];
      
      this.updateStats();
    }
    
    this.currentPath = [];
  }

  drawSegment(p1, p2) {
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    if (this.tool === 'brush') {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = this.color;
    } else if (this.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    }
    
    this.ctx.lineWidth = this.lineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.stroke();
  }

  drawOperation(operation) {
    if (!operation.points || operation.points.length < 2) return;
    
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    if (operation.tool === 'brush') {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = operation.color;
    } else if (operation.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    }
    
    this.ctx.lineWidth = operation.lineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(operation.points[0].x, operation.points[0].y);
    
    // Draw smooth curve
    for (let i = 1; i < operation.points.length - 1; i++) {
      const xc = (operation.points[i].x + operation.points[i + 1].x) / 2;
      const yc = (operation.points[i].y + operation.points[i + 1].y) / 2;
      this.ctx.quadraticCurveTo(operation.points[i].x, operation.points[i].y, xc, yc);
    }
    
    const last = operation.points[operation.points.length - 1];
    this.ctx.lineTo(last.x, last.y);
    this.ctx.stroke();
  }

  redrawCanvas() {
    // Clear canvas
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Redraw all operations
    this.operations.forEach(op => this.drawOperation(op));
  }

  undo() {
    if (this.operations.length === 0) return;
    
    const lastOp = this.operations.pop();
    this.redoStack.push(lastOp);
    
    this.socket.emit('undo', { operationId: lastOp.id });
    this.redrawCanvas();
    this.updateStats();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    
    const op = this.redoStack.pop();
    this.operations.push(op);
    
    this.socket.emit('draw', op); // Re-emit to server for others to see redo
    this.drawOperation(op);
    this.updateStats();
  }

  clear() {
    this.operations = [];
    this.redoStack = [];
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.socket.emit('clear');
    this.updateStats();
  }

  download() {
    const link = document.createElement('a');
    link.download = `canvas_${Date.now()}.png`; // Fixed template literal
    link.href = this.canvas.toDataURL();
    link.click();
  }

  setTool(tool) {
    this.tool = tool;
  }

  setColor(color) {
    this.color = color;
  }

  setLineWidth(width) {
    this.lineWidth = width;
  }

  startFpsCounter() {
    setInterval(() => {
      const now = Date.now();
      const elapsed = now - this.lastFpsUpdate;
      const fps = Math.round((this.frameCount * 1000) / elapsed);
      
      document.getElementById('fps').textContent = fps;
      
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }, 1000);
  }

  updateStats() {
    document.getElementById('ops').textContent = this.operations.length;
    document.getElementById('operation-count').textContent = this.operations.length;
  }
}
