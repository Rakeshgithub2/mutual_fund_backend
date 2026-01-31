// Minimal test endpoint for Vercel debugging
export default function handler(req: any, res: any) {
  try {
    // Set CORS headers dynamically
    const allowedOrigins = [
      'https://mf-frontend-coral.vercel.app',
      'https://mutual-fun-frontend-osed.vercel.app',
      'http://localhost:3000',
      'http://localhost:5001',
      'http://localhost:3001',
    ];

    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    res.status(200).json({
      message: 'Minimal test working!',
      timestamp: new Date().toISOString(),
      env: {
        hasDatabase: !!process.env.DATABASE_URL,
        hasJWT: !!process.env.JWT_SECRET,
        nodeEnv: process.env.NODE_ENV,
        isVercel: !!process.env.VERCEL,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal error',
      message: error.message,
      stack: error.stack,
    });
  }
}
