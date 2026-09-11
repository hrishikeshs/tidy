import StoreKit
import UIKit

@MainActor
final class TipJarStore {
    static let shared = TipJarStore()

    static let productIDs = [
        "io.hrishi.tidy.tip.small",
        "io.hrishi.tidy.tip.generous",
        "io.hrishi.tidy.tip.amazing"
    ]

    enum PurchaseOutcome {
        case purchased
        case cancelled
        case pending
    }

    enum StoreError: Error {
        case failedVerification
    }

    private var transactionListener: Task<Void, Never>?

    private init() {
        transactionListener = Task(priority: .background) {
            for await result in Transaction.updates {
                guard !Task.isCancelled else { return }
                guard case .verified(let transaction) = result,
                      Self.productIDs.contains(transaction.productID) else {
                    continue
                }
                await transaction.finish()
            }
        }
    }

    deinit {
        transactionListener?.cancel()
    }

    func loadProducts() async throws -> [Product] {
        try await Product.products(for: Self.productIDs).sorted { $0.price < $1.price }
    }

    func purchase(_ product: Product) async throws -> PurchaseOutcome {
        switch try await product.purchase() {
        case .success(let result):
            guard case .verified(let transaction) = result else {
                throw StoreError.failedVerification
            }
            await transaction.finish()
            return .purchased
        case .userCancelled:
            return .cancelled
        case .pending:
            return .pending
        @unknown default:
            return .cancelled
        }
    }
}

final class TipJarViewController: UIViewController {
    private let store = TipJarStore.shared
    private let contentStack = UIStackView()
    private let productStack = UIStackView()
    private let activityIndicator = UIActivityIndicatorView(style: .medium)
    private let statusLabel = UILabel()
    private var productButtons: [UIButton] = []
    private var loadTask: Task<Void, Never>?

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Support Tidy"
        view.backgroundColor = .systemGroupedBackground
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            systemItem: .done,
            primaryAction: UIAction { [weak self] _ in self?.dismiss(animated: true) }
        )
        configureLayout()
        loadProducts()
    }

    deinit {
        loadTask?.cancel()
    }

    private func configureLayout() {
        let scrollView = UIScrollView()
        scrollView.alwaysBounceVertical = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)

        contentStack.axis = .vertical
        contentStack.spacing = 18
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentStack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 24),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -28)
        ])

        let symbol = UIImageView(image: UIImage(systemName: "heart.fill"))
        symbol.tintColor = .systemBlue
        symbol.contentMode = .scaleAspectFit
        symbol.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 34, weight: .semibold)
        symbol.translatesAutoresizingMaskIntoConstraints = false

        let symbolBackground = UIView()
        symbolBackground.backgroundColor = .systemBlue.withAlphaComponent(0.12)
        symbolBackground.layer.cornerRadius = 34
        symbolBackground.addSubview(symbol)
        symbolBackground.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            symbolBackground.widthAnchor.constraint(equalToConstant: 68),
            symbolBackground.heightAnchor.constraint(equalToConstant: 68),
            symbol.centerXAnchor.constraint(equalTo: symbolBackground.centerXAnchor),
            symbol.centerYAnchor.constraint(equalTo: symbolBackground.centerYAnchor)
        ])

        let titleLabel = label(
            "Tidy is free for everyone.",
            font: .preferredFont(forTextStyle: .title2),
            color: .label,
            alignment: .center
        )
        titleLabel.font = .systemFont(ofSize: 24, weight: .bold)

        let explanation = label(
            "If Tidy saves you time, you can leave a one-time tip. Tipping is entirely optional and won’t unlock features or change how the app works.",
            font: .preferredFont(forTextStyle: .body),
            color: .secondaryLabel,
            alignment: .center
        )

        let hero = UIStackView(arrangedSubviews: [symbolBackground, titleLabel, explanation])
        hero.axis = .vertical
        hero.alignment = .center
        hero.spacing = 12
        hero.setCustomSpacing(18, after: symbolBackground)
        contentStack.addArrangedSubview(hero)

        let card = UIView()
        card.backgroundColor = .secondarySystemGroupedBackground
        card.layer.cornerRadius = 16
        card.layer.cornerCurve = .continuous
        productStack.axis = .vertical
        productStack.spacing = 10
        productStack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(productStack)
        NSLayoutConstraint.activate([
            productStack.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            productStack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            productStack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            productStack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16)
        ])
        contentStack.addArrangedSubview(card)

        activityIndicator.startAnimating()
        productStack.addArrangedSubview(activityIndicator)

        statusLabel.numberOfLines = 0
        statusLabel.textAlignment = .center
        statusLabel.textColor = .secondaryLabel
        statusLabel.font = .preferredFont(forTextStyle: .footnote)
        statusLabel.text = "Loading tip options…"
        productStack.addArrangedSubview(statusLabel)

        let privacy = label(
            "Purchases are handled by Apple. Tidy never receives your payment details.",
            font: .preferredFont(forTextStyle: .footnote),
            color: .tertiaryLabel,
            alignment: .center
        )
        privacy.accessibilityIdentifier = "tipjar.privacy"
        contentStack.addArrangedSubview(privacy)
    }

    private func loadProducts() {
        loadTask?.cancel()
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let products = try await store.loadProducts()
                guard !Task.isCancelled else { return }
                show(products: products)
            } catch {
                guard !Task.isCancelled else { return }
                showLoadingError()
            }
        }
    }

    private func show(products: [Product]) {
        activityIndicator.stopAnimating()
        activityIndicator.removeFromSuperview()
        statusLabel.removeFromSuperview()
        productButtons.removeAll()

        guard !products.isEmpty else {
            showLoadingError()
            return
        }

        for product in products {
            var configuration = UIButton.Configuration.filled()
            configuration.cornerStyle = .large
            configuration.baseBackgroundColor = .systemBlue
            configuration.title = product.displayName
            configuration.subtitle = product.displayPrice
            configuration.titleAlignment = .center
            configuration.contentInsets = NSDirectionalEdgeInsets(top: 11, leading: 14, bottom: 11, trailing: 14)

            let button = UIButton(configuration: configuration, primaryAction: UIAction { [weak self] _ in
                guard let self else { return }
                Task { await self.purchase(product) }
            })
            button.accessibilityIdentifier = "tipjar.\(product.id)"
            button.accessibilityHint = "Makes an optional one-time purchase. No features are unlocked."
            button.heightAnchor.constraint(greaterThanOrEqualToConstant: 54).isActive = true
            productButtons.append(button)
            productStack.addArrangedSubview(button)
        }
    }

    private func showLoadingError() {
        activityIndicator.stopAnimating()
        activityIndicator.removeFromSuperview()
        statusLabel.removeFromSuperview()

        let message = label(
            "Tip options aren’t available right now.",
            font: .preferredFont(forTextStyle: .body),
            color: .secondaryLabel,
            alignment: .center
        )
        productStack.addArrangedSubview(message)

        var configuration = UIButton.Configuration.tinted()
        configuration.title = "Try Again"
        configuration.cornerStyle = .large
        let retry = UIButton(configuration: configuration)
        retry.addAction(UIAction { [weak self, weak retry] _ in
            message.removeFromSuperview()
            retry?.removeFromSuperview()
            guard let self else { return }
            self.productStack.addArrangedSubview(self.activityIndicator)
            self.productStack.addArrangedSubview(self.statusLabel)
            self.activityIndicator.startAnimating()
            self.loadProducts()
        }, for: .touchUpInside)
        retry.accessibilityIdentifier = "tipjar.retry"
        productStack.addArrangedSubview(retry)
    }

    private func purchase(_ product: Product) async {
        setButtons(enabled: false)
        defer { setButtons(enabled: true) }

        do {
            switch try await store.purchase(product) {
            case .purchased:
                presentMessage(
                    title: "Thank you!",
                    message: "Your support helps keep Tidy independent, private, and available to everyone."
                )
            case .pending:
                presentMessage(
                    title: "Purchase Pending",
                    message: "Apple is waiting for approval to complete this tip."
                )
            case .cancelled:
                break
            }
        } catch {
            presentMessage(
                title: "Couldn’t Complete Purchase",
                message: "No charge was made. Please try again later."
            )
        }
    }

    private func setButtons(enabled: Bool) {
        productButtons.forEach { $0.isEnabled = enabled }
    }

    private func presentMessage(title: String, message: String) {
        guard presentedViewController == nil else { return }
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    private func label(
        _ text: String,
        font: UIFont,
        color: UIColor,
        alignment: NSTextAlignment
    ) -> UILabel {
        let label = UILabel()
        label.text = text
        label.font = font
        label.textColor = color
        label.textAlignment = alignment
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        return label
    }
}
