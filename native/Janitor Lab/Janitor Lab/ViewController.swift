//
//  ViewController.swift
//  Janitor Lab
//
//  Created by Hrishikesh S on 8/23/26.
//

import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!
    private let tipJar = TipJarStore.shared
    private var didHandleLaunchEnvironment = false

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self
        self.webView.scrollView.isScrollEnabled = true
        self.webView.scrollView.alwaysBounceVertical = false

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Override point for customization.
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "controller",
              let payload = message.body as? [String: Any],
              let action = payload["action"] as? String else {
            return
        }

        switch action {
        case "openTipJar":
            openTipJar()
        case "openLearningLab":
            let url = (payload["url"] as? String).flatMap(URL.init(string:))
            openLearningLab(url: url)
        case "openExternal":
            guard let rawURL = payload["url"] as? String,
                  let url = URL(string: rawURL),
                  url.scheme == "https" else {
                return
            }
            UIApplication.shared.open(url)
        default:
            return
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !didHandleLaunchEnvironment else { return }
        didHandleLaunchEnvironment = true
        if let rawURL = ProcessInfo.processInfo.environment["TIDY_LEARNING_FIXTURE_URL"],
           let url = URL(string: rawURL) {
            openLearningLab(url: url)
        }
    }

    func openLearningLab(url: URL?) {
        guard presentedViewController == nil else { return }
        let learningLab = LearningLabViewController(initialURL: url)
        let navigation = UINavigationController(rootViewController: learningLab)
        navigation.modalPresentationStyle = .fullScreen
        present(navigation, animated: true)
    }

    func openTipJar() {
        guard presentedViewController == nil else { return }
        let tipJar = TipJarViewController()
        let navigation = UINavigationController(rootViewController: tipJar)
        navigation.modalPresentationStyle = .fullScreen
        present(navigation, animated: true)
    }

}
