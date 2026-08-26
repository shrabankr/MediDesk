# MediDesk LAN Setup & Workstation Deployment Guide

## 1. Server PC Setup
1. Launch MediDesk on the primary clinic PC (e.g. Owner PC).
2. Open **Settings** $\rightarrow$ Navigate to **LAN & Multi-PC** tab.
3. Select **MediDesk LAN Server** operating mode.
4. Click **Start LAN Server**.
5. Note the listening port (default `4848`) and local IP address (e.g. `192.168.1.100`).

## 2. Client Workstation Pairing
1. Install and launch MediDesk on the secondary workstation (Doctor PC or Pharmacy POS PC).
2. Open **Settings** $\rightarrow$ **LAN & Multi-PC** tab $\rightarrow$ Select **LAN Workstation Client**.
3. On the **Server PC**, click **Generate 6-Digit Pairing PIN** (e.g. `489 123`).
4. On the **Client PC**:
   - Enter Server URL: `http://192.168.1.100:4848`
   - Enter 6-digit PIN: `489123`
   - Enter Workstation Name: `Doctor Consultation Room 1`
   - Select Role: `Doctor Workstation`
   - Click **Register Device with Server**.
5. On the **Server PC**:
   - In the Registered LAN Workstations table, find the pending device and click **[Approve]**.
6. The Client PC will automatically complete pairing and present the user login screen.

## 3. Revoking Workstations
- To disconnect a lost, decommissioned, or unauthorized workstation, the Owner clicks **[Revoke]** next to the device on the Server PC. Communication is terminated immediately.
