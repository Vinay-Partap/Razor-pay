const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/authorize');
const { 
  assignRole, 
  assignManager, 
  removeManagerAssignment, 
  getEmployeesDirectory 
} = require('../controllers/employee');

// CFO Specific Operational Control Planes
router.post('/roles/assign', authenticateToken, authorizeRoles('CFO'), assignRole);
router.post('/employees/assign', authenticateToken, authorizeRoles('CFO'), assignManager);
router.delete('/employees/assign', authenticateToken, authorizeRoles('CFO'), removeManagerAssignment);

// Directory Access Matrix
router.get('/employees', authenticateToken, authorizeRoles('RM', 'APE', 'CFO'), getEmployeesDirectory);

module.exports = router;
