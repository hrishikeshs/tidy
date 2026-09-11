# App Review notes — Tidy 1.0.0

Tidy is a containing app plus Safari Web Extension. It has no account, login,
subscription, analytics, advertising SDK, backend, or cloud sync. The app is
free and offers three optional consumable tips through StoreKit.

## Review flow

1. Launch Tidy and follow the three on-screen steps.
2. In Safari, enable the Tidy extension and grant access to all websites.
3. Visit any ordinary HTTPS website, open Safari's Page Menu, and choose Tidy.
4. Tidy opens a full-page workspace for that site. Choose **Check this site** to
   inspect state Safari exposes, or use one of the explicitly confirmed cleanup
   actions.

The app also includes **Learning Clean**, an isolated `WKWebView` browser. Enter
a complete HTTPS address, establish the page state you want to preserve, capture
it, and choose **Find what is required**. Trials occur in non-persistent WebKit
stores on the device.

## Optional tip jar

The containing app's **Support Tidy** section opens a full-screen tip jar with
Small, Generous, and Amazing one-time tips. Each is a consumable In-App Purchase
and can be purchased repeatedly. Tipping unlocks no content, functionality, or
privileges; the same complete app remains available without a purchase.

For review, launch Tidy, choose **Leave a tip**, and select any tier. The screen
explicitly states that tips are optional and that purchases are handled by
Apple.

## All-sites permission

Tidy's only purpose is to inspect and remove user-selected website state across
Safari sites. Its content scripts need all-sites access to enumerate page-owned
Web Storage, IndexedDB, Cache Storage, service workers, and script-visible cookie
names. Safari presents its native consent prompt before granting this access.
Tidy does not transmit inspected information to the developer or any third
party.

## Local data and values

The Safari extension stores origins, hostnames, timestamps, category counts,
inaccessible-category flags, and cleanup outcomes in extension-local storage.
It does not persist cookie values, storage values, URL paths, or detailed error
text. On-demand inspection displays names but does not add them to the catalog.

Learning Clean is the deliberately value-aware path. It reads values from its
own separate WebKit profile and copies them only into in-memory snapshots and
non-persistent trial stores. Reusable policies contain names and outcomes, never
values, and expire after 14 days.

## Cleanup boundaries

Safari does not expose a general `browsingData` API to this extension. Tidy
removes only data reachable through page context and Safari's Cookies API. It
does not claim to clear Safari history, saved passwords, or inaccessible
HttpOnly cookies. Destructive actions warn that sign-in and preferences may be
lost and require confirmation.

The application uses Apple's standard HTTPS networking through WebKit and does
not implement non-exempt encryption.
