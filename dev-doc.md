## 🧪 Local Build & Run – Development Docker Image Tester

To quickly build and run the app locally with feature flags like `DISABLE_LOGO`, use the `runLocalDockerBuildTester.sh` script.

---

### ▶️ Usage

```bash
./runLocalDockerBuildTester.sh
```

By default, this builds and runs:

* Docker image: `karimz1/imgcompress:local-test`
* App: `http://localhost:3001`
* Env var: `DISABLE_LOGO=false` (✅ logo is **shown**)

---

### 🔁 Optional: Override `DISABLE_LOGO`

To **disable** the logo at runtime:

```bash
DISABLE_LOGO=true ./runLocalDockerBuildTester.sh
```

---

### 🧹 Notes

* The container is automatically removed after it stops (`--rm`)
* Ideal for quickly testing different UI states or environment configurations