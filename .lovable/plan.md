

## Plan: Add "Adicionar Créditos" menu item and credits page

### What will be built
1. A new **"Adicionar Créditos"** page (`src/pages/AddCredits.tsx`) showing the pricing/packages grid (reusing the same package data from the landing page but adapted for logged-in users)
2. A new sidebar menu item with a coin/credit icon linking to `/add-credits`
3. A **"+"** button next to the credits badge in the header, also linking to `/add-credits`

### Technical details

**1. Create `src/pages/AddCredits.tsx`**
- New page with the 4 pricing cards (Free excluded since user is already signed up — or show only paid packages: Básico, Pro, Plus)
- Each card opens the respective Hotmart checkout URL in a new tab
- Reuse styling from the landing page pricing section

**2. Update `src/components/AppSidebar.tsx`**
- Add a new nav item: `{ title: "Adicionar Créditos", url: "/add-credits", icon: CreditCard }` (using `CreditCard` or `Coins` from lucide-react)

**3. Update `src/components/AppLayout.tsx`**
- Add a `+` button (small icon button) next to `CreditsBadge` that navigates to `/add-credits`

**4. Update `src/App.tsx`**
- Add route: `<Route path="/add-credits" element={<ProtectedWithLayout><AddCredits /></ProtectedWithLayout>} />`

