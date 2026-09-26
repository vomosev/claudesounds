module.exports = {
  apps: [
    {
      name: 'claudesounds',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/home/arx-app/backends/claudesounds',
      env: {
        NODE_ENV: 'production',
        PORT: 4107
      }
    }
  ]
};