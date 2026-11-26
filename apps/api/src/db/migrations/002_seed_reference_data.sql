-- ==============================================================================
-- 002_seed_reference_data.sql
-- Idempotent seed for Roles, Permissions, Initial Categories & Product Types
-- ==============================================================================

-- Roles
INSERT INTO roles (slug, name, description, is_system) VALUES
  ('super_admin', 'Super Admin', 'Full system access including administrator and role management', TRUE),
  ('admin', 'Admin', 'Manage products, categories, product types, media, and publishing', TRUE),
  ('content_manager', 'Content Manager', 'Create/edit drafts, manage features, use cases, and media', TRUE),
  ('viewer', 'Viewer', 'Strictly read-only access to administrative views', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Permissions
INSERT INTO permissions (key, module, description) VALUES
  ('dashboard:read', 'dashboard', 'View admin dashboard metrics'),
  ('products:read', 'products', 'View draft and published products in admin'),
  ('products:create', 'products', 'Create new draft products'),
  ('products:update', 'products', 'Edit product information, features, use cases, and sections'),
  ('products:delete', 'products', 'Delete products'),
  ('products:publish', 'products', 'Publish and unpublish products'),
  ('products:preview', 'products', 'Authorize and view secure draft previews'),
  ('media:upload', 'media', 'Upload and update screenshots and demo videos'),
  ('media:delete', 'media', 'Delete screenshots and demo videos'),
  ('categories:read', 'categories', 'View categories'),
  ('categories:manage', 'categories', 'Create, edit, reorder, and delete categories'),
  ('product_types:read', 'product_types', 'View product types'),
  ('product_types:manage', 'product_types', 'Create, edit, reorder, and deactivate product types'),
  ('users:read', 'users', 'View administrator accounts'),
  ('users:manage', 'users', 'Create, edit, deactivate, and reset administrator accounts'),
  ('roles:manage', 'roles', 'Assign roles and manage permission overrides'),
  ('logs:read', 'logs', 'View activity and audit logs')
ON CONFLICT (key) DO NOTHING;

-- Super Admin: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'super_admin'
ON CONFLICT DO NOTHING;

-- Admin: everything except user & role management
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'dashboard:read',
  'products:read',
  'products:create',
  'products:update',
  'products:delete',
  'products:publish',
  'products:preview',
  'media:upload',
  'media:delete',
  'categories:read',
  'categories:manage',
  'product_types:read',
  'product_types:manage',
  'logs:read'
)
WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

-- Content Manager: product content & media (publishing controlled per user/role config)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'dashboard:read',
  'products:read',
  'products:create',
  'products:update',
  'products:preview',
  'media:upload',
  'media:delete',
  'categories:read',
  'product_types:read',
  'logs:read'
)
WHERE r.slug = 'content_manager'
ON CONFLICT DO NOTHING;

-- Viewer: strictly read-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'dashboard:read',
  'products:read',
  'categories:read',
  'product_types:read',
  'logs:read'
)
WHERE r.slug = 'viewer'
ON CONFLICT DO NOTHING;

-- Initial Categories (dynamically manageable in Admin)
INSERT INTO categories (name, slug, description, display_order) VALUES
  ('Network & Roaming Solutions', 'network-roaming-solutions', 'Core roaming orchestration, signaling, steering, and inter-operator network platforms.', 1),
  ('Voice & Messaging Solutions', 'voice-messaging-solutions', 'Voice policy control, branded calling, fraud prevention, and messaging intelligence.', 2),
  ('Commercial Analytics', 'commercial-analytics', 'Wholesale commercial intelligence, margin optimization, and traffic analytics.', 3),
  ('Operator Intelligence', 'operator-intelligence', 'Competitive benchmarking, operator profiling, and market intelligence portals.', 4),
  ('Enterprise Solutions', 'enterprise-solutions', 'Enterprise portals, lifecycle workflows, and B2B operational tooling.', 5),
  ('AI-Powered Solutions', 'ai-powered-solutions', 'Machine learning, anomaly detection, and AI-driven telecom automation.', 6)
ON CONFLICT (slug) DO NOTHING;

-- Initial Product Types (dynamically manageable in Admin)
INSERT INTO product_types (name, slug, description, display_order) VALUES
  ('Web Applications', 'web-applications', 'Interactive browser-based enterprise web applications.', 1),
  ('Enterprise Portals', 'enterprise-portals', 'Multi-tenant or internal executive and operational portals.', 2),
  ('SaaS Platforms', 'saas-platforms', 'Cloud-ready software-as-a-service platforms.', 3),
  ('Mobile Applications', 'mobile-applications', 'Native or cross-platform mobile experiences.', 4),
  ('AI-Powered Solutions', 'ai-powered-solutions', 'Intelligent automation and predictive ML platforms.', 5),
  ('Data Analytics Platforms', 'data-analytics-platforms', 'Large-scale telemetry, BI, and commercial analytics platforms.', 6),
  ('APIs and Integrations', 'apis-and-integrations', 'Programmable APIs, gateways, and enterprise connectors.', 7),
  ('Telecom Solutions', 'telecom-solutions', 'Carrier-grade network, roaming, and signaling solutions.', 8),
  ('Internal Tools', 'internal-tools', 'Specialized internal productivity and operations software.', 9),
  ('Other', 'other', 'Additional Mobileum technology offerings and solutions.', 10)
ON CONFLICT (slug) DO NOTHING;
