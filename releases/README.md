# SourceHub Debian (.deb) Releases

Pre-built binary packages for Debian, Ubuntu, Linux Mint, and derivative Linux distributions (x86_64 / amd64).

---

## Latest Release: v0.1.3

- **Package**: [`sourcehub_0.1.3_amd64.deb`](./sourcehub_0.1.3_amd64.deb)
- **SHA-256**: [`sourcehub_0.1.3_amd64.deb.sha256`](./sourcehub_0.1.3_amd64.deb.sha256)
- **SHA-256 hex**: `9cdc7f00cbefd1569078a093d9117c77b9b9fabfa53f7d1acf8c0932e7b8dce6`
- **Target Node.js**: Node.js >= 22.0.0 (required for built-in `node:sqlite`)
- **Target Git**: Git >= 2.30.0
- **Notes**: Auth hardening release — enforces optional `SOURCEHUB_TOKEN` / hashed PATs; Style D UI; Maintainer field is `SourceHub contributors` (no personal email).

---

## Quick Install

### 1. Verify Checksum
```bash
sha256sum -c sourcehub_0.1.3_amd64.deb.sha256
# Should output: sourcehub_0.1.3_amd64.deb: OK
```

### 2. Install Package
```bash
sudo apt install ./sourcehub_0.1.3_amd64.deb
# or
sudo dpkg -i sourcehub_0.1.3_amd64.deb

# If any dependencies are missing:
sudo apt-get install -f
```

### 3. Launch
- Launch **SourceHub** from your application menu, or run in terminal:
```bash
sourcehub launch
```

### 4. Optional: Run as Systemd Service on Boot
```bash
systemctl --user enable --now sourcehub.service
```
