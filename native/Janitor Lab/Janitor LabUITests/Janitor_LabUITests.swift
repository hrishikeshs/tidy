//
//  Janitor_LabUITests.swift
//  Janitor LabUITests
//
//  Created by Hrishikesh S on 8/23/26.
//

import XCTest

final class Janitor_LabUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    private func openTidyPopup(in safari: XCUIApplication) {
        let pageMenu = safari.buttons["PageFormatMenuButton"]
        XCTAssertTrue(pageMenu.waitForExistence(timeout: 5))
        pageMenu.tap()

        let dismissHighlights = safari.buttons["Not Now"]
        if dismissHighlights.waitForExistence(timeout: 1) {
            dismissHighlights.tap()
        }

        let extensionEntry = safari.cells["Tidy"]
        if !extensionEntry.waitForExistence(timeout: 1) {
            let manageExtensions = safari.cells["Manage Extensions"]
            XCTAssertTrue(manageExtensions.waitForExistence(timeout: 3))
            manageExtensions.tap()

            let tidySwitch = safari.switches["Tidy"].firstMatch
            XCTAssertTrue(tidySwitch.waitForExistence(timeout: 5))
            if (tidySwitch.value as? String) == "0" {
                tidySwitch.tap()
            }

            let done = safari.buttons["Done"]
            XCTAssertTrue(done.waitForExistence(timeout: 3))
            done.tap()
        }
        XCTAssertTrue(extensionEntry.waitForExistence(timeout: 5))
        extensionEntry.tap()

        let initialAccess = safari.buttons["Always Allow…"]
        if initialAccess.waitForExistence(timeout: 2) {
            initialAccess.tap()

            let permanentChoices = [
                "Always Allow on Every Website",
                "Always Allow on All Websites",
                "Always Allow on This Website",
                "Always Allow"
            ]
            for label in permanentChoices {
                let button = safari.buttons[label]
                if button.waitForExistence(timeout: 1) {
                    button.tap()
                    break
                }
            }
        }
        XCTAssertTrue(safari.staticTexts["Fixture rule installed"].waitForExistence(timeout: 5))
    }

    @MainActor
    private func grantAndInspectIfNeeded(in safari: XCUIApplication) {
        let inspectState = safari.buttons["Inspect accessible state"]
        let allSitesGranted = safari.staticTexts[
            "All-sites access granted. Observations stay on this device."
        ]
        if allSitesGranted.waitForExistence(timeout: 2) {
            XCTAssertTrue(inspectState.waitForExistence(timeout: 3))
            inspectState.tap()
            XCTAssertTrue(safari.staticTexts["Accessible state"].waitForExistence(timeout: 8))
            return
        }

        let grantAllSites = safari.buttons["Grant access to all websites"]
        if grantAllSites.waitForExistence(timeout: 2) {
            grantAllSites.tap()
            let possibleAllowButtons = [
                "Allow on Every Website",
                "Always Allow on Every Website",
                "Always Allow on All Websites",
                "Always Allow",
                "Allow for One Day",
                "Allow"
            ]
            for label in possibleAllowButtons {
                let button = safari.buttons[label]
                if button.waitForExistence(timeout: 2) {
                    button.tap()
                    break
                }
            }
        } else {
            XCTAssertTrue(inspectState.waitForExistence(timeout: 5))
            inspectState.tap()
        }
        XCTAssertTrue(safari.staticTexts["Accessible state"].waitForExistence(timeout: 8))
    }

    @MainActor
    func testPhaseZeroPermissionInspectionAndSelectiveCleanup() throws {
        // Launching the containing app installs the extension for this test run.
        let containingApp = XCUIApplication()
        containingApp.launch()
        XCTAssertTrue(containingApp.wait(for: .runningForeground, timeout: 5))

        // The fixture URL is opened by the test protocol before this test.
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 5))

        openTidyPopup(in: safari)
        grantAndInspectIfNeeded(in: safari)

        let namesAndClassifications = safari.buttons["Names and classifications"].firstMatch
        XCTAssertTrue(namesAndClassifications.waitForExistence(timeout: 5))
        namesAndClassifications.tap()
        XCTAssertTrue(safari.staticTexts["_janitor_tracker_id — Marketing · high confidence · removable"].waitForExistence(timeout: 5))
        XCTAssertTrue(safari.staticTexts["janitor_login_preference — Functional · medium confidence · kept"].exists)
        XCTAssertTrue(safari.staticTexts["_janitor_tracker_session — Marketing · high confidence · removable"].exists)
        XCTAssertTrue(safari.staticTexts["janitor_draft — Unknown · kept"].exists)
        XCTAssertTrue(safari.staticTexts["janitor-tracker-db — Marketing · high confidence · removable"].exists)
        XCTAssertTrue(safari.staticTexts["janitor-functional-db — Unknown · kept"].exists)
        XCTAssertTrue(safari.staticTexts["janitor-tracker-cache — Marketing · high confidence · removable"].exists)
        XCTAssertTrue(safari.staticTexts["janitor-functional-cache — Unknown · kept"].exists)
        XCTAssertTrue(safari.staticTexts["_janitor_tracker — Marketing · high confidence · removable"].exists)
        XCTAssertTrue(safari.staticTexts["janitor_login — Functional · medium confidence · kept"].exists)
        let cookieFallbackNote = safari.staticTexts.containing(
            NSPredicate(format: "label CONTAINS %@", "HttpOnly cookies may still be inaccessible.")
        ).firstMatch
        XCTAssertTrue(cookieFallbackNote.exists)
        namesAndClassifications.tap()

        let extensionWebView = safari.webViews["Tidy"].firstMatch
        extensionWebView.swipeUp()
        let cleanTrackers = safari.buttons["Clean 5 likely tracking items"]
        XCTAssertTrue(cleanTrackers.waitForExistence(timeout: 5))
        cleanTrackers.tap()

        let cleanupResult = safari.staticTexts.containing(
            NSPredicate(format: "label BEGINSWITH %@", "Attempted:")
        ).firstMatch
        XCTAssertTrue(cleanupResult.waitForExistence(timeout: 8))
        XCTAssertTrue(cleanupResult.label.contains("Removed: 4 storage items"))

        namesAndClassifications.tap()
        XCTAssertTrue(safari.staticTexts["janitor_login_preference — Functional · medium confidence · kept"].exists)
        XCTAssertTrue(safari.staticTexts["janitor_draft — Unknown · kept"].exists)
        XCTAssertTrue(safari.staticTexts["janitor-functional-db — Unknown · kept"].exists)
        XCTAssertTrue(safari.staticTexts["janitor-functional-cache — Unknown · kept"].exists)
        XCTAssertFalse(safari.staticTexts["_janitor_tracker_id — Marketing · high confidence · removable"].exists)
        XCTAssertFalse(safari.staticTexts["_janitor_tracker_session — Marketing · high confidence · removable"].exists)
        XCTAssertFalse(safari.staticTexts["janitor-tracker-db — Marketing · high confidence · removable"].exists)
        XCTAssertFalse(safari.staticTexts["janitor-tracker-cache — Marketing · high confidence · removable"].exists)
        XCTAssertFalse(safari.staticTexts["_janitor_tracker — Marketing · high confidence · removable"].exists)
        XCTAssertTrue(safari.staticTexts["janitor_login — Functional · medium confidence · kept"].exists)

        namesAndClassifications.tap()
        extensionWebView.swipeUp()
        let forgetSiteData = safari.buttons["Forget accessible site data…"]
        XCTAssertTrue(forgetSiteData.waitForExistence(timeout: 5))
        forgetSiteData.tap()

        let confirmRemoval = safari.buttons["Remove accessible data"]
        XCTAssertTrue(confirmRemoval.waitForExistence(timeout: 5))
        confirmRemoval.tap()

        let fullCleanupResult = safari.staticTexts.containing(
            NSPredicate(format: "label CONTAINS %@", "Removed: 5 storage items")
        ).firstMatch
        XCTAssertTrue(fullCleanupResult.waitForExistence(timeout: 8))
        namesAndClassifications.tap()
        XCTAssertFalse(safari.staticTexts["janitor_login_preference — Functional · medium confidence · kept"].exists)
        XCTAssertFalse(safari.staticTexts["janitor_draft — Unknown · kept"].exists)
        XCTAssertFalse(safari.staticTexts["janitor-functional-db — Unknown · kept"].exists)
        XCTAssertFalse(safari.staticTexts["janitor-functional-cache — Unknown · kept"].exists)
        XCTAssertFalse(safari.staticTexts["janitor_login — Functional · medium confidence · kept"].exists)
        let emptyCategories = safari.staticTexts.matching(
            NSPredicate(format: "label == %@", "None observed")
        )
        XCTAssertGreaterThanOrEqual(emptyCategories.count, 6)

        let hierarchy = XCTAttachment(string: safari.debugDescription)
        hierarchy.name = "Janitor Lab full cleanup hierarchy"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)

        let screenshot = XCTAttachment(screenshot: safari.screenshot())
        screenshot.name = "Janitor Lab full cleanup"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }

    @MainActor
    func testDashboardCatalogCookieProbeAndBulkCleanup() throws {
        let containingApp = XCUIApplication()
        containingApp.launch()
        XCTAssertTrue(containingApp.wait(for: .runningForeground, timeout: 5))

        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 5))

        openTidyPopup(in: safari)
        grantAndInspectIfNeeded(in: safari)

        let dashboardButton = safari.buttons["Open Tidy dashboard"]
        XCTAssertTrue(dashboardButton.waitForExistence(timeout: 5))
        dashboardButton.tap()

        XCTAssertTrue(safari.staticTexts["Your web, under control."].waitForExistence(timeout: 8))
        XCTAssertTrue(safari.staticTexts["127.0.0.1"].waitForExistence(timeout: 5))
        XCTAssertTrue(safari.staticTexts["2 local"].exists)
        XCTAssertTrue(safari.staticTexts["2 session"].exists)
        XCTAssertTrue(safari.staticTexts["2 IDB"].exists)
        XCTAssertTrue(safari.staticTexts["2 caches"].exists)
        XCTAssertTrue(safari.staticTexts["1 workers"].exists)

        let cookieProbe = safari.buttons["Probe global cookies"]
        XCTAssertTrue(cookieProbe.waitForExistence(timeout: 5))
        cookieProbe.tap()
        let cookieResult = safari.staticTexts.containing(
            NSPredicate(format: "label BEGINSWITH %@", "Safari exposed")
        ).firstMatch
        XCTAssertTrue(cookieResult.waitForExistence(timeout: 8))

        let siteSelection = safari.switches["Select 127.0.0.1"]
        XCTAssertTrue(siteSelection.waitForExistence(timeout: 5))
        siteSelection.tap()

        let forgetSelected = safari.buttons["Forget selected…"]
        XCTAssertTrue(forgetSelected.isEnabled)
        forgetSelected.tap()
        XCTAssertTrue(safari.staticTexts["Forget 1 selected site?"].waitForExistence(timeout: 5))
        safari.buttons["Remove accessible data"].tap()

        let cleanupResult = safari.staticTexts.containing(
            NSPredicate(format: "label BEGINSWITH %@", "Cleaned 1 site")
        ).firstMatch
        XCTAssertTrue(cleanupResult.waitForExistence(timeout: 10))
        XCTAssertFalse(safari.staticTexts["Forget 1 selected site?"].exists)
        XCTAssertTrue(cleanupResult.label.contains("removed 9 storage item(s)"))
        XCTAssertTrue(safari.staticTexts["0 local"].waitForExistence(timeout: 5))
        XCTAssertTrue(safari.staticTexts["0 session"].exists)
        XCTAssertTrue(safari.staticTexts["0 IDB"].exists)
        XCTAssertTrue(safari.staticTexts["0 caches"].exists)
        XCTAssertTrue(safari.staticTexts["0 workers"].exists)

        let hierarchy = XCTAttachment(string: safari.debugDescription)
        hierarchy.name = "Tidy dashboard full cleanup hierarchy"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)

        let screenshot = XCTAttachment(screenshot: safari.screenshot())
        screenshot.name = "Tidy dashboard after full cleanup"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}
