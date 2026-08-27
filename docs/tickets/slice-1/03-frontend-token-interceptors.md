# 03 — Frontend: in-memory access token + axios interceptors

**What to build:** The frontend keeps the access token in memory only; every API call
carries it as a Bearer header via a request interceptor; a response interceptor performs
single-flight refresh on 401 (concurrent failures share one refresh), retries the original
request once, and signals logout only when refresh fails. Auth bootstrap = refresh, then
fetch the session user. The storefront (login, browse, checkout, orders) works end-to-end
on the new mechanism.

**Blocked by:** 02 — Backend contract final.

**Status:** ready-for-agent

- [ ] No token in localStorage or a readable cookie — memory only
- [ ] Interceptor tests: 401 → one refresh → retry succeeds; refresh failure → logout
      signal; N concurrent 401s → exactly one refresh call
- [ ] AuthContext keeps its public surface; storefront flows work in dev
- [ ] Frontend type check, tests, and build green
