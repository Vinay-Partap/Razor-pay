const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/authorize');
const {
  createReimbursement,
  updateReimbursementStatus,
  getReimbursementsPipeline,
  getSubordinateReimbursements
} = require('../controllers/reimbursement');

// Main operational endpoints
router.post('/reimbursements', authenticateToken, authorizeRoles('EMP'), createReimbursement);
router.patch('/reimbursements', authenticateToken, authorizeRoles('RM', 'APE', 'CFO'), updateReimbursementStatus);
router.get('/reimbursements', authenticateToken, getReimbursementsPipeline);

// Parameterized subordinate lookup route
router.get('/reimbursements/:userId', authenticateToken, authorizeRoles('RM'), getSubordinateReimbursements);

module.exports = router;
