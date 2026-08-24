import Foundation
import WebKit

enum LearningWebKitError: LocalizedError {
    case invalidJavaScriptResult
    case navigationFailed(String)
    case navigationTimedOut

    var errorDescription: String? {
        switch self {
        case .invalidJavaScriptResult:
            return "The page returned an unreadable state snapshot."
        case .navigationFailed(let message):
            return "The isolated trial could not load: \(message)"
        case .navigationTimedOut:
            return "The isolated trial did not finish loading in time."
        }
    }
}

private struct StorageValues: Decodable {
    let localStorage: [String: String]
    let sessionStorage: [String: String]
}

enum LearningWebViewScripts {
    static let errorRecorder = WKUserScript(
        source: """
        (() => {
          window.__tidyFatalErrors = [];
          window.addEventListener("error", event => {
            window.__tidyFatalErrors.push(String(event.message || "Script error"));
          });
          window.addEventListener("unhandledrejection", event => {
            window.__tidyFatalErrors.push(String(event.reason || "Unhandled rejection"));
          });
        })();
        """,
        injectionTime: .atDocumentStart,
        forMainFrameOnly: true
    )

    static func storageSeed(items: [WebStateItem], origin: String) throws -> WKUserScript {
        let local = Dictionary(uniqueKeysWithValues: items
            .filter { $0.kind == .localStorage }
            .map { ($0.name, $0.value) })
        let session = Dictionary(uniqueKeysWithValues: items
            .filter { $0.kind == .sessionStorage }
            .map { ($0.name, $0.value) })
        let originJSON = try jsonLiteral(origin)
        let localJSON = try jsonLiteral(local)
        let sessionJSON = try jsonLiteral(session)
        return WKUserScript(
            source: """
            (() => {
              if (location.origin !== \(originJSON)) return;
              const localValues = \(localJSON);
              const sessionValues = \(sessionJSON);
              for (const [key, value] of Object.entries(localValues)) localStorage.setItem(key, value);
              for (const [key, value] of Object.entries(sessionValues)) sessionStorage.setItem(key, value);
            })();
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
    }

    static func healthSource(sentinel: String?) throws -> String {
        let sentinelJSON = try jsonLiteral(sentinel ?? "")
        return """
        (() => {
          const configuredSentinel = \(sentinelJSON);
          let sentinelFound = null;
          if (configuredSentinel) {
            try { sentinelFound = document.querySelector(configuredSentinel) !== null; }
            catch (_) { sentinelFound = false; }
          }
          let explicitOK = null;
          if (typeof window.__tidyHealth === "boolean") explicitOK = window.__tidyHealth;
          else if (window.__tidyHealth && typeof window.__tidyHealth.ok === "boolean") {
            explicitOK = window.__tidyHealth.ok;
          }
          const visibleText = (document.body?.innerText || "").replace(/\\s+/g, " ").trim();
          return {
            finalURL: location.href,
            readyState: document.readyState,
            title: document.title || "",
            visibleTextLength: visibleText.length,
            explicitOK,
            sentinelFound,
            fatalErrorCount: Array.isArray(window.__tidyFatalErrors) ? window.__tidyFatalErrors.length : 0
          };
        })();
        """
    }

    private static func jsonLiteral(_ object: Any) throws -> String {
        let data = try JSONSerialization.data(withJSONObject: object, options: [.fragmentsAllowed])
        return String(decoding: data, as: UTF8.self)
    }
}

@MainActor
enum LearningWebStateCapture {
    static func capture(from webView: WKWebView) async throws -> CapturedWebState {
        guard let url = webView.url else {
            throw LearningWebKitError.invalidJavaScriptResult
        }
        async let cookies = cookiesForURL(url, in: webView.configuration.websiteDataStore.httpCookieStore)
        async let storage = storageValues(in: webView)
        let (capturedCookies, capturedStorage) = try await (cookies, storage)
        var items = capturedCookies.map(WebStateItem.cookie)
        items.append(contentsOf: capturedStorage.localStorage.map {
            WebStateItem.storage(kind: .localStorage, name: $0.key, value: $0.value)
        })
        items.append(contentsOf: capturedStorage.sessionStorage.map {
            WebStateItem.storage(kind: .sessionStorage, name: $0.key, value: $0.value)
        })
        return CapturedWebState(url: url, items: items.sorted { $0.id < $1.id })
    }

    static func health(in webView: WKWebView, sentinel: String?) async throws -> HealthSnapshot {
        let source = try LearningWebViewScripts.healthSource(sentinel: sentinel)
        let raw = try await evaluate(source, in: webView)
        return try decode(HealthSnapshot.self, from: raw)
    }

    private static func storageValues(in webView: WKWebView) async throws -> StorageValues {
        let raw = try await evaluate(
            """
            (() => {
              const read = storage => Object.fromEntries(
                Array.from({ length: storage.length }, (_, index) => storage.key(index))
                  .filter(Boolean)
                  .map(key => [key, storage.getItem(key) ?? ""])
              );
              return { localStorage: read(localStorage), sessionStorage: read(sessionStorage) };
            })();
            """,
            in: webView
        )
        return try decode(StorageValues.self, from: raw)
    }

    private static func cookiesForURL(_ url: URL, in store: WKHTTPCookieStore) async -> [HTTPCookie] {
        let allCookies = await withCheckedContinuation { continuation in
            store.getAllCookies { continuation.resume(returning: $0) }
        }
        guard let host = url.host?.lowercased() else { return [] }
        return allCookies.filter { cookie in
            let domain = cookie.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).lowercased()
            return host == domain || host.hasSuffix(".\(domain)")
        }
    }

    private static func evaluate(_ source: String, in webView: WKWebView) async throws -> Any {
        try await withCheckedThrowingContinuation { continuation in
            webView.evaluateJavaScript(source) { value, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let value {
                    continuation.resume(returning: value)
                } else {
                    continuation.resume(throwing: LearningWebKitError.invalidJavaScriptResult)
                }
            }
        }
    }

    private static func decode<Value: Decodable>(_ type: Value.Type, from raw: Any) throws -> Value {
        guard JSONSerialization.isValidJSONObject(raw) else {
            throw LearningWebKitError.invalidJavaScriptResult
        }
        let data = try JSONSerialization.data(withJSONObject: raw)
        return try JSONDecoder().decode(type, from: data)
    }
}

@MainActor
final class LearningTrialRunner {
    func evaluate(
        state: [WebStateItem],
        at url: URL,
        origin: String,
        sentinel: String?
    ) async throws -> HealthSnapshot {
        let session = LearningTrialSession(
            state: state,
            url: url,
            origin: origin,
            sentinel: sentinel
        )
        return try await session.run()
    }
}

@MainActor
private final class LearningTrialSession: NSObject, WKNavigationDelegate {
    private let state: [WebStateItem]
    private let url: URL
    private let origin: String
    private let sentinel: String?
    private var webView: WKWebView?
    private var navigationContinuation: CheckedContinuation<Void, Error>?

    init(state: [WebStateItem], url: URL, origin: String, sentinel: String?) {
        self.state = state
        self.url = url
        self.origin = origin
        self.sentinel = sentinel
    }

    func run() async throws -> HealthSnapshot {
        let store = WKWebsiteDataStore.nonPersistent()
        for item in state where item.kind == .cookie {
            guard let cookie = item.cookie?.makeCookie() else { continue }
            await withCheckedContinuation { continuation in
                store.httpCookieStore.setCookie(cookie) { continuation.resume() }
            }
        }

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = store
        configuration.userContentController.addUserScript(LearningWebViewScripts.errorRecorder)
        configuration.userContentController.addUserScript(
            try LearningWebViewScripts.storageSeed(items: state, origin: origin)
        )
        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 844), configuration: configuration)
        self.webView = webView
        webView.navigationDelegate = self

        try await withCheckedThrowingContinuation { continuation in
            navigationContinuation = continuation
            webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
            DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in
                guard let self, let pending = self.navigationContinuation else { return }
                self.navigationContinuation = nil
                self.webView?.stopLoading()
                pending.resume(throwing: LearningWebKitError.navigationTimedOut)
            }
        }
        try await Task.sleep(nanoseconds: 700_000_000)
        return try await LearningWebStateCapture.health(in: webView, sentinel: sentinel)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let continuation = navigationContinuation else { return }
        navigationContinuation = nil
        continuation.resume()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        finish(with: error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        finish(with: error)
    }

    private func finish(with error: Error) {
        guard let continuation = navigationContinuation else { return }
        navigationContinuation = nil
        continuation.resume(throwing: LearningWebKitError.navigationFailed(error.localizedDescription))
    }
}
