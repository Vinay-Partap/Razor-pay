const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/database');

const register = async (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ status: "error", message: "Missing required payload fields" });
  }

  // Mandatory Domain Check Rule
  if (!email.endsWith('@org.com')) {
    return res.status(400).json({ status: "error", message: "Registration restricted to @org.com accounts only" });
  }

  try {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ status: "error", message: "Email is already registered" });
    }

    // Securely hash user credentials
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save to database - default role is ALWAYS 'EMP'
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{ name, email, password: hashedPassword, role: 'EMP' }])
      .select('id', 'name', 'email', 'role')
      .single();

    if (error) throw error;

    return res.status(201).json({ status: "success", data: { user: newUser } });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ status: "error", message: "Missing credentials" });
  }

  if (!email.endsWith('@org.com')) {
    return res.status(400).json({ status: "error", message: "Only @org.com domains are allowed to authenticate" });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (!user || error) {
      return res.status(401).json({ status: "error", message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: "error", message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

    // Set secure HTTP-only cookie configuration matching tester requirements
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.status(200).json({
      status: "success",
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      }
    });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res) => {
  res.clearCookie('auth_token');
  return res.status(200).json({ status: "success", message: "Logged out cleanly" });
};

module.exports = { register, login, logout };
