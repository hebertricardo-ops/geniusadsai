

## Plan: Update Pricing Buttons to Hotmart Checkout Links

### Changes

**File: `src/pages/Index.tsx`**

1. Add a `checkoutUrl` property to each paid package object:
   - Básico: `https://pay.hotmart.com/E105290250P?off=1lncai6a&checkoutMode=10`
   - Pro: `https://pay.hotmart.com/E105290250P?off=0eczkuvh&checkoutMode=10`
   - Plus: `https://pay.hotmart.com/E105290250P?off=p12z4pm0&checkoutMode=10`
   - Free: no URL (keeps current `navigate("/auth")` behavior)

2. Replace the `onClick` handler logic (lines 314-331):
   - For `free`: keep `navigate("/auth")`
   - For paid packages: use `window.open(checkoutUrl, '_blank', 'noopener,noreferrer')` to open in a new tab safely
   - Remove the Stripe `create-checkout` edge function call entirely from the button handler

3. Best practices applied:
   - `rel="noopener,noreferrer"` via `window.open` third argument to prevent tab-napping
   - Opens in `_blank` target for new tab
   - No async/await needed — direct link opening, no loading states or error handling complexity

