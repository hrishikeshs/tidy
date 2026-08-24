import UIKit
import WebKit

@MainActor
final class LearningLabViewController: UIViewController, WKNavigationDelegate, UITextFieldDelegate {
    private static let profileIdentifier = UUID(uuidString: "7A3A7ED7-57AF-4CC9-9B35-C70828F14897")!
    private static let policyLifetime: TimeInterval = 14 * 24 * 60 * 60

    private let initialURL: URL
    private let policyStore = LearningPolicyStore()
    private var baselineState: CapturedWebState?
    private var baselineHealth: HealthSnapshot?
    private var didLoadInitialURL = false

    private lazy var addressField: UITextField = {
        let field = UITextField()
        field.borderStyle = .roundedRect
        field.autocapitalizationType = .none
        field.autocorrectionType = .no
        field.keyboardType = .URL
        field.returnKeyType = .go
        field.text = initialURL.absoluteString
        field.accessibilityIdentifier = "learning.address"
        field.delegate = self
        return field
    }()

    private lazy var webView: WKWebView = {
        let configuration = WKWebViewConfiguration()
        if #available(iOS 17.0, *) {
            configuration.websiteDataStore = WKWebsiteDataStore(forIdentifier: Self.profileIdentifier)
        } else {
            configuration.websiteDataStore = .default()
        }
        configuration.userContentController.addUserScript(LearningWebViewScripts.errorRecorder)
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = self
        view.allowsBackForwardNavigationGestures = true
        view.accessibilityIdentifier = "learning.webview"
        return view
    }()

    private let statusLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .footnote)
        label.textColor = .secondaryLabel
        label.numberOfLines = 0
        label.text = "Use the isolated browser until it represents the state you want to preserve."
        label.accessibilityIdentifier = "learning.status"
        return label
    }()

    private let sentinelField: UITextField = {
        let field = UITextField()
        field.borderStyle = .roundedRect
        field.autocapitalizationType = .none
        field.autocorrectionType = .no
        field.placeholder = "Optional CSS sentinel, e.g. [aria-label='Profile']"
        field.accessibilityIdentifier = "learning.sentinel"
        return field
    }()

    private let captureButton: UIButton = {
        var configuration = UIButton.Configuration.filled()
        configuration.title = "Capture baseline"
        let button = UIButton(configuration: configuration)
        button.accessibilityIdentifier = "learning.capture"
        return button
    }()

    private let learnButton: UIButton = {
        var configuration = UIButton.Configuration.tinted()
        configuration.title = "Learn minimal state"
        let button = UIButton(configuration: configuration)
        button.isEnabled = false
        button.accessibilityIdentifier = "learning.run"
        return button
    }()

    private let progressView: UIProgressView = {
        let progress = UIProgressView(progressViewStyle: .default)
        progress.progress = 0
        progress.accessibilityIdentifier = "learning.progress"
        return progress
    }()

    private let resultView: UITextView = {
        let view = UITextView()
        view.isEditable = false
        view.isScrollEnabled = true
        view.backgroundColor = .secondarySystemBackground
        view.layer.cornerRadius = 12
        view.font = .preferredFont(forTextStyle: .footnote)
        view.textContainerInset = UIEdgeInsets(top: 10, left: 10, bottom: 10, right: 10)
        view.text = "No baseline captured yet. Snapshot values remain in this app's memory; learned policies contain names and outcomes only."
        view.accessibilityIdentifier = "learning.result"
        return view
    }()

    init(initialURL: URL) {
        self.initialURL = initialURL
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Learning Clean"
        view.backgroundColor = .systemBackground
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .done,
            target: self,
            action: #selector(close)
        )
        configureLayout()
        captureButton.addTarget(self, action: #selector(captureBaseline), for: .touchUpInside)
        learnButton.addTarget(self, action: #selector(runLearning), for: .touchUpInside)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !didLoadInitialURL else { return }
        didLoadInitialURL = true
        loadAddress()
    }

    private func configureLayout() {
        let loadButton = UIButton(type: .system)
        loadButton.setTitle("Go", for: .normal)
        loadButton.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        loadButton.accessibilityIdentifier = "learning.go"
        loadButton.addTarget(self, action: #selector(loadAddress), for: .touchUpInside)

        let addressRow = UIStackView(arrangedSubviews: [addressField, loadButton])
        addressRow.axis = .horizontal
        addressRow.spacing = 8
        loadButton.setContentHuggingPriority(.required, for: .horizontal)

        let actionRow = UIStackView(arrangedSubviews: [captureButton, learnButton])
        actionRow.axis = .horizontal
        actionRow.distribution = .fillEqually
        actionRow.spacing = 10

        let controls = UIStackView(arrangedSubviews: [
            addressRow,
            statusLabel,
            webView,
            sentinelField,
            actionRow,
            progressView,
            resultView
        ])
        controls.axis = .vertical
        controls.spacing = 10
        controls.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(controls)

        NSLayoutConstraint.activate([
            controls.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 14),
            controls.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -14),
            controls.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 10),
            controls.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -10),
            webView.heightAnchor.constraint(greaterThanOrEqualToConstant: 310),
            resultView.heightAnchor.constraint(equalToConstant: 120)
        ])
    }

    @objc private func close() {
        dismiss(animated: true)
    }

    @objc private func loadAddress() {
        guard let rawValue = addressField.text?.trimmingCharacters(in: .whitespacesAndNewlines),
              let url = URL(string: rawValue),
              ["http", "https"].contains(url.scheme?.lowercased() ?? "") else {
            showError("Enter a complete HTTP or HTTPS URL.")
            return
        }
        baselineState = nil
        baselineHealth = nil
        learnButton.isEnabled = false
        statusLabel.text = "Loading the isolated Tidy profile…"
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        loadAddress()
        return true
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        addressField.text = webView.url?.absoluteString
        statusLabel.text = "Ready. Confirm that this page represents the signed-in experience you want to preserve, then capture it."
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showError(error.localizedDescription)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showError(error.localizedDescription)
    }

    @objc private func captureBaseline() {
        setBusy(true)
        Task { @MainActor in
            defer { setBusy(false) }
            do {
                let state = try await LearningWebStateCapture.capture(from: webView)
                let health = try await LearningWebStateCapture.health(
                    in: webView,
                    sentinel: normalizedSentinel
                )
                if health.explicitOK == false {
                    throw LearningWebKitError.navigationFailed("The page's own health signal is currently failing.")
                }
                baselineState = state
                baselineHealth = health
                learnButton.isEnabled = !state.items.isEmpty
                progressView.progress = 0
                let counts = Dictionary(grouping: state.items, by: \.kind).mapValues(\.count)
                resultView.text = """
                Captured \(state.items.count) state items in memory.
                Cookies: \(counts[.cookie, default: 0]) · localStorage: \(counts[.localStorage, default: 0]) · sessionStorage: \(counts[.sessionStorage, default: 0])

                Values will be copied only into isolated on-device trials. Tap Learn minimal state to begin.
                """
                statusLabel.text = "Baseline captured. The live Tidy Lab profile will not be mutated by the trials."
            } catch {
                showError(error.localizedDescription)
            }
        }
    }

    @objc private func runLearning() {
        guard let baselineState, let baselineHealth else { return }
        setBusy(true)
        learnButton.isEnabled = false
        let targetURL = canonicalTrialURL(from: baselineState.url)
        let sentinel = normalizedSentinel
        let runner = LearningTrialRunner()

        Task { @MainActor in
            defer {
                setBusy(false)
                learnButton.isEnabled = true
            }
            do {
                let result = try await LearningDeltaDebugger.minimize(
                    items: baselineState.items,
                    evaluate: { candidate in
                        let health = try await runner.evaluate(
                            state: candidate,
                            at: targetURL,
                            origin: baselineState.origin,
                            sentinel: sentinel
                        )
                        return health.assessment(relativeTo: baselineHealth).passed
                    },
                    progress: { [weak self] progress in
                        guard let self else { return }
                        let total = max(1, baselineState.items.count * 2)
                        self.progressView.progress = min(0.95, Float(progress.trial) / Float(total))
                        self.statusLabel.text = "Trial \(progress.trial): removed \(progress.attemptedRemovalCount), \(progress.passed ? "page passed" : "page failed") · \(progress.retainedCount) retained."
                    }
                )
                let now = Date()
                let policy = LearnedPolicy(
                    origin: baselineState.origin,
                    route: targetURL.path.isEmpty ? "/" : targetURL.path,
                    stateFingerprint: baselineState.fingerprint,
                    required: result.required.map(\.reference),
                    removable: result.removable.map(\.reference),
                    uncertain: [],
                    learnedAt: now,
                    expiresAt: now.addingTimeInterval(Self.policyLifetime),
                    algorithmVersion: LearnedPolicy.currentAlgorithmVersion,
                    trialCount: result.trialCount
                )
                policyStore.save(policy)
                progressView.progress = 1
                statusLabel.text = "Learning complete. This names-only policy is versioned by the observed state fingerprint and expires in 14 days."
                resultView.text = summary(for: policy)
                resultView.accessibilityLabel = "Required \(policy.required.count), removable \(policy.removable.count). \(resultView.text ?? "")"
            } catch {
                showError(error.localizedDescription)
            }
        }
    }

    private var normalizedSentinel: String? {
        let value = sentinelField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return value.isEmpty ? nil : value
    }

    private func canonicalTrialURL(from url: URL) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url }
        components.queryItems = components.queryItems?.filter { $0.name != "tidy_seed" }
        if components.queryItems?.isEmpty == true {
            components.queryItems = nil
        }
        components.fragment = nil
        return components.url ?? url
    }

    private func summary(for policy: LearnedPolicy) -> String {
        func names(_ references: [WebStateReference]) -> String {
            references.isEmpty
                ? "None"
                : references.map { "\($0.kind.rawValue):\($0.name)" }.joined(separator: "\n")
        }
        return """
        Required \(policy.required.count) · removable \(policy.removable.count) · \(policy.trialCount) trials

        REQUIRED
        \(names(policy.required))

        REMOVABLE
        \(names(policy.removable))
        """
    }

    private func setBusy(_ busy: Bool) {
        captureButton.isEnabled = !busy
        addressField.isEnabled = !busy
        sentinelField.isEnabled = !busy
        if busy {
            progressView.progress = max(progressView.progress, 0.03)
        }
    }

    private func showError(_ message: String) {
        statusLabel.text = "Could not continue."
        resultView.text = message
        resultView.accessibilityLabel = message
        setBusy(false)
    }
}
