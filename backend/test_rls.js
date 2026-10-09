const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/arind/Desktop/HarvestHub/backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testInsertOrderItem() {
  console.log("Signing in buyer...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'buyer@harvesthub.lk',
    password: 'Buyer@123456',
  });

  if (authError) {
    console.error("Auth error:", authError.message);
    return;
  }

  const token = authData.session.access_token;
  console.log("User id:", authData.user.id);

  // Scoped user client
  const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  // Try creating purchase order
  const { data: buyerRecord } = await userClient.from('buyers').select('id').eq('profile_id', authData.user.id).single();
  console.log("Buyer record id:", buyerRecord?.id);

  const { data: order, error: orderErr } = await userClient.from('purchase_orders').insert({
    buyer_id: buyerRecord?.id,
    order_no: `PO-TEST-${Date.now()}`,
    status: 'submitted',
    created_by: authData.user.id
  }).select().single();

  console.log("Purchase Order created:", order, "Error:", orderErr);

  if (order) {
    // Try inserting purchase order item
    const { data: item, error: itemErr } = await userClient.from('purchase_order_items').insert({
      order_id: order.id,
      category_id: 'cc000001-0000-0000-0000-000000000001',
      requested_qty_kg: 20,
    }).select();

    console.log("Purchase Order Item created:", item, "Error:", itemErr);
  }
}

testInsertOrderItem();
