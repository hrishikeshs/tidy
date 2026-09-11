//
//  Janitor_LabTests.swift
//  Janitor LabTests
//
//  Created by Hrishikesh S on 8/23/26.
//

import Foundation
import Testing
@testable import Janitor_Lab

struct Janitor_LabTests {

    @Test @MainActor func tipJarProductsAreConsumableChoicesWithoutEntitlements() {
        #expect(TipJarStore.productIDs == [
            "io.hrishi.tidy.tip.small",
            "io.hrishi.tidy.tip.generous",
            "io.hrishi.tidy.tip.amazing"
        ])
        #expect(Set(TipJarStore.productIDs).count == TipJarStore.productIDs.count)
    }

    private func item(_ name: String, value: String = "value") -> WebStateItem {
        .storage(kind: .localStorage, name: name, value: value)
    }

    @Test @MainActor func deltaDebuggerFindsAOneMinimalPassingSet() async throws {
        let all = ["required-a", "optional-a", "required-b", "optional-b", "optional-c"]
            .map { item($0) }
        var evaluated: [[String]] = []
        let result = try await LearningDeltaDebugger.minimize(items: all) { candidate in
            let names = Set(candidate.map(\.name))
            evaluated.append(names.sorted())
            return names.isSuperset(of: ["required-a", "required-b"])
        }

        #expect(evaluated.first == all.map(\.name).sorted())
        #expect(Set(result.required.map(\.name)) == Set(["required-a", "required-b"]))
        #expect(Set(result.removable.map(\.name)) == Set(["optional-a", "optional-b", "optional-c"]))
        #expect(result.trialCount > 0)
    }

    @Test func stateFingerprintUsesIdentitiesButNotValues() {
        let url = URL(string: "https://example.com/feed")!
        let first = CapturedWebState(url: url, items: [item("token", value: "secret-one")])
        let second = CapturedWebState(url: url, items: [item("token", value: "secret-two")])

        #expect(first.fingerprint == second.fingerprint)
        #expect(!first.fingerprint.contains("secret"))
    }

    @Test func healthAssessmentProtectsLoginAndExplicitSignals() {
        let baseline = HealthSnapshot(
            finalURL: "https://example.com/feed",
            readyState: "complete",
            title: "Feed",
            visibleTextLength: 500,
            explicitOK: true,
            sentinelFound: true,
            fatalErrorCount: 0
        )
        let loggedOut = HealthSnapshot(
            finalURL: "https://example.com/login",
            readyState: "complete",
            title: "Sign in",
            visibleTextLength: 400,
            explicitOK: false,
            sentinelFound: false,
            fatalErrorCount: 0
        )

        let assessment = loggedOut.assessment(relativeTo: baseline)
        #expect(!assessment.passed)
        #expect(assessment.reasons.count >= 3)
    }

    @Test func learnedPolicyEncodingCannotContainSnapshotValues() throws {
        let reference = item("required", value: "must-never-persist").reference
        let policy = LearnedPolicy(
            origin: "https://example.com",
            route: "/feed",
            stateFingerprint: "fingerprint",
            required: [reference],
            removable: [],
            uncertain: [],
            learnedAt: Date(timeIntervalSince1970: 1),
            expiresAt: Date(timeIntervalSince1970: 2),
            algorithmVersion: LearnedPolicy.currentAlgorithmVersion,
            trialCount: 1
        )
        let encoded = String(decoding: try JSONEncoder().encode(policy), as: UTF8.self)

        #expect(encoded.contains("required"))
        #expect(!encoded.contains("must-never-persist"))
    }

    @Test func policyStorePrunesExpiredAndOldAlgorithmPolicies() throws {
        let suiteName = "tidy.tests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let now = Date(timeIntervalSince1970: 1_000)
        let reference = item("optional").reference
        let policy = { (fingerprint: String, expiresAt: Date, version: Int) in
            LearnedPolicy(
                origin: "https://example.com",
                route: "/feed",
                stateFingerprint: fingerprint,
                required: [],
                removable: [reference],
                uncertain: [],
                learnedAt: now,
                expiresAt: expiresAt,
                algorithmVersion: version,
                trialCount: 1
            )
        }
        let encoded = try JSONEncoder().encode([
            policy("current", now.addingTimeInterval(60), LearnedPolicy.currentAlgorithmVersion),
            policy("expired", now.addingTimeInterval(-1), LearnedPolicy.currentAlgorithmVersion),
            policy("old", now.addingTimeInterval(60), LearnedPolicy.currentAlgorithmVersion - 1)
        ])
        defaults.set(encoded, forKey: LearningPolicyStore.storageKey)

        let policies = LearningPolicyStore(defaults: defaults).policies(at: now)
        #expect(policies.map(\.stateFingerprint) == ["current"])
        let persisted = try #require(defaults.data(forKey: LearningPolicyStore.storageKey))
        let decoded = try JSONDecoder().decode([LearnedPolicy].self, from: persisted)
        #expect(decoded == policies)
    }

}
