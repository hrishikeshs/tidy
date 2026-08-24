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
    func testPhaseZeroPermissionInspectionAndSelectiveCleanup() throws {
        // Launching the containing app installs the extension for this test run.
        let containingApp = XCUIApplication()
        containingApp.launch()
        XCTAssertTrue(containingApp.wait(for: .runningForeground, timeout: 5))

        // The fixture URL is opened by the test protocol before this test.
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 5))

        let pageMenu = safari.buttons["PageFormatMenuButton"]
        XCTAssertTrue(pageMenu.waitForExistence(timeout: 5))
        pageMenu.tap()

        let extensionEntry = safari.cells["Janitor Lab"]
        XCTAssertTrue(extensionEntry.waitForExistence(timeout: 5))
        extensionEntry.tap()
        XCTAssertTrue(safari.staticTexts["Fixture shield enabled"].waitForExistence(timeout: 5))

        let grantAccess = safari.buttons["Grant access to this site"]
        if grantAccess.waitForExistence(timeout: 2) {
            grantAccess.tap()
            let allowForOneDay = safari.buttons["Allow for One Day"]
            XCTAssertTrue(allowForOneDay.waitForExistence(timeout: 5))
            allowForOneDay.tap()
        } else {
            let inspectState = safari.buttons["Inspect accessible state"]
            XCTAssertTrue(inspectState.waitForExistence(timeout: 5))
            inspectState.tap()
        }
        XCTAssertTrue(safari.staticTexts["Accessible state"].waitForExistence(timeout: 8))

        let namesAndClassifications = safari.buttons["Names and classifications"].firstMatch
        XCTAssertTrue(namesAndClassifications.waitForExistence(timeout: 5))
        namesAndClassifications.tap()
        XCTAssertTrue(safari.staticTexts["_janitor_tracker_id — known-fixture-tracker"].waitForExistence(timeout: 5))
        XCTAssertTrue(safari.staticTexts["janitor_login_preference — unknown"].exists)
        XCTAssertTrue(safari.staticTexts["_janitor_tracker_session — known-fixture-tracker"].exists)
        XCTAssertTrue(safari.staticTexts["janitor_draft — unknown"].exists)
        XCTAssertTrue(safari.staticTexts["janitor-tracker-db — unknown"].exists)
        XCTAssertTrue(safari.staticTexts["janitor-functional-db — unknown"].exists)
        XCTAssertTrue(safari.staticTexts["janitor-tracker-cache — unknown"].exists)
        XCTAssertTrue(safari.staticTexts["janitor-functional-cache — unknown"].exists)
        XCTAssertTrue(safari.staticTexts["_janitor_tracker — known-fixture-tracker"].exists)
        XCTAssertTrue(safari.staticTexts["janitor_login — unknown"].exists)
        let cookieFallbackNote = safari.staticTexts.containing(
            NSPredicate(format: "label CONTAINS %@", "HttpOnly cookies may still be inaccessible.")
        ).firstMatch
        XCTAssertTrue(cookieFallbackNote.exists)
        namesAndClassifications.tap()

        let extensionWebView = safari.webViews["Janitor Lab"].firstMatch
        extensionWebView.swipeUp()
        let cleanTrackers = safari.buttons["Clean tracker fixture"]
        XCTAssertTrue(cleanTrackers.waitForExistence(timeout: 5))
        cleanTrackers.tap()

        let cleanupResult = safari.staticTexts.containing(
            NSPredicate(format: "label BEGINSWITH %@", "Attempted:")
        ).firstMatch
        XCTAssertTrue(cleanupResult.waitForExistence(timeout: 8))
        XCTAssertTrue(cleanupResult.label.contains("Removed: 4 storage items"))

        namesAndClassifications.tap()
        XCTAssertTrue(safari.staticTexts["janitor_login_preference — unknown"].exists)
        XCTAssertTrue(safari.staticTexts["janitor_draft — unknown"].exists)
        XCTAssertTrue(safari.staticTexts["janitor-functional-db — unknown"].exists)
        XCTAssertTrue(safari.staticTexts["janitor-functional-cache — unknown"].exists)
        XCTAssertFalse(safari.staticTexts["_janitor_tracker_id — known-fixture-tracker"].exists)
        XCTAssertFalse(safari.staticTexts["_janitor_tracker_session — known-fixture-tracker"].exists)
        XCTAssertFalse(safari.staticTexts["janitor-tracker-db — unknown"].exists)
        XCTAssertFalse(safari.staticTexts["janitor-tracker-cache — unknown"].exists)
        XCTAssertFalse(safari.staticTexts["_janitor_tracker — known-fixture-tracker"].exists)
        XCTAssertTrue(safari.staticTexts["janitor_login — unknown"].exists)

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
        XCTAssertFalse(safari.staticTexts["janitor_login_preference — unknown"].exists)
        XCTAssertFalse(safari.staticTexts["janitor_draft — unknown"].exists)
        XCTAssertFalse(safari.staticTexts["janitor-functional-db — unknown"].exists)
        XCTAssertFalse(safari.staticTexts["janitor-functional-cache — unknown"].exists)
        XCTAssertFalse(safari.staticTexts["janitor_login — unknown"].exists)
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
}
