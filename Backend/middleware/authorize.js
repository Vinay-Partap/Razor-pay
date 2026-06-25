const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ status: "error", message: "Unauthenticated" });
      }
  
      // Enforce matching role metrics strictly against allowed parameters
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ status: "error", message: "Forbidden: Access denied for your role" });
      }
  
      next();
    };
  };
  
  module.exports = authorizeRoles;
  