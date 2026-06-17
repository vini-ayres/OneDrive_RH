module.exports = {
  apps: [
    {
      name: 'webapp',
      script: 'npx',
      args: 'vite --port 3000 --host 0.0.0.0',
      env: {
        NODE_ENV: 'development',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    }
  ]
}
