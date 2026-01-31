// Pure JavaScript test function
module.exports = (req, res) => {
  res.setHeader(
    'Access-Control-Allow-Origin',
    'https://mf-frontend-coral.vercel.app'
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.status(200).json({
    message: 'Pure JS function working!',
    timestamp: new Date().toISOString(),
    env: {
      hasDB: !!process.env.DATABASE_URL,
      hasJWT: !!process.env.JWT_SECRET,
    },
  });
};
