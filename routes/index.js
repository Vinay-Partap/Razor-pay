const express = require('express');
const router = express.Router();
const onboardingRoutes = require('./onboarding');

router.use('/onboardings', onboardingRoutes);

module.exports = router;
