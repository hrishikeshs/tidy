//
//  SafariWebExtensionHandler.swift
//  Janitor Lab Extension
//
//  Created by Hrishikesh S on 8/23/26.
//

import SafariServices

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    private static let appGroupIdentifier = "group.io.hrishi.tidy"
    private static let policyStorageKey = "tidy.learningPolicies.v1"
    private static let currentAlgorithmVersion = 1

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem
        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        let payload: [String: Any]
        if let body = message as? [String: Any], body["action"] as? String == "learningPolicy" {
            payload = responseForLearningPolicy(message: body)
        } else {
            payload = ["error": "Unsupported native message action."]
        }

        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: payload]
        } else {
            response.userInfo = ["message": payload]
        }

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

    private func responseForLearningPolicy(message: [String: Any]) -> [String: Any] {
        guard let requestedOrigin = message["origin"] as? String,
              let requestedRoute = message["route"] as? String else {
            return ["error": "An origin and route are required."]
        }
        guard let defaults = UserDefaults(suiteName: Self.appGroupIdentifier),
              let data = defaults.data(forKey: Self.policyStorageKey),
              let object = try? JSONSerialization.jsonObject(with: data),
              let policies = object as? [[String: Any]] else {
            return ["available": false]
        }

        let now = Date().timeIntervalSinceReferenceDate
        let matching = policies.filter { policy in
            policy["origin"] as? String == requestedOrigin
                && policy["route"] as? String == requestedRoute
                && (policy["algorithmVersion"] as? NSNumber)?.intValue == Self.currentAlgorithmVersion
                && ((policy["expiresAt"] as? NSNumber)?.doubleValue ?? 0) > now
        }.sorted { left, right in
            ((left["learnedAt"] as? NSNumber)?.doubleValue ?? 0)
                > ((right["learnedAt"] as? NSNumber)?.doubleValue ?? 0)
        }

        guard let policy = matching.first else {
            return ["available": false]
        }
        return ["available": true, "policy": sanitized(policy: policy)]
    }

    private func sanitized(policy: [String: Any]) -> [String: Any] {
        var result: [String: Any] = [:]
        for key in [
            "origin", "route", "stateFingerprint", "learnedAt", "expiresAt",
            "algorithmVersion", "trialCount"
        ] {
            if let value = policy[key] {
                result[key] = value
            }
        }
        for key in ["required", "removable", "uncertain"] {
            let references = (policy[key] as? [[String: Any]] ?? []).compactMap(sanitizedReference)
            result[key] = references
        }
        return result
    }

    private func sanitizedReference(_ reference: [String: Any]) -> [String: Any]? {
        guard let kind = reference["kind"] as? String,
              let name = reference["name"] as? String else {
            return nil
        }
        var result: [String: Any] = ["kind": kind, "name": name]
        if let scope = reference["scope"] as? String {
            result["scope"] = scope
        }
        return result
    }
}
