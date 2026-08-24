import CryptoKit
import Foundation

enum WebStateKind: String, Codable, CaseIterable, Comparable {
    case cookie
    case localStorage
    case sessionStorage

    static func < (left: WebStateKind, right: WebStateKind) -> Bool {
        left.rawValue < right.rawValue
    }
}

struct CookieSnapshot: Codable, Hashable {
    let name: String
    let value: String
    let domain: String
    let path: String
    let expiresAt: Date?
    let isSecure: Bool
    let isHTTPOnly: Bool
    let sameSite: String?

    init(cookie: HTTPCookie) {
        name = cookie.name
        value = cookie.value
        domain = cookie.domain
        path = cookie.path
        expiresAt = cookie.expiresDate
        isSecure = cookie.isSecure
        isHTTPOnly = cookie.isHTTPOnly
        sameSite = cookie.properties?[HTTPCookiePropertyKey("SameSite")] as? String
    }

    func makeCookie() -> HTTPCookie? {
        var properties: [HTTPCookiePropertyKey: Any] = [
            .name: name,
            .value: value,
            .domain: domain,
            .path: path
        ]
        if let expiresAt {
            properties[.expires] = expiresAt
        }
        if isSecure {
            properties[.secure] = "TRUE"
        }
        if isHTTPOnly {
            properties[HTTPCookiePropertyKey("HttpOnly")] = "TRUE"
        }
        if let sameSite {
            properties[HTTPCookiePropertyKey("SameSite")] = sameSite
        }
        return HTTPCookie(properties: properties)
    }
}

struct WebStateItem: Codable, Hashable, Identifiable {
    let kind: WebStateKind
    let name: String
    let value: String
    let cookie: CookieSnapshot?

    var id: String {
        if let cookie {
            return "\(kind.rawValue):\(cookie.domain):\(cookie.path):\(name)"
        }
        return "\(kind.rawValue):\(name)"
    }

    var reference: WebStateReference {
        WebStateReference(kind: kind, name: name, scope: cookie.map { "\($0.domain)\($0.path)" })
    }

    static func cookie(_ cookie: HTTPCookie) -> WebStateItem {
        let snapshot = CookieSnapshot(cookie: cookie)
        return WebStateItem(kind: .cookie, name: cookie.name, value: cookie.value, cookie: snapshot)
    }

    static func storage(kind: WebStateKind, name: String, value: String) -> WebStateItem {
        precondition(kind != .cookie)
        return WebStateItem(kind: kind, name: name, value: value, cookie: nil)
    }
}

struct WebStateReference: Codable, Hashable, Identifiable {
    let kind: WebStateKind
    let name: String
    let scope: String?

    var id: String {
        "\(kind.rawValue):\(scope ?? ""):\(name)"
    }
}

struct CapturedWebState {
    let url: URL
    let items: [WebStateItem]

    var origin: String {
        guard let scheme = url.scheme, let host = url.host else { return url.absoluteString }
        let port = url.port.map { ":\($0)" } ?? ""
        return "\(scheme)://\(host)\(port)"
    }

    var fingerprint: String {
        let identities = items.map(\.id).sorted().joined(separator: "\n")
        return SHA256.hash(data: Data(identities.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }
}

struct HealthSnapshot: Codable, Equatable {
    let finalURL: String
    let readyState: String
    let title: String
    let visibleTextLength: Int
    let explicitOK: Bool?
    let sentinelFound: Bool?
    let fatalErrorCount: Int

    func assessment(relativeTo baseline: HealthSnapshot) -> HealthAssessment {
        var reasons: [String] = []
        let baselineURL = URL(string: baseline.finalURL)
        let candidateURL = URL(string: finalURL)

        if readyState != "complete" && readyState != "interactive" {
            reasons.append("The document did not finish loading.")
        }
        if let expected = Self.normalizedOrigin(baselineURL),
           Self.normalizedOrigin(candidateURL) != expected {
            reasons.append("Navigation left the baseline origin.")
        }
        let baselineLooksLoggedOut = Self.looksLikeLoginPath(baselineURL?.path ?? "")
        if !baselineLooksLoggedOut && Self.looksLikeLoginPath(candidateURL?.path ?? "") {
            reasons.append("The trial redirected to a login route.")
        }
        if baseline.explicitOK == true && explicitOK != true {
            reasons.append("The page's explicit health check failed.")
        } else if explicitOK == false {
            reasons.append("The page reported an explicit health failure.")
        }
        if baseline.sentinelFound == true && sentinelFound != true {
            reasons.append("The selected page sentinel disappeared.")
        }
        if baseline.visibleTextLength >= 80 {
            let minimumLength = max(40, Int(Double(baseline.visibleTextLength) * 0.35))
            if visibleTextLength < minimumLength {
                reasons.append("Visible content fell far below the baseline.")
            }
        }
        if fatalErrorCount > baseline.fatalErrorCount + 2 {
            reasons.append("The trial produced additional fatal script errors.")
        }
        return HealthAssessment(passed: reasons.isEmpty, reasons: reasons)
    }

    private static func looksLikeLoginPath(_ path: String) -> Bool {
        path.range(
            of: #"(?:^|/)(?:login|log-in|signin|sign-in|auth)(?:/|$)"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }

    private static func normalizedOrigin(_ url: URL?) -> String? {
        guard let url,
              let scheme = url.scheme?.lowercased(),
              let host = url.host?.lowercased() else {
            return nil
        }
        let port = url.port ?? (scheme == "https" ? 443 : scheme == "http" ? 80 : -1)
        return "\(scheme)://\(host):\(port)"
    }
}

struct HealthAssessment: Equatable {
    let passed: Bool
    let reasons: [String]
}

struct LearnedPolicy: Codable, Identifiable, Equatable {
    static let currentAlgorithmVersion = 1

    let origin: String
    let route: String
    let stateFingerprint: String
    let required: [WebStateReference]
    let removable: [WebStateReference]
    let uncertain: [WebStateReference]
    let learnedAt: Date
    let expiresAt: Date
    let algorithmVersion: Int
    let trialCount: Int

    var id: String {
        "\(origin)|\(route)|\(stateFingerprint)|\(algorithmVersion)"
    }

    func isExpired(at date: Date = Date()) -> Bool {
        expiresAt <= date
    }
}

final class LearningPolicyStore {
    static let appGroupIdentifier = "group.io.hrishi.tidy"
    static let storageKey = "tidy.learningPolicies.v1"

    private let defaults: UserDefaults

    init(defaults: UserDefaults = UserDefaults(suiteName: LearningPolicyStore.appGroupIdentifier) ?? .standard) {
        self.defaults = defaults
    }

    func policies(at date: Date = Date()) -> [LearnedPolicy] {
        guard let data = defaults.data(forKey: Self.storageKey),
              let decoded = try? JSONDecoder().decode([LearnedPolicy].self, from: data) else {
            return []
        }
        let current = decoded.filter {
            !$0.isExpired(at: date) && $0.algorithmVersion == LearnedPolicy.currentAlgorithmVersion
        }
        if current.count != decoded.count {
            replace(with: current)
        }
        return current
    }

    func save(_ policy: LearnedPolicy) {
        var current = policies().filter { $0.id != policy.id }
        current.append(policy)
        replace(with: current.sorted { $0.learnedAt > $1.learnedAt })
    }

    private func replace(with policies: [LearnedPolicy]) {
        guard let data = try? JSONEncoder().encode(policies) else { return }
        defaults.set(data, forKey: Self.storageKey)
    }
}
