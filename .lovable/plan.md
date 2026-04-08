

## Plan: Credit Validation Before Copy Generation

### Problem
Currently, copy generation (which is free) happens without checking if the user has enough credits to later generate the images. This leads to a frustrating experience where the user goes through the entire copy process only to discover they can't afford the images.

### Solution
Add a pre-flight credit check **before** generating copies in both generators, and show a dialog when credits are insufficient.

### Changes

**1. Create a reusable `InsufficientCreditsDialog` component**
- New file: `src/components/InsufficientCreditsDialog.tsx`
- Uses the existing `Dialog` component
- Shows: message explaining insufficient credits, current balance, required amount, and a button to navigate to the pricing/credits page
- Props: `open`, `onClose`, `creditsNeeded`, `creditsAvailable`

**2. Update `CreateCarousel.tsx`**
- In `handleGenerateCopy`, before calling the edge function, check `credits.credits_balance >= slidesCount`
- If insufficient, open the `InsufficientCreditsDialog` with `creditsNeeded = slidesCount` and `creditsAvailable = credits.credits_balance`
- Block the copy generation entirely until user has enough credits

**3. Update `CreateCreative.tsx`**
- In `handleGenerate` (the copy generation step), the check already exists at line 76 (`credits.credits_balance < quantity`) but only shows a toast
- Replace the toast with the same `InsufficientCreditsDialog` for consistency
- The `quantity` variable represents how many creatives (images) will be generated, so check against that

### Technical Details
- The dialog will include a "Recarregar Créditos" button that navigates to the pricing page (Dashboard or a dedicated credits page)
- Both carousel (slidesCount) and creative (quantity) flows will use the same dialog component
- No backend changes needed — the credit balance is already fetched via `useCredits` hook

