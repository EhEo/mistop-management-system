module.exports = {
  apps: [{
    name: 'api',
    script: 'npx',
    args: 'tsx src/index.ts',
    cwd: '/var/www/api',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
}
