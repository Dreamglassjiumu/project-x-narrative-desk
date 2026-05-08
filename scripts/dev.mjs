import { spawn } from 'node:child_process';

const commands = [
  ['server', 'npm', ['run', 'dev:server']],
  ['client', 'npm', ['run', 'dev:client']],
];

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  child.on('exit', (code, signal) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      process.exitCode = code;
      shutdown('SIGTERM');
    }
    if (signal) {
      console.error(`[${name}] exited with signal ${signal}`);
    }
  });
  return child;
});

const shutdown = (signal) => {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
