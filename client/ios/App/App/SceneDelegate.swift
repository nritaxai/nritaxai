import UIKit
import WebKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else {
            return
        }

        let window = UIWindow(windowScene: windowScene)
        self.window = window

        WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
            let hasCookieToken = cookies.contains {
                $0.name == "token" &&
                !$0.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            }
            let hasPendingToken = UserDefaults.standard.string(forKey: "pendingAuthToken")?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .isEmpty == false

            DispatchQueue.main.async {
                #if DEBUG
                UserDefaults.standard.removeObject(forKey: "pendingInitialURL")
                UserDefaults.standard.removeObject(forKey: "pendingAuthToken")
                UserDefaults.standard.removeObject(forKey: "pendingAuthUser")
                window.rootViewController = NRITaxLoginViewController()
                #else
                if hasCookieToken || hasPendingToken {
                    window.rootViewController = ViewController()
                } else {
                    window.rootViewController = NRITaxLoginViewController()
                }
                #endif
                window.makeKeyAndVisible()
            }
        }
    }
}
