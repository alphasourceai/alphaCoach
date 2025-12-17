const express = require('express');
const { supabaseAdmin } = require('../src/lib/supabaseClient');
const { requireAuth, withClientScope } = require('../src/middleware/auth');

const router = express.Router();

router.get('/my', requireAuth, withClientScope, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { data, error } = await supabaseAdmin
      .from('client_members')
      .select('client_id, role, clients ( id, name )')
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({
        error: 'membership_lookup_failed',
        detail: error.message,
        code: error.code,
        hint: error.hint,
        request_id: req.request_id,
      });
    }

    const items =
      data?.map((row) => ({
        client_id: row.client_id,
        role: row.role || 'member',
        name: row.clients?.name || null,
      })) || [];

    return res.json({ items, request_id: req.request_id });
  } catch (e) {
    return res.status(500).json({
      error: 'membership_lookup_failed',
      detail: e?.message || 'Unexpected error',
      request_id: req.request_id,
    });
  }
});

module.exports = router;
