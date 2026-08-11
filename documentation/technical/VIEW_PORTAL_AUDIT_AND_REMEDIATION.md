# View Portal (Impersonation) Technical Audit & Remediation Guide

## 1. Overview & Architectural Intent
The **View Portal** feature in the Dream Supreme Admin Portal (`/admin/users`) is designed to allow Administrators and Principals to view the platform from the exact perspective of an estate agent. 

When triggered, the system invokes `startImpersonating(userAccount)` in the `AuthProvider` context and navigates to `/`. The UI context then updates `activeAccount` to point to the impersonated user while preserving the original administrator account in `account`.

```
[ Master Admin / Principal Session ]
                 │
                 ▼
     startImpersonating(agent)
                 │
                 ▼
 ┌──────────────────────────────────────┐
 │          AuthProvider State          │
 │  account:            Admin User      │
 │  impersonatedAccount: Agent User      │
 │  activeAccount:      Agent User      │
 └──────────────────────────────────────┘
                 │
                 ▼
 [ Client Applications & Portal Views ]
```

---

## 2. Comprehensive Audit Findings

### 2.1. Hardcoded Impersonation Payload & Data Integrity Degradation
* **Location**: [`src/routes/admin/users.tsx`](file:///c:/Personal%20Projects/FOCI%20PROJECTS/Dream-Supreme-Property-management/src/routes/admin/users.tsx#L674-L685)
* **Code Pattern**:
  ```tsx
  startImpersonating({
    id: u.id,
    agencyId: "current", // ❌ Hardcoded string literal
    branchId: null,      // ❌ Hardcoded null
    fullName: u.name,
    email: u.email,
    role: "agent",
    status: u.active ? "active" : "suspended",
  });
  ```
* **Impact**:
  1. `agencyId` set to `"current"` breaks all downstream hooks and data filters expecting a UUID `agency_id`.
  2. `branchId` set to `null` strips away multi-branch agency context for agents belonging to a specific branch.

### 2.2. Missing Impersonation UI Feedback & Exit Controls
* **Location**: [`src/lib/auth.tsx`](file:///c:/Personal%20Projects/FOCI%20PROJECTS/Dream-Supreme-Property-management/src/lib/auth.tsx#L90-L92)
* **Impact**:
  1. `stopImpersonating()` is defined in `AuthContext` but is **never invoked or rendered anywhere in the user interface**.
  2. There is no global top-bar banner alerting the admin that impersonation is active.
  3. Admins have no UI button to stop impersonating and return to their admin account.

### 2.3. Admin Routing Lockout Hazard
* **Location**: [`src/routes/admin.tsx`](file:///c:/Personal%20Projects/FOCI%20PROJECTS/Dream-Supreme-Property-management/src/routes/admin.tsx#L11-L18)
* **Code Pattern**:
  ```tsx
  function AdminLayout() {
    const { activeAccount, loading } = useAuth();
    const isAllowed = canAccessAdmin(activeAccount);

    if (!isAllowed) {
      return <Navigate to="/login" replace />;
    }
  }
  ```
* **Impact**:
  * `canAccessAdmin(activeAccount)` checks if `activeAccount.role` is `"admin"` or `"principal"`.
  * While impersonating an agent, `activeAccount.role` is `"agent"`.
  * If the admin attempts to click an Admin sidebar link or navigate to `/admin`, `canAccessAdmin` evaluates to `false` and forcibly redirects the user to `/login`.

### 2.4. Inconsistent Hook Consumption (`account` vs `activeAccount`)
* **Location**: Various pages and components ([`header.tsx`](file:///c:/Personal%20Projects/FOCI%20PROJECTS/Dream-Supreme-Property-management/src/components/layout/header.tsx#L45), [`documents.tsx`](file:///c:/Personal%20Projects/FOCI%20PROJECTS/Dream-Supreme-Property-management/src/routes/documents.tsx#L49), [`rentals/index.tsx`](file:///c:/Personal%20Projects/FOCI%20PROJECTS/Dream-Supreme-Property-management/src/routes/rentals/index.tsx#L27), [`trust.ts`](file:///c:/Personal%20Projects/FOCI%20PROJECTS/Dream-Supreme-Property-management/src/data/trust.ts#L7))
* **Impact**:
  * `Header` notification subscriptions use `account.id`. While impersonating, the notification icon fetches and displays Admin notifications instead of Agent notifications.
  * Pages reading `account` instead of `activeAccount` present hybrid/corrupt states where some components show Agent data and others show Admin data.

### 2.5. Ephemeral Session State & Supabase RLS Alignment
* **In-Memory Storage**: `impersonatedAccount` is stored strictly in React `useState`. Pressing `F5` or hard-reloading clears impersonation silently.
* **Backend Security**: Impersonation is client-side state switching. Direct Supabase requests evaluate against the Admin's JWT (`auth.uid()`). Client-side filtered queries (e.g. `usePipelineDeals`) filter by `activeAccount.id`.

---

## 3. Step-by-Step Remediation Action Plan

### Step 1: Pass Complete Agency & Branch Metadata
Update `AdminUser` model and `useAdminUsers()` in [`src/data/users.ts`](file:///c:/Personal%20Projects/FOCI%20PROJECTS/Dream-Supreme-Property-management/src/data/users.ts) to select `agency_id` and `branch_id`. Pass these fields into `startImpersonating(...)` in [`src/routes/admin/users.tsx`](file:///c:/Personal%20Projects/FOCI%20PROJECTS/Dream-Supreme-Property-management/src/routes/admin/users.tsx):

```tsx
startImpersonating({
  id: u.id,
  agencyId: u.agencyId,
  branchId: u.branchId ?? null,
  fullName: u.name,
  email: u.email,
  role: "agent",
  status: u.active ? "active" : "suspended",
});
```

### Step 2: Implement Global Impersonation Banner
Create a global `<ImpersonationBanner />` component mounted inside `AppShell` or `AuthenticatedOutlet` when `impersonatedAccount !== null`:

```tsx
export function ImpersonationBanner() {
  const { impersonatedAccount, stopImpersonating } = useAuth();
  const navigate = useNavigate();

  if (!impersonatedAccount) return null;

  return (
    <div className="bg-amber-600 text-white px-4 py-2 text-sm flex items-center justify-between shadow-md">
      <div className="flex items-center gap-2">
        <Eye className="size-4 animate-pulse" />
        <span>
          Viewing portal as <strong>{impersonatedAccount.fullName}</strong> ({impersonatedAccount.email})
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          stopImpersonating();
          navigate({ to: "/admin/users" });
        }}
      >
        Exit View Portal
      </Button>
    </div>
  );
}
```

### Step 3: Update Admin Route Guard
Modify [`src/routes/admin.tsx`](file:///c:/Personal%20Projects/FOCI%20PROJECTS/Dream-Supreme-Property-management/src/routes/admin.tsx) to check the authenticated master account (`account`) instead of `activeAccount`, or clear impersonation when accessing admin paths:

```tsx
function AdminLayout() {
  const { account, impersonatedAccount, stopImpersonating, loading } = useAuth();
  const isAllowed = canAccessAdmin(account);

  // Automatically clear impersonation if an admin navigates back to admin routes
  useEffect(() => {
    if (impersonatedAccount) {
      stopImpersonating();
    }
  }, [impersonatedAccount, stopImpersonating]);

  if (loading) return null;
  if (!isAllowed) return <Navigate to="/login" replace />;

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
```

### Step 4: Standardize `activeAccount` Across Component Hooks
Audit and refactor components (`Header`, `documents.tsx`, `rentals/index.tsx`, `trust.ts`, `templates.ts`) to use `activeAccount` for user-scoped data fetching:

```tsx
// Before
const { account } = useAuth();

// After
const { activeAccount } = useAuth();
```

---

## 4. Verification Checklist

- [ ] Triggering "View Portal" on an agent correctly switches `activeAccount` with valid `agencyId` and `branchId`.
- [ ] Global Amber Impersonation Banner renders at top of screen with agent's name and email.
- [ ] Clicking "Exit View Portal" stops impersonation and returns to `/admin/users`.
- [ ] Navigating to `/admin` while impersonating clears impersonation without triggering a login redirect.
- [ ] Agent-scoped views (Deals, Notifications, Documents, Rentals) render data using `activeAccount`.
