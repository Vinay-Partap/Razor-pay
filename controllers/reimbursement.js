const supabase = require('../config/database');

// Helper to determine the final evaluated status based on separate approval gates
const computeFinalStatus = (rmApproval, apeApproval) => {
  if (rmApproval === 'REJECTED' || apeApproval === 'REJECTED') return 'REJECTED';
  if (rmApproval === 'APPROVED' && apeApproval === 'APPROVED') return 'APPROVED';
  return 'PENDING';
};

// 1. Raise a New Reimbursement Voucher (EMP Only)
const createReimbursement = async (req, res, next) => {
  const { title, description, amount } = req.body;

  if (!title || !description || !amount) {
    return res.status(400).json({ status: "error", message: "Missing required payload parameters" });
  }

  try {
    const { data, error } = await supabase
      .from('reimbursements')
      .insert([{
        employee_id: req.user.id,
        title,
        description,
        amount: parseInt(amount, 10)
      }])
      .select('*')
      .single();

    if (error) throw error;

    return res.status(201).json({
      status: "success",
      data: {
        reimbursement: {
          id: data.id,
          title: data.title,
          description: data.description,
          amount: data.amount,
          status: 'PENDING' // Newly raised claims are always PENDING [cite: 154]
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// 2. Process Managerial State Transitions (RM, APE, CFO Only)
const updateReimbursementStatus = async (req, res, next) => {
  const { reimbursementId, status } = req.body;
  const userRole = req.user.role;
  const userId = req.user.id;

  if (!reimbursementId || !status) {
    return res.status(400).json({ status: "error", message: "Missing voucher targets or transition parameters" });
  }

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ status: "error", message: "Invalid approval transition value" });
  }

  try {
    // Fetch the target reimbursement claim first
    const { data: claim, error: fetchError } = await supabase
      .from('reimbursements')
      .select('*')
      .eq('id', reimbursementId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!claim) {
      return res.status(404).json({ status: "error", message: "Target reimbursement claim not found" });
    }

    let updatePayload = {};

    if (userRole === 'RM') {
      // Security Validation: Verify the employee reports directly to this RM
      const { data: relationship } = await supabase
        .from('employee_managers')
        .select('*')
        .eq('employee_id', claim.employee_id)
        .eq('manager_id', userId)
        .maybeSingle();

      if (!relationship) {
        return res.status(403).json({ status: "error", message: "Forbidden: Employee is not your direct subordinate" });
      }
      updatePayload = { rm_approval: status };
    } 
    else if (userRole === 'APE') {
      updatePayload = { ape_approval: status };
    } 
    else if (userRole === 'CFO') {
      // CFO can override or bypass specific constraints directly [cite: 160]
      updatePayload = { rm_approval: status, ape_approval: status };
    }

    const { data: updatedClaim, error: updateError } = await supabase
      .from('reimbursements')
      .update(updatePayload)
      .eq('id', reimbursementId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({
      status: "success",
      data: {
        reimbursement: {
          id: updatedClaim.id,
          title: updatedClaim.title,
          status: computeFinalStatus(updatedClaim.rm_approval, updatedClaim.ape_approval)
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// 3. Centralized Pipeline Visibility List Engine
const getReimbursementsPipeline = async (req, res, next) => {
  const userRole = req.user.role;
  const userId = req.user.id;

  try {
    let claims = [];

    if (userRole === 'EMP') {
      // EMP lists their own reimbursements [cite: 170]
      const { data, error } = await supabase
        .from('reimbursements')
        .select('*')
        .eq('employee_id', userId);
      
      if (error) throw error;
      claims = data;
    } 
    else if (userRole === 'RM') {
      // RM sees claims pending their approval from their direct employees [cite: 172]
      const { data: relations } = await supabase
        .from('employee_managers')
        .select('employee_id')
        .eq('manager_id', userId);

      const subIds = relations.map(r => r.employee_id);

      const { data, error } = await supabase
        .from('reimbursements')
        .select('*')
        .in('employee_id', subIds)
        .eq('rm_approval', 'PENDING');

      if (error) throw error;
      claims = data;
    } 
    else if (userRole === 'APE') {
      // APE sees claims pending at their level but already approved by an RM [cite: 173]
      const { data, error } = await supabase
        .from('reimbursements')
        .select('*')
        .eq('rm_approval', 'APPROVED')
        .eq('ape_approval', 'PENDING');

      if (error) throw error;
      claims = data;
    } 
    else if (userRole === 'CFO') {
      // CFO reviews all claims that have passed APE signoff [cite: 175]
      const { data, error } = await supabase
        .from('reimbursements')
        .select('*')
        .eq('ape_approval', 'APPROVED');

      if (error) throw error;
      claims = data;
    }

    // Format the response structure cleanly to match tester layouts [cite: 177, 181]
    const formattedReimbursements = claims.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      amount: c.amount,
      status: computeFinalStatus(c.rm_approval, c.ape_approval)
    }));

    return res.status(200).json({
      status: "success",
      data: { reimbursements: formattedReimbursements }
    });
  } catch (err) {
    next(err);
  }
};

// 4. Specific Target Subordinate Query Lookup
const getSubordinateReimbursements = async (req, res, next) => {
  const targetEmployeeId = req.params.userId;
  const currentUserId = req.user.id;

  try {
    // Security Access Validation Check: Verify the relationship exists [cite: 191]
    const { data: relationship, error: relError } = await supabase
      .from('employee_managers')
      .select('*')
      .eq('employee_id', targetEmployeeId)
      .eq('manager_id', currentUserId)
      .maybeSingle();

    if (relError) throw relError;
    if (!relationship) {
      return res.status(403).json({ status: "error", message: "Forbidden: Target user is not your direct subordinate" });
    }

    const { data: claims, error } = await supabase
      .from('reimbursements')
      .select('*')
      .eq('employee_id', targetEmployeeId);

    if (error) throw error;

    const formattedReimbursements = claims.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      amount: c.amount,
      status: computeFinalStatus(c.rm_approval, c.ape_approval)
    }));

    return res.status(200).json({
      status: "success",
      data: { reimbursements: formattedReimbursements }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createReimbursement,
  updateReimbursementStatus,
  getReimbursementsPipeline,
  getSubordinateReimbursements
};
