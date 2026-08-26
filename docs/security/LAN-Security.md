# MediDesk Zero-Trust LAN Security & Threat Model

## 1. Zero-Trust Security Model
MediDesk assumes that the local clinic network (Wi-Fi or Ethernet) may be accessible to patients, guests, or unauthorized devices. The network itself is considered untrusted.

## 2. Threat Analysis & Countermeasures (STRIDE)

| Threat | Description | MediDesk LAN Defense |
| :--- | :--- | :--- |
| **Spoofing** | Rogue machine pretending to be a Doctor PC. | Strict device registration with hardware fingerprint, 6-digit one-time PIN, and Owner approval. |
| **Tampering** | Altering prescriptions or billing requests in flight. | TLS payload encryption + HMAC-SHA256 request signatures with device tokens. |
| **Repudiation** | User denying an action performed over LAN. | Server-authoritative audit logging capturing `actor_id`, `device_id`, client IP, and action metadata. |
| **Information Disclosure** | Sniffing patient data or medical history on Wi-Fi. | End-to-end TLS encryption with pinned certificate fingerprints. Plaintext HTTP traffic is rejected. |
| **Denial of Service** | Flooding the LAN server with bogus requests. | IP-based rate limiting and max concurrent client socket caps. |
| **Elevation of Privilege** | Staff user attempting to access Owner backup or billing endpoints. | Server-side RBAC evaluation (`RBACEngine.assertPermission`) on every endpoint. |

## 3. Replay Protection Mechanism
Every API call requires:
1. `X-Request-Timestamp`: Must fall within $\pm 300\text{s}$ of the server clock.
2. `X-Request-Nonce`: Unique UUID tracked in the server's replay cache. Duplicate nonces within the window are rejected with `403 Forbidden`.
3. `X-Device-Signature`: HMAC-SHA256 signature calculated over `deviceId + payload + timestamp + nonce`.
