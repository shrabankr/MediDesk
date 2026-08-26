-- Migration 007: LAN / Multi-Computer Devices & Server Configuration

-- 1. Registered LAN Client Devices
CREATE TABLE IF NOT EXISTS lan_devices (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    device_role TEXT NOT NULL DEFAULT 'GENERAL_CLIENT',
    ip_address TEXT,
    mac_address TEXT,
    public_key TEXT,
    device_token_enc TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    last_seen_at DATETIME,
    approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    approved_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_lan_devices_org_status ON lan_devices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_lan_devices_fingerprint ON lan_devices(device_fingerprint);

-- 2. Temporary Pairing PINs
CREATE TABLE IF NOT EXISTS lan_pairing_pins (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    pin_code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    is_used INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lan_pairing_pins_lookup ON lan_pairing_pins(organization_id, pin_code, is_used);

-- 3. LAN Server Configuration
CREATE TABLE IF NOT EXISTS lan_server_config (
    organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    operating_mode TEXT NOT NULL DEFAULT 'SINGLE_PC',
    server_port INTEGER NOT NULL DEFAULT 4848,
    server_hostname TEXT,
    tls_certificate TEXT,
    tls_private_key_enc TEXT,
    server_fingerprint TEXT,
    max_clients INTEGER NOT NULL DEFAULT 10,
    auto_discovery_enabled INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
