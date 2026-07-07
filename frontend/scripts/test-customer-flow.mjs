/**
 * End-to-end smoke test: login → create customer → record sale → verify.
 * Usage: node scripts/test-customer-flow.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const BASE = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const EMAIL = env.ADMIN_EMAIL ?? "admin@noor.om";
const PASSWORD = env.ADMIN_PASSWORD ?? "Password123!";

const results = [];
const pass = (name, detail = "") => results.push({ name, ok: true, detail });
const fail = (name, detail = "") => results.push({ name, ok: false, detail });

async function api(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  console.log(`Testing against ${BASE}\n`);

  const login = await api("/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  if (!login.json.success) {
    fail("Login", login.json.error?.message ?? `HTTP ${login.status}`);
    printResults();
    process.exit(1);
  }
  pass("Login", `as ${EMAIL}`);
  const token = login.json.data.accessToken;

  const me = await api("/auth/me", { token });
  let companyId = me.json.data?.companyId;
  if (!companyId) {
    const companies = await api("/companies?page=1&limit=1", { token });
    companyId = companies.json.data?.[0]?._id;
  }
  if (!companyId) {
    fail("Get company", "No companyId on user and no companies in DB — run seed");
    printResults();
    process.exit(1);
  }
  pass("Get company", companyId);

  const stock = await api("/inventory?page=1&limit=5", { token });
  const stockRows = stock.json.data ?? [];
  const inStock = stockRows.find((r) => r.currentStock > 0);
  if (!inStock) {
    fail("Stock levels", "No in-stock product found — run seed script");
    printResults();
    process.exit(1);
  }
  pass("Stock levels", `${stockRows.length} row(s), using product with stock ${inStock.currentStock}`);

  const branchId =
    typeof inStock.branchId === "object" ? inStock.branchId._id : inStock.branchId;
  const productId =
    typeof inStock.productId === "object" ? inStock.productId._id : inStock.productId;

  const uniquePhone = `9${String(Date.now()).slice(-7)}`;
  const create = await api("/customers", {
    method: "POST",
    token,
    body: {
      companyId,
      phone: uniquePhone,
      name: "E2E Test Customer",
      email: `e2e-${Date.now()}@test.om`,
      address: "Al Khuwair, Muscat",
      area: "Al Khuwair",
    },
  });
  if (!create.json.success) {
    fail("Create customer", create.json.error?.message ?? `HTTP ${create.status}`);
  } else {
    pass("Create customer", `phone 968${uniquePhone} → ${create.json.data._id}`);
  }

  const list = await api(`/customers?search=${uniquePhone}`, { token });
  const found = (list.json.data ?? []).some((c) => c.phone.includes(uniquePhone));
  if (found) pass("List customers", "New customer visible in search");
  else fail("List customers", "Customer not found after create");

  const promise = await api("/deliveries/predict-promise", {
    method: "POST",
    token,
    body: { companyId, branchId, totalAmount: 10, quantity: 1 },
  });
  if (!promise.json.success) {
    fail("Predict delivery promise", JSON.stringify(promise.json.error ?? promise.json));
  } else {
    pass(
      "Predict delivery promise",
      `${promise.json.data.promisedWindowStart?.slice(0, 16)} → ${promise.json.data.promisedWindowEnd?.slice(11, 16)}`
    );
  }

  const salePhone = `9${String(Date.now() + 1).slice(-7)}`;
  const sale = await api("/sales", {
    method: "POST",
    token,
    body: {
      companyId,
      branchId,
      productId,
      quantity: 1,
      customerPhone: salePhone,
      customerName: "Sale Flow Customer",
      customerAddress: "Ruwi, Muscat",
      customerArea: "Ruwi",
      promisedWindowStart: promise.json.data?.promisedWindowStart,
      promisedWindowEnd: promise.json.data?.promisedWindowEnd,
    },
  });
  if (!sale.json.success) {
    fail("Record sale (new customer)", JSON.stringify(sale.json.error ?? sale.json));
  } else {
    const saleNo = sale.json.data?.saleNumber ?? sale.json.data?._id;
    const cust =
      typeof sale.json.data?.customerId === "object"
        ? sale.json.data.customerId.phone
        : "linked";
    pass("Record sale (new customer)", `${saleNo}, customer ${cust}`);
  }

  const dup = await api("/customers", {
    method: "POST",
    token,
    body: { companyId, phone: `968${salePhone}`, name: "Updated Name" },
  });
  if (dup.json.success && dup.json.data?.name === "Updated Name") {
    pass("Phone normalization", "968 prefix matches local number");
  } else {
    fail("Phone normalization", dup.json.error?.message ?? "Did not update existing customer");
  }

  const deliveries = await api("/deliveries?page=1&limit=3", { token });
  if (deliveries.json.success) {
    pass("Deliveries list", `${(deliveries.json.data ?? []).length} recent delivery(s)`);
  } else {
    fail("Deliveries list", deliveries.json.error?.message);
  }

  printResults();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function printResults() {
  console.log("\n--- Results ---");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
