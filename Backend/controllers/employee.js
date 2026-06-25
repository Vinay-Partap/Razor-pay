const supabase = require('../config/database');

// 1. Assign Role (CFO Only)
const assignRole = async (req, res, next) => {
  const { userId, role } = req.body;

  if (!userId || !role) {
    return res.status(400).json({ status: "error", message: "Missing userId or role in payload" });
  }

  // Validate allowed roles explicitly
  const allowedRoles = ['EMP', 'RM', 'APE', 'CFO'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ status: "error", message: "Invalid role target string specified" });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', userId)
      .select('id', 'name', 'email', 'role')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ status: "error", message: "Target user not found" });
    }

    return res.status(200).json({ status: "success", data: { user: data } });
  } catch (err) {
    next(err);
  }
};

// 2. Link Employee to Manager (CFO Only)
const assignManager = async (req, res, next) => {
  const { userId, managerId } = req.body; // userId = EMP, managerId = RM

  if (!userId || !managerId) {
    return res.status(400).json({ status: "error", message: "Missing fields" });
  }

  try {
    // Upsert logic: guarantees an employee reports to exactly one RM (1:M)
    const { error } = await supabase
      .from('employee_managers')
      .upsert({ employee_id: userId, manager_id: managerId }, { onConflict: 'employee_id' });

    if (error) throw error;

    return res.status(200).json({ status: "success", message: "Reporting manager mapped successfully" });
  } catch (err) {
    next(err);
  }
};

// 3. Remove Employee-Manager Assignment (CFO Only)
const removeManagerAssignment = async (req, res, next) => {
  const { userId, managerId } = req.body;

  if (!userId || !managerId) {
    return res.status(400).json({ status: "error", message: "Missing fields" });
  }

  try {
    const { error } = await supabase
      .from('employee_managers')
      .delete()
      .eq('employee_id', userId)
      .eq('manager_id', managerId);

    if (error) throw error;

    return res.status(200).json({ status: "success", message: "Assignment severed cleanly" });
  } catch (err) {
    next(err);
  }
};

// 4. Directory Access Visibility Engine
const getEmployeesDirectory = async (req, res, next) => {
  const userRole = req.user.role;
  const userId = req.user.id;

  try {
    let query = supabase.from('users').select('id, name, email, role');

    if (userRole === 'RM') {
      // RM sees only EMPs that report directly to them
      const { data: subordinates, error: subError } = await supabase
        .from('employee_managers')
        .select('employee_id')
        .eq('manager_id', userId);

      if (subError) throw subError;
      const empIds = subordinates.map(s => s.employee_id);

      query = query.in('id', empIds);
    } else if (userRole === 'APE') {
      // APE lists all EMPs and RMs
      query = query.in('role', ['EMP', 'RM']);
    } else if (userRole === 'CFO') {
      // CFO lists everyone unconditionally; no extra filter applied
    }

    const { data: users, error } = await query;
    if (error) throw error;

    return res.status(200).json({ status: "success", data: { users } });
  } catch (err) {
    next(err);
  }
};

module.exports = { assignRole, assignManager, removeManagerAssignment, getEmployeesDirectory };
