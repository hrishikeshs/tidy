//
//  SceneDelegate.swift
//  Janitor Lab
//
//  Created by Hrishikesh S on 8/23/26.
//

import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let _ = (scene as? UIWindowScene) else { return }
        if let context = connectionOptions.urlContexts.first {
            DispatchQueue.main.async { [weak self] in
                self?.handle(context.url)
            }
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        handle(url)
    }

    private func handle(_ url: URL) {
        guard url.scheme == "tidy",
              url.host == "learn",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let rawTarget = components.queryItems?.first(where: { $0.name == "url" })?.value,
              let target = URL(string: rawTarget),
              let root = window?.rootViewController as? ViewController else {
            return
        }
        root.openLearningLab(url: target)
    }

}
