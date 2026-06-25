-- Vendor menu requests: customers ask vendors to fill real menus (no fake defaults)

CREATE TABLE IF NOT EXISTS vendor_menu_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    text NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id  uuid REFERENCES auth.users(id),
  status       text NOT NULL DEFAULT 'pending',
  notes        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_menu_requests_vendor_idx
  ON vendor_menu_requests(vendor_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS vendor_menu_requests_customer_idx
  ON vendor_menu_requests(customer_id, created_at DESC);

ALTER TABLE vendor_menu_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer insert menu request" ON vendor_menu_requests;
CREATE POLICY "Customer insert menu request" ON vendor_menu_requests
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customer read own menu requests" ON vendor_menu_requests;
CREATE POLICY "Customer read own menu requests" ON vendor_menu_requests
  FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Vendor owner read menu requests" ON vendor_menu_requests;
CREATE POLICY "Vendor owner read menu requests" ON vendor_menu_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Vendor owner update menu requests" ON vendor_menu_requests;
CREATE POLICY "Vendor owner update menu requests" ON vendor_menu_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service all menu requests" ON vendor_menu_requests;
CREATE POLICY "Service all menu requests" ON vendor_menu_requests
  FOR ALL USING (auth.role() = 'service_role');