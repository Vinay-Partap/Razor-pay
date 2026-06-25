const express = require('express');
const router = express.Router();
const onboardingRoutes = require('./onboarding');
const employeeRoutes = require('./employee');
const reimbursementRoutes = require('./reimbursement');

router.use('/onboardings', onboardingRoutes);
router.use('/', employeeRoutes);
router.use('/', reimbursementRoutes); // Mounts the reimbursement pipelines cleanly under the global /rest/ prefix

module.exports = router;