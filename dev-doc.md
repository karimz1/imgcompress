## 🧪 Local Build & Run – Development Tester

To quickly build and run the app locally with feature flags like `DISABLE_LOGO`, use the `localbuildtester.sh` script.

---

### ▶️ Usage

```bash
./localbuildtester.sh
```

By default, this builds and runs:

* Docker image: `karimz1/imgcompress:local-test`
* App: `http://localhost:3001`
* Env var: `DISABLE_LOGO=false` (✅ logo is **shown**)

---

### 🔁 Optional: Override `DISABLE_LOGO`

To **disable** the logo at runtime:

```bash
DISABLE_LOGO=true ./localbuildtester.sh
```

---

### 🧹 Notes

* The container is automatically removed after it stops (`--rm`)
* Ideal for quickly testing different UI states or environment configurations
* You can modify the script to add other flags like `MOCK=true` or custom ports if needed
