const jwt = require('jsonwebtoken');
const supabase = require('../config/database');

const authenticateToken = async (req, res, next) => {
  // Read the token directly from the auto-tagged cookies
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ status: "error", message: "Authentication token missing" });
  }

  try {
    // Verify token integrity
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch the user from the Supabase users table to get their absolute latest role status
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ status: "error", message: "User session invalid or unauthorized" });
    }

    // Attach user record context seamlessly to the request scope
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ status: "error", message: "Token has expired or is invalid" });
  }
};

module.exports = authenticateToken;
