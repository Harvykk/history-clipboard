// 启动脚本 — 清除 ELECTRON_RUN_AS_NODE 后启动 Electron
delete process.env.ELECTRON_RUN_AS_NODE;

const { spawn } = require('child_process');
const path = require('path');

const electronPath = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
const child = spawn(electronPath, ['.'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: process.env,
});

child.on('close', (code) => process.exit(code));
