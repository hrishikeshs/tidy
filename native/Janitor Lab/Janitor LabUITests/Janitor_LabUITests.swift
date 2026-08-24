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
    func testLearningCleanFindsMinimalFixtureState() throws {
        let app = XCUIApplication()
        app.launchEnvironment["TIDY_LEARNING_FIXTURE_URL"] = "http://127.0.0.1:8765/learning?tidy_seed=1"
        app.launch()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 5))

        XCTAssertTrue(app.navigationBars["Learning Clean"].waitForExistence(timeout: 8))
        let health = app.staticTexts["All required state present"]
        XCTAssertTrue(health.waitForExistence(timeout: 10))

        let capture = app.buttons["learning.capture"]
        XCTAssertTrue(capture.waitForExistence(timeout: 5))
        capture.tap()

        let result = app.textViews["learning.result"]
        XCTAssertTrue(result.waitForExistence(timeout: 5))
        let captured = NSPredicate(format: "value CONTAINS %@", "Captured 6 state items")
        expectation(for: captured, evaluatedWith: result)
        waitForExpectations(timeout: 8)

        let learn = app.buttons["learning.run"]
        XCTAssertTrue(learn.isEnabled)
        learn.tap()

        let learned = NSPredicate(format: "label CONTAINS %@", "Required 3, removable 3")
        expectation(for: learned, evaluatedWith: result)
        waitForExpectations(timeout: 40)
        XCTAssertTrue(result.label.contains("tidy_required_auth"))
        XCTAssertTrue(result.label.contains("tidy_optional_cookie"))

        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Learning Clean minimal fixture state"
        screenshot.lifetime = .keepAlways
        add(screenshot)

        app.terminate()
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 5))
        let address = safari.textFields["Address"]
        XCTAssertTrue(address.waitForExistence(timeout: 5))
        address.tap()
        address.typeText("http://127.0.0.1:8765/learning?tidy_seed=1\n")
        XCTAssertTrue(safari.staticTexts["All required state present"].waitForExistence(timeout: 10))

        openTidyPopup(in: safari)
        grantAndInspectIfNeeded(in: safari)

        let learnedPolicyNote = safari.staticTexts.containing(
            NSPredicate(format: "label CONTAINS %@", "3 required and 3 removable")
        ).firstMatch
        XCTAssertTrue(learnedPolicyNote.waitForExistence(timeout: 8))
        let extensionWebView = safari.webViews["Tidy"].firstMatch
        extensionWebView.swipeUp()
        let cleanLearned = safari.buttons["Clean 3 learned removable items"]
        XCTAssertTrue(cleanLearned.waitForExistence(timeout: 5))
        cleanLearned.tap()

        let cleanupResult = safari.staticTexts.containing(
            NSPredicate(format: "label CONTAINS %@", "Removed: 2 storage items and 1 cookies")
        ).firstMatch
        XCTAssertTrue(cleanupResult.waitForExistence(timeout: 8))
        XCTAssertTrue(safari.buttons["Clean 0 learned removable items"].isEnabled == false)

        let bridgeScreenshot = XCTAttachment(screenshot: safari.screenshot())
        bridgeScreenshot.name = "Learning Clean policy applied in Safari"
        bridgeScreenshot.lifetime = .keepAlways
        add(bridgeScreenshot)
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

        // Seed the fixture inside this simulator clone so prior destructive runs cannot leak in.
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 5))

        let address = safari.textFields["Address"]
        XCTAssertTrue(address.waitForExistence(timeout: 5))
        address.tap()
        address.typeText("http://127.0.0.1:8765/?tidy_reset=1\n")
        XCTAssertTrue(safari.staticTexts["Storage and blocking fixture"].waitForExistence(timeout: 10))
        let seededFixture = safari.staticTexts.containing(
            NSPredicate(format: "label CONTAINS %@", "Service worker: registration attempted")
        ).firstMatch
        XCTAssertTrue(seededFixture.waitForExistence(timeout: 10))

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
    func testDashboardClearAllSavedWebsiteData() throws {
        let containingApp = XCUIApplication()
        containingApp.launch()
        XCTAssertTrue(containingApp.wait(for: .runningForeground, timeout: 5))

        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 5))

        let address = safari.textFields["Address"]
        XCTAssertTrue(address.waitForExistence(timeout: 5))
        address.tap()
        address.typeText("http://127.0.0.1:8765/?tidy_reset=1\n")
        XCTAssertTrue(safari.staticTexts["Storage and blocking fixture"].waitForExistence(timeout: 10))
        let seededFixture = safari.staticTexts.containing(
            NSPredicate(format: "label CONTAINS %@", "Service worker: registration attempted")
        ).firstMatch
        XCTAssertTrue(seededFixture.waitForExistence(timeout: 10))

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

        XCTAssertTrue(safari.staticTexts["Start over across Safari"].waitForExistence(timeout: 5))
        let clearAll = safari.buttons["Clear all saved website data"]
        XCTAssertTrue(clearAll.waitForExistence(timeout: 5))
        clearAll.tap()
        XCTAssertTrue(safari.staticTexts["Clear all saved website data?"].waitForExistence(timeout: 5))
        let signOutWarning = safari.staticTexts.containing(
            NSPredicate(format: "label CONTAINS %@", "probably be signed out")
        ).firstMatch
        XCTAssertTrue(signOutWarning.waitForExistence(timeout: 5))
        safari.buttons["Confirm clear all saved website data"].tap()

        let cleanupResult = safari.staticTexts.containing(
            NSPredicate(format: "label BEGINSWITH %@", "Clear-all finished")
        ).firstMatch
        XCTAssertTrue(cleanupResult.waitForExistence(timeout: 15))
        XCTAssertFalse(safari.staticTexts["Clear all saved website data?"].exists)
        let receipt = XCTAttachment(string: cleanupResult.label)
        receipt.name = "Tidy clear-all receipt"
        receipt.lifetime = .keepAlways
        add(receipt)
        XCTAssertTrue(cleanupResult.label.contains("observed site(s)"))
        XCTAssertTrue(cleanupResult.label.contains("removed 9 storage item(s)"))
        XCTAssertTrue(cleanupResult.label.contains("Site failures:"))
        XCTAssertTrue(cleanupResult.label.contains("item failures:"))
        XCTAssertTrue(safari.staticTexts["0 local"].waitForExistence(timeout: 5))
        XCTAssertTrue(safari.staticTexts["0 session"].exists)
        XCTAssertTrue(safari.staticTexts["0 IDB"].exists)
        XCTAssertTrue(safari.staticTexts["0 caches"].exists)
        XCTAssertTrue(safari.staticTexts["0 workers"].exists)

        let hierarchy = XCTAttachment(string: safari.debugDescription)
        hierarchy.name = "Tidy dashboard clear-all hierarchy"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)

        let screenshot = XCTAttachment(screenshot: safari.screenshot())
        screenshot.name = "Tidy dashboard after clear all"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}
