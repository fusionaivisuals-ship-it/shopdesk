-- G15 Least privilege: the website connects as shopdesk_app, which can do ONLY what the code does.
-- Even if the server were fully taken over, this user can't delete anything, can't change orders,
-- customers or policies, and can't drop or alter tables.
-- Step 1 (Niel, Neon console): Roles -> New role "shopdesk_app". Copy its connection string
--   straight into Vercel as SHOPDESK_DATABASE_URL. The password never goes into chat or the repo.
-- Step 2 (this file): run once by the owner.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM shopdesk_app;
REVOKE CREATE ON SCHEMA public FROM shopdesk_app;
GRANT USAGE ON SCHEMA public TO shopdesk_app;
-- Shop data: read only.
GRANT SELECT ON orders, customers, policies TO shopdesk_app;
-- Counters and usage: read, add, update (upserts). Never delete.
GRANT SELECT, INSERT, UPDATE ON attempt_counters, conversations, spend_ledger, visitor_usage, rate_hits TO shopdesk_app;
-- History, tickets, staff log: append and read only.
GRANT SELECT, INSERT ON messages, tickets, staff_log TO shopdesk_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO shopdesk_app;
