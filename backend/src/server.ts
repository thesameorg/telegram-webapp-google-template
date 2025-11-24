// Load environment variables BEFORE any other imports
import './load-env';

import app from './app';

const port = parseInt(process.env.PORT || '8080');

app.listen(port, '0.0.0.0', () => {
  console.log('🚀 Server started successfully!');
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Port: ${port}`);
  console.log(`🔗 Health check: http://localhost:${port}/health`);

  if (process.env.NODE_ENV === 'production') {
    console.log('📦 Serving static files from /public');
  } else {
    console.log('⚡ Development mode - frontend served separately');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
