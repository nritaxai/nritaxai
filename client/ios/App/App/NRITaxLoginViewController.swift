import AuthenticationServices
import GoogleSignIn
import UIKit
import WebKit

final class NRITaxLoginViewController: UIViewController {
    private let appleAuthEndpoint = URL(string: "https://api.nritax.ai/api/auth/apple")
    private let googleNativeAuthEndpoint = URL(string: "https://api.nritax.ai/api/auth/google-native")!
    private let googleLegacyAuthEndpoint = URL(string: "https://api.nritax.ai/api/auth/google-login")!
    private let googleIOSClientID = "307987125319-mq3d5tpu3pfc8l32ncgddjr0sh68i83k.apps.googleusercontent.com"
    private let emailLoginEndpoint = URL(string: "https://api.nritax.ai/api/auth/login")!
    private let emailSignupEndpoint = URL(string: "https://api.nritax.ai/api/auth/register")!
    #if DEBUG
    private lazy var homeURL = bundledWebAppURL(path: "/home")
    private lazy var loginURL = bundledWebAppURL(path: "/login?mode=login")
    private lazy var signupURL = bundledWebAppURL(path: "/login?mode=signup")
    #else
    private static let webAppBaseURL = "https://nritax.ai"
    private let homeURL = URL(string: "\(NRITaxLoginViewController.webAppBaseURL)/home")!
    private let loginURL = URL(string: "\(NRITaxLoginViewController.webAppBaseURL)/login?mode=login")!
    private let signupURL = URL(string: "\(NRITaxLoginViewController.webAppBaseURL)/login?mode=signup")!
    #endif
    private let demoCredentialsMessage = "Having trouble? Use demo@nritax.ai / Demo@123456"

    private let gradientLayer = CAGradientLayer()
    private let gridLayer = CAShapeLayer()
    private let appNameLabel = UILabel()
    private let skipButton = UIButton(type: .system)
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let buttonsStack = UIStackView()
    private let footerRow = UIStackView()
    private let signupLabel = UILabel()
    private let infoButton = UIButton(type: .system)

    private var orbViews: [UIView] = []
    private var rupeeLabels: [UILabel] = []
    private var animatedViews: [UIView] = []
    private var appleFailureCount = 0

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .dark
        view.backgroundColor = UIColor(hex: "050D1A")
        configureBackground()
        configureTopBar()
        configureHeroText()
        configureButtons()
        configureFooter()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        gradientLayer.frame = view.bounds
        gridLayer.frame = view.bounds
        drawGrid()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        runEntranceAnimations()
        startOrbPulseAnimations()
        startRupeeDriftAnimations()
    }

    private func configureBackground() {
        gradientLayer.colors = [
            UIColor(hex: "0A1628").cgColor,
            UIColor(hex: "1A3A6B").cgColor,
            UIColor(hex: "050D1A").cgColor
        ]
        gradientLayer.locations = [0.0, 0.48, 1.0]
        view.layer.addSublayer(gradientLayer)

        gridLayer.strokeColor = UIColor.white.withAlphaComponent(0.05).cgColor
        gridLayer.fillColor = UIColor.clear.cgColor
        gridLayer.lineWidth = 1
        view.layer.addSublayer(gridLayer)

        addOrb(color: UIColor(hex: "2563EB"), alpha: 0.3, size: 210, xMultiplier: 0.78, yMultiplier: 0.12)
        addOrb(color: UIColor(hex: "1D4ED8"), alpha: 0.2, size: 170, xMultiplier: 0.02, yMultiplier: 0.78)
        addOrb(color: UIColor(hex: "3B82F6"), alpha: 0.15, size: 120, xMultiplier: 0.08, yMultiplier: 0.1)
        addOrb(color: UIColor(hex: "60A5FA"), alpha: 0.14, size: 145, xMultiplier: 0.72, yMultiplier: 0.7)
        addRupeeSymbols()
    }

    private func drawGrid() {
        let path = UIBezierPath()
        let columnWidth: CGFloat = 56
        let rowHeight: CGFloat = 42

        stride(from: CGFloat(0), through: view.bounds.width, by: columnWidth).forEach { x in
            path.move(to: CGPoint(x: x, y: 0))
            path.addLine(to: CGPoint(x: x, y: view.bounds.height))
        }

        stride(from: CGFloat(0), through: view.bounds.height, by: rowHeight).forEach { y in
            path.move(to: CGPoint(x: 0, y: y))
            path.addLine(to: CGPoint(x: view.bounds.width, y: y))
        }

        gridLayer.path = path.cgPath
    }

    private func addOrb(color: UIColor, alpha: CGFloat, size: CGFloat, xMultiplier: CGFloat, yMultiplier: CGFloat) {
        let orb = UIView()
        orb.translatesAutoresizingMaskIntoConstraints = false
        orb.backgroundColor = color.withAlphaComponent(alpha)
        orb.layer.cornerRadius = size / 2
        orb.layer.shadowColor = color.cgColor
        orb.layer.shadowOpacity = Float(alpha)
        orb.layer.shadowRadius = 42
        orb.layer.shadowOffset = .zero
        view.addSubview(orb)
        orbViews.append(orb)

        NSLayoutConstraint.activate([
            orb.widthAnchor.constraint(equalToConstant: size),
            orb.heightAnchor.constraint(equalToConstant: size),
            orb.centerXAnchor.constraint(equalTo: view.leadingAnchor, constant: UIScreen.main.bounds.width * xMultiplier),
            orb.centerYAnchor.constraint(equalTo: view.topAnchor, constant: UIScreen.main.bounds.height * yMultiplier)
        ])
    }

    private func addRupeeSymbols() {
        let sizes: [CGFloat] = [20, 24, 28, 34, 42, 50, 60, 32, 46, 26, 54, 22]
        let xPositions: [CGFloat] = [0.12, 0.72, 0.28, 0.86, 0.48, 0.08, 0.63, 0.34, 0.78, 0.18, 0.55, 0.92]
        let yPositions: [CGFloat] = [0.17, 0.22, 0.36, 0.44, 0.52, 0.66, 0.72, 0.82, 0.9, 0.58, 0.3, 0.76]

        for index in sizes.indices {
            let label = UILabel()
            label.translatesAutoresizingMaskIntoConstraints = false
            label.text = "₹"
            label.font = .systemFont(ofSize: sizes[index], weight: .semibold)
            label.textColor = UIColor(hex: "C9A84C").withAlphaComponent(0.15)
            label.textAlignment = .center
            view.addSubview(label)
            rupeeLabels.append(label)

            NSLayoutConstraint.activate([
                label.centerXAnchor.constraint(equalTo: view.leadingAnchor, constant: UIScreen.main.bounds.width * xPositions[index]),
                label.centerYAnchor.constraint(equalTo: view.topAnchor, constant: UIScreen.main.bounds.height * yPositions[index])
            ])
        }
    }

    private func configureTopBar() {
        appNameLabel.translatesAutoresizingMaskIntoConstraints = false
        appNameLabel.attributedText = NSAttributedString(
            string: "NRITAX.AI",
            attributes: [
                .font: UIFont.systemFont(ofSize: 16, weight: .medium),
                .foregroundColor: UIColor.white.withAlphaComponent(0.9),
                .kern: 3
            ]
        )
        appNameLabel.textAlignment = .center
        view.addSubview(appNameLabel)

        skipButton.translatesAutoresizingMaskIntoConstraints = false
        skipButton.setImage(UIImage(systemName: "xmark"), for: .normal)
        skipButton.tintColor = UIColor.white.withAlphaComponent(0.7)
        skipButton.addTarget(self, action: #selector(skipToWebLogin), for: .touchUpInside)
        view.addSubview(skipButton)

        NSLayoutConstraint.activate([
            appNameLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 22),
            appNameLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),

            skipButton.centerYAnchor.constraint(equalTo: appNameLabel.centerYAnchor),
            skipButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -18),
            skipButton.widthAnchor.constraint(equalToConstant: 44),
            skipButton.heightAnchor.constraint(equalToConstant: 44)
        ])
    }

    private func configureHeroText() {
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.text = "Welcome back"
        titleLabel.font = .systemFont(ofSize: 40, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 0
        titleLabel.adjustsFontSizeToFitWidth = true
        titleLabel.minimumScaleFactor = 0.82
        view.addSubview(titleLabel)

        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.text = "Sign in to manage your\nNRI taxes with AI."
        subtitleLabel.font = .systemFont(ofSize: 18, weight: .regular)
        subtitleLabel.textColor = UIColor.white.withAlphaComponent(0.65)
        subtitleLabel.textAlignment = .center
        subtitleLabel.numberOfLines = 0
        view.addSubview(subtitleLabel)

        let titleCenterConstraint = titleLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -92)
        titleCenterConstraint.priority = .defaultHigh

        NSLayoutConstraint.activate([
            titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            titleCenterConstraint,
            titleLabel.topAnchor.constraint(greaterThanOrEqualTo: appNameLabel.bottomAnchor, constant: 72),
            titleLabel.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 28),
            titleLabel.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -28),

            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 14),
            subtitleLabel.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 32),
            subtitleLabel.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -32)
        ])
    }

    private func configureButtons() {
        buttonsStack.translatesAutoresizingMaskIntoConstraints = false
        buttonsStack.axis = .vertical
        buttonsStack.spacing = 12
        view.addSubview(buttonsStack)

        let appleButton = pillButton(
            title: "Apple sign in →",
            foregroundColor: UIColor(hex: "1A1A1A"),
            backgroundColor: UIColor(hex: "F5F0E8"),
            icon: UIImage(systemName: "apple.logo"),
            iconTint: .black
        )
        appleButton.addTarget(self, action: #selector(startAppleSignIn), for: .touchUpInside)

        let googleButton = pillButton(
            title: "Google sign in →",
            foregroundColor: UIColor(hex: "1A1A1A"),
            backgroundColor: UIColor(hex: "FFFFFF"),
            customIcon: GoogleIconView(),
            bordered: true
        )
        googleButton.addTarget(self, action: #selector(startGoogleSignIn), for: .touchUpInside)

        let emailButton = pillButton(
            title: "Log in with email →",
            foregroundColor: .white,
            backgroundColor: .clear,
            icon: UIImage(systemName: "envelope"),
            iconTint: .white,
            bordered: true
        )
        emailButton.addTarget(self, action: #selector(openEmailLogin), for: .touchUpInside)

        let signupButton = pillButton(
            title: "Create account →",
            foregroundColor: .white,
            backgroundColor: .clear,
            icon: UIImage(systemName: "person.crop.circle.badge.plus"),
            iconTint: .white,
            bordered: true
        )
        signupButton.addTarget(self, action: #selector(openSignup), for: .touchUpInside)

        [appleButton, googleButton, emailButton, signupButton].forEach { button in
            button.alpha = 0
            button.transform = CGAffineTransform(translationX: 0, y: 34)
            buttonsStack.addArrangedSubview(button)
            button.heightAnchor.constraint(equalToConstant: button === googleButton ? 58 : 52).isActive = true
            animatedViews.append(button)
        }

        NSLayoutConstraint.activate([
            buttonsStack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            buttonsStack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
            buttonsStack.topAnchor.constraint(greaterThanOrEqualTo: subtitleLabel.bottomAnchor, constant: 28),
            buttonsStack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -58)
        ])
    }

    private func configureFooter() {
        footerRow.translatesAutoresizingMaskIntoConstraints = false
        footerRow.axis = .horizontal
        footerRow.alignment = .center
        footerRow.distribution = .equalCentering
        view.addSubview(footerRow)

        signupLabel.translatesAutoresizingMaskIntoConstraints = false
        signupLabel.attributedText = signupText()
        signupLabel.textAlignment = .center
        signupLabel.isUserInteractionEnabled = true
        signupLabel.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(openSignup)))

        infoButton.translatesAutoresizingMaskIntoConstraints = false
        infoButton.setImage(UIImage(systemName: "info.circle"), for: .normal)
        infoButton.tintColor = UIColor.white.withAlphaComponent(0.5)
        infoButton.addTarget(self, action: #selector(showInfo), for: .touchUpInside)

        footerRow.addArrangedSubview(UIView())
        footerRow.addArrangedSubview(signupLabel)
        footerRow.addArrangedSubview(infoButton)

        NSLayoutConstraint.activate([
            footerRow.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            footerRow.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
            footerRow.topAnchor.constraint(equalTo: buttonsStack.bottomAnchor, constant: 18),
            footerRow.bottomAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -14),

            infoButton.widthAnchor.constraint(equalToConstant: 44),
            infoButton.heightAnchor.constraint(equalToConstant: 32)
        ])
    }

    private func pillButton(
        title: String,
        foregroundColor: UIColor,
        backgroundColor: UIColor,
        icon: UIImage? = nil,
        iconTint: UIColor = .white,
        customIcon: UIView? = nil,
        bordered: Bool = false
    ) -> UIButton {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.backgroundColor = backgroundColor
        button.layer.cornerRadius = 29
        button.layer.cornerCurve = .continuous
        button.clipsToBounds = true
        button.tintColor = foregroundColor
        if bordered {
            button.layer.borderWidth = 1.5
            button.layer.borderColor = UIColor.white.withAlphaComponent(0.6).cgColor
        }

        let iconView: UIView
        if let customIcon {
            iconView = customIcon
        } else {
            let imageView = UIImageView(image: icon)
            imageView.tintColor = iconTint
            imageView.contentMode = .scaleAspectFit
            iconView = imageView
        }

        let label = UILabel()
        label.text = title
        label.font = .systemFont(ofSize: 17, weight: .medium)
        label.textColor = foregroundColor
        label.textAlignment = .center

        let row = UIStackView(arrangedSubviews: [iconView, label])
        row.translatesAutoresizingMaskIntoConstraints = false
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 12
        row.isUserInteractionEnabled = false
        button.addSubview(row)

        iconView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            iconView.widthAnchor.constraint(equalToConstant: 22),
            iconView.heightAnchor.constraint(equalToConstant: 22),
            row.centerXAnchor.constraint(equalTo: button.centerXAnchor),
            row.centerYAnchor.constraint(equalTo: button.centerYAnchor),
            row.leadingAnchor.constraint(greaterThanOrEqualTo: button.leadingAnchor, constant: 22),
            row.trailingAnchor.constraint(lessThanOrEqualTo: button.trailingAnchor, constant: -22)
        ])

        return button
    }

    private func signupText() -> NSAttributedString {
        let text = NSMutableAttributedString(
            string: "Need an account? ",
            attributes: [
                .font: UIFont.systemFont(ofSize: 14, weight: .regular),
                .foregroundColor: UIColor.white.withAlphaComponent(0.65)
            ]
        )
        text.append(
            NSAttributedString(
                string: "Sign up →",
                attributes: [
                    .font: UIFont.systemFont(ofSize: 14, weight: .regular),
                    .foregroundColor: UIColor.white,
                    .underlineStyle: NSUnderlineStyle.single.rawValue
                ]
            )
        )
        return text
    }

    private func runEntranceAnimations() {
        let entranceItems: [(UIView, TimeInterval, TimeInterval, CGFloat)] = [
            (titleLabel, 0.6, 0.2, 32),
            (subtitleLabel, 0.5, 0.4, 18)
        ]

        for item in entranceItems {
            item.0.alpha = 0
            item.0.transform = CGAffineTransform(translationX: 0, y: item.3)
            UIView.animate(withDuration: item.1, delay: item.2, options: [.curveEaseOut]) {
                item.0.alpha = 1
                item.0.transform = .identity
            }
        }

        for (index, view) in animatedViews.enumerated() {
            UIView.animate(withDuration: 0.4, delay: 0.5 + Double(index) * 0.1, options: [.curveEaseOut]) {
                view.alpha = 1
                view.transform = .identity
            }
        }
    }

    private func startOrbPulseAnimations() {
        for (index, orb) in orbViews.enumerated() {
            UIView.animate(
                withDuration: 3.0 + Double(index) * 0.25,
                delay: Double(index) * 0.15,
                options: [.autoreverse, .repeat, .allowUserInteraction, .curveEaseInOut]
            ) {
                orb.transform = CGAffineTransform(scaleX: 1.12, y: 1.12)
                orb.alpha = 0.72
            }
        }
    }

    private func startRupeeDriftAnimations() {
        for (index, label) in rupeeLabels.enumerated() {
            label.layer.removeAllAnimations()
            let animation = CABasicAnimation(keyPath: "transform.translation.y")
            animation.fromValue = 40
            animation.toValue = -80
            animation.duration = 20 + Double(index % 4) * 2
            animation.repeatCount = .infinity
            animation.autoreverses = false
            animation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            animation.beginTime = CACurrentMediaTime() + Double(index) * 0.6
            label.layer.add(animation, forKey: "rupeeDrift")
        }
    }

    @objc private func skipToWebLogin() {
        UserDefaults.standard.set(homeURL.absoluteString, forKey: "pendingInitialURL")
        transitionToMainApp(token: nil)
    }

    @objc private func openEmailLogin() {
        presentEmailAuth(mode: .login)
    }

    @objc private func openSignup() {
        presentEmailAuth(mode: .signup)
    }

    private func presentEmailAuth(mode: NativeEmailAuthViewController.Mode) {
        let authController = NativeEmailAuthViewController(
            mode: mode,
            loginEndpoint: emailLoginEndpoint,
            signupEndpoint: emailSignupEndpoint
        )
        authController.modalPresentationStyle = .fullScreen
        authController.onCancel = { [weak self] in
            self?.dismiss(animated: true)
        }
        authController.onAuthenticated = { [weak self] token, userJSON in
            guard let self else { return }
            self.dismiss(animated: true) {
                if let userJSON, !userJSON.isEmpty {
                    UserDefaults.standard.set(userJSON, forKey: "pendingAuthUser")
                    UserDefaults.standard.set(userJSON, forKey: "nritaxNativeUser")
                }
                self.persistSessionCookie(token: token)
                self.transitionToMainApp(token: token)
            }
        }
        present(authController, animated: true)
    }

    @objc private func showInfo() {
        let alert = UIAlertController(
            title: "NRITAX.AI",
            message: "AI-powered tax guidance for Non-Resident Indians. Sign in to manage your tax profile, chat history, subscriptions, and filings.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    @objc private func startGoogleSignIn() {
        guard let rootVC = view.window?.rootViewController ?? UIApplication.shared.activeKeyWindow?.rootViewController else {
            return
        }

        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: googleIOSClientID)
        GIDSignIn.sharedInstance.signIn(withPresenting: rootVC) { [weak self] result, error in
            guard let self else { return }

            if let error {
                self.handleGoogleFailure(message: error.localizedDescription)
                return
            }

            guard let user = result?.user,
                  let idToken = user.idToken?.tokenString else {
                self.handleGoogleFailure(message: "Google sign-in failed")
                return
            }

            self.exchangeGoogleToken(
                idToken: idToken,
                accessToken: user.accessToken.tokenString
            )
        }
    }

    private func exchangeGoogleToken(idToken: String, accessToken: String) {
        var request = URLRequest(url: googleNativeAuthEndpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let body = [
            "idToken": idToken,
            "accessToken": accessToken
        ]

        do {
            request.httpBody = try JSONEncoder().encode(body)
        } catch {
            handleGoogleFailure(message: "Unable to prepare Google sign-in request.")
            return
        }

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self else { return }

                if let error {
                    self.handleGoogleFailure(message: error.localizedDescription)
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse, let data else {
                    self.handleGoogleFailure(message: "Google authentication failed")
                    return
                }

                do {
                    let json = try JSONDecoder().decode(NRITaxAppleBackendResponse.self, from: data)

                    guard (200...299).contains(httpResponse.statusCode) else {
                        if httpResponse.statusCode == 404,
                           (json.message ?? "").lowercased().contains("route not found") {
                            self.exchangeLegacyGoogleToken(idToken: idToken)
                            return
                        }
                        self.handleGoogleFailure(message: json.error ?? json.message ?? "Google authentication failed")
                        return
                    }

                    guard let token = json.token?.trimmingCharacters(in: .whitespacesAndNewlines), !token.isEmpty else {
                        self.handleGoogleFailure(message: "Google authentication failed")
                        return
                    }

                    self.injectAuthenticatedSession(token: token, user: json.user, displayName: json.user?.name)
                } catch {
                    self.handleGoogleFailure(message: "Google authentication failed")
                }
            }
        }.resume()
    }

    private func exchangeLegacyGoogleToken(idToken: String) {
        var request = URLRequest(url: googleLegacyAuthEndpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            request.httpBody = try JSONEncoder().encode(["credential": idToken])
        } catch {
            handleGoogleFailure(message: "Unable to prepare Google sign-in request.")
            return
        }

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self else { return }

                if let error {
                    self.handleGoogleFailure(message: error.localizedDescription)
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse, let data else {
                    self.handleGoogleFailure(message: "Google authentication failed")
                    return
                }

                do {
                    let json = try JSONDecoder().decode(NRITaxAppleBackendResponse.self, from: data)

                    guard (200...299).contains(httpResponse.statusCode) else {
                        self.handleGoogleFailure(message: json.error ?? json.message ?? "Google authentication failed")
                        return
                    }

                    guard let token = json.token?.trimmingCharacters(in: .whitespacesAndNewlines), !token.isEmpty else {
                        self.handleGoogleFailure(message: "Google authentication failed")
                        return
                    }

                    self.injectAuthenticatedSession(token: token, user: json.user, displayName: json.user?.name)
                } catch {
                    self.handleGoogleFailure(message: "Google authentication failed")
                }
            }
        }.resume()
    }

    private func handleGoogleFailure(message: String) {
        let alert = UIAlertController(
            title: "Google Sign-In Failed",
            message: message,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    #if DEBUG
    private func bundledWebAppURL(path: String) -> URL {
        guard let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "public") else {
            return URL(string: "https://nritax.ai\(path)")!
        }

        var components = URLComponents(url: indexURL, resolvingAgainstBaseURL: false)
        components?.fragment = path
        return components?.url ?? indexURL
    }
    #endif

    @objc private func startAppleSignIn() {
        logAppleSignIn("Starting native Apple sign-in flow.")
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.email, .fullName]

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        logAppleSignIn("Configured ASAuthorizationController with presentationContextProvider.")
        controller.performRequests()
    }

    private func exchangeAppleCredential(with credential: ASAuthorizationAppleIDCredential) {
        guard let endpoint = appleAuthEndpoint else {
            handleAppleFailure(message: "The Apple sign-in endpoint is not configured.")
            return
        }

        logAppleSignIn("Authorization succeeded. Beginning credential extraction.")

        guard let identityTokenData = credential.identityToken else {
            logAppleSignIn("identityToken extraction failed: credential.identityToken was nil.")
            handleAppleFailure(message: "identityToken extraction failed: Apple did not provide an identity token.")
            return
        }

        guard let identityToken = String(data: identityTokenData, encoding: .utf8), !identityToken.isEmpty else {
            logAppleSignIn("identityToken extraction failed: token data could not be converted to UTF-8.")
            handleAppleFailure(message: "identityToken extraction failed: Apple returned unreadable token data.")
            return
        }

        logAppleSignIn("identityToken extraction succeeded. length=\(identityToken.count)")

        guard let authorizationCodeData = credential.authorizationCode else {
            logAppleSignIn("authorizationCode extraction failed: credential.authorizationCode was nil.")
            handleAppleFailure(message: "authorizationCode extraction failed: Apple did not provide an authorization code.")
            return
        }

        guard let authorizationCode = String(data: authorizationCodeData, encoding: .utf8), !authorizationCode.isEmpty else {
            logAppleSignIn("authorizationCode extraction failed: code data could not be converted to UTF-8.")
            handleAppleFailure(message: "authorizationCode extraction failed: Apple returned unreadable authorization code data.")
            return
        }

        logAppleSignIn("authorizationCode extraction succeeded. length=\(authorizationCode.count)")

        let formatter = PersonNameComponentsFormatter()
        let fullName = credential.fullName.flatMap { formatter.string(from: $0).trimmingCharacters(in: .whitespacesAndNewlines) }
        let requestBody = NRITaxAppleBackendRequest(
            identityToken: identityToken,
            authorizationCode: authorizationCode,
            email: credential.email,
            fullName: fullName?.isEmpty == true ? nil : fullName,
            name: fullName?.isEmpty == true ? nil : fullName,
            user: NRITaxAppleBackendRequest.UserPayload(
                name: NRITaxAppleBackendRequest.NamePayload(
                    firstName: credential.fullName?.givenName,
                    lastName: credential.fullName?.familyName
                )
            )
        )

        var request = URLRequest(url: endpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            request.httpBody = try JSONEncoder().encode(requestBody)
            logAppleSignIn("Encoded backend POST body successfully for \(endpoint.absoluteString).")
        } catch {
            logAppleSignIn("Failed to encode backend request body: \(error.localizedDescription)")
            handleAppleFailure(message: "Unable to prepare the Apple sign-in request: \(error.localizedDescription)")
            return
        }

        let sessionConfiguration = URLSessionConfiguration.default
        sessionConfiguration.timeoutIntervalForRequest = 30
        sessionConfiguration.timeoutIntervalForResource = 30
        let session = URLSession(configuration: sessionConfiguration)

        logAppleSignIn("Sending POST request to \(endpoint.absoluteString) with 30 second timeout.")

        session.dataTask(with: request) { [weak self] data, response, error in
            guard let self else {
                return
            }

            if let error {
                DispatchQueue.main.async {
                    let nsError = error as NSError
                    self.logAppleSignIn("POST /api/auth/apple failed: \(nsError.domain) (\(nsError.code)) \(error.localizedDescription)")
                    if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorTimedOut {
                        self.handleAppleFailure(message: "Authentication timed out. Please try again.")
                    } else {
                        self.handleAppleFailure(message: "POST /api/auth/apple failed: \(error.localizedDescription)")
                    }
                }
                return
            }

            guard let httpResponse = response as? HTTPURLResponse else {
                DispatchQueue.main.async {
                    self.logAppleSignIn("POST /api/auth/apple failed: response was not HTTPURLResponse.")
                    self.handleAppleFailure(message: "POST /api/auth/apple failed: invalid server response.")
                }
                return
            }

            guard let data else {
                DispatchQueue.main.async {
                    self.logAppleSignIn("POST /api/auth/apple returned status \(httpResponse.statusCode) with empty body.")
                    self.handleAppleFailure(message: "POST /api/auth/apple failed: empty server response.")
                }
                return
            }

            let responseText = String(data: data, encoding: .utf8) ?? "<non-utf8 response>"

            do {
                let backendResponse = try JSONDecoder().decode(NRITaxAppleBackendResponse.self, from: data)
                let token = backendResponse.token?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                self.logAppleSignIn("Response parsing succeeded. status=\(httpResponse.statusCode) success=\(backendResponse.success ?? false) tokenLength=\(token.count)")

                guard (200...299).contains(httpResponse.statusCode) else {
                    let message = backendResponse.error ?? backendResponse.message ?? "Apple sign-in could not be completed."
                    DispatchQueue.main.async {
                        self.handleAppleFailure(message: message)
                    }
                    return
                }

                guard !token.isEmpty else {
                    DispatchQueue.main.async {
                        self.logAppleSignIn("Backend returned an invalid or empty token.")
                        self.handleAppleFailure(message: "Sign in failed. Please try demo@nritax.ai / Demo@123456 instead.")
                    }
                    return
                }

                DispatchQueue.main.async {
                    self.injectAuthenticatedSession(token: token, user: backendResponse.user, displayName: backendResponse.user?.name)
                }
            } catch {
                DispatchQueue.main.async {
                    self.logAppleSignIn("Response parsing failed: \(error.localizedDescription). body=\(responseText)")
                    self.handleAppleFailure(message: "Response parsing failed: \(error.localizedDescription)\n\nServer response: \(responseText)")
                }
            }
        }.resume()
    }

    private func injectAuthenticatedSession(token: String, user: NRITaxAppleBackendUser?, displayName: String?) {
        let trimmedToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedToken.isEmpty else {
            logAppleSignIn("Session injection aborted because token was empty.")
            handleAppleFailure(message: "Sign in failed. Please try demo@nritax.ai / Demo@123456 instead.")
            return
        }

        logAppleSignIn("Preparing session handoff into WKWebView. tokenLength=\(trimmedToken.count)")
        persistSessionCookie(token: trimmedToken)

        if let data = try? JSONEncoder().encode(user), let json = String(data: data, encoding: .utf8) {
            UserDefaults.standard.set(json, forKey: "pendingAuthUser")
            UserDefaults.standard.set(json, forKey: "nritaxNativeUser")
        }

        appleFailureCount = 0
        transitionToMainApp(token: trimmedToken)
    }

    private func handleAppleFailure(message: String) {
        appleFailureCount += 1
        logAppleSignIn("Apple sign-in failure #\(appleFailureCount): \(message)")
        showAlert(title: "Apple Sign-In Failed", message: decorateAppleFailureMessage(message))
    }

    private func logAppleSignIn(_ message: String) {
        print("[nritax-ios][apple-auth] \(message)")
    }

    private func decorateAppleFailureMessage(_ message: String) -> String {
        guard appleFailureCount >= 2 else {
            return message
        }
        return "\(message)\n\n\(demoCredentialsMessage)"
    }

    private func persistSessionCookie(token: String) {
        guard
            let cookie = HTTPCookie(properties: [
                .domain: ".nritax.ai",
                .path: "/",
                .name: "token",
                .value: token,
                .secure: true,
                .expires: Date().addingTimeInterval(60 * 60 * 24 * 7)
            ])
        else {
            logAppleSignIn("Cookie creation failed for token persistence.")
            return
        }

        WKWebsiteDataStore.default().httpCookieStore.setCookie(cookie)
    }

    private func transitionToMainApp(token: String?) {
        let mainVC = ViewController()
        if let token {
            UserDefaults.standard.set(token, forKey: "pendingAuthToken")
        }

        guard let window = view.window else {
            return
        }

        UIView.transition(
            with: window,
            duration: 0.5,
            options: .transitionCrossDissolve,
            animations: {
                window.rootViewController = mainVC
            }
        )
    }

    private func showAlert(title: String = "NRITAX.AI", message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

extension NRITaxLoginViewController: ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        view.window ?? ASPresentationAnchor()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        logAppleSignIn("ASAuthorizationController completed successfully.")
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            handleAppleFailure(message: "Apple did not return an Apple ID credential.")
            return
        }

        exchangeAppleCredential(with: credential)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let nsError = error as NSError
        let message: String

        logAppleSignIn("ASAuthorizationController failed: \(nsError.domain) (\(nsError.code)) \(error.localizedDescription)")

        if nsError.domain == ASAuthorizationError.errorDomain,
           let authorizationError = ASAuthorizationError.Code(rawValue: nsError.code) {
            switch authorizationError {
            case .canceled:
                return
            case .failed:
                message = "Apple could not complete the sign-in request."
            case .invalidResponse:
                message = "Apple returned an invalid response."
            case .notHandled:
                message = "The Apple sign-in request was not handled."
            case .notInteractive:
                message = "Apple sign-in requires an interactive request."
            case .unknown:
                message = "An unknown Apple sign-in error occurred."
            case .matchedExcludedCredential:
                message = "Apple rejected the credential because it matched an excluded account."
            case .credentialImport:
                message = "Apple could not import the credential for this request."
            case .credentialExport:
                message = "Apple could not export the credential for this request."
            case .preferSignInWithApple:
                message = "This account should continue with Sign in with Apple."
            case .deviceNotConfiguredForPasskeyCreation:
                message = "This device is not configured for passkey creation."
            @unknown default:
                message = "An unexpected Apple sign-in error occurred."
            }
        } else {
            message = error.localizedDescription
        }

        handleAppleFailure(message: message)
    }
}

private final class NativeEmailAuthViewController: UIViewController {
    enum Mode {
        case login
        case signup
    }

    var onCancel: (() -> Void)?
    var onAuthenticated: ((String, String?) -> Void)?

    private let mode: Mode
    private let loginEndpoint: URL
    private let signupEndpoint: URL
    private let gradientLayer = CAGradientLayer()
    private let scrollView = UIScrollView()
    private let contentView = UIView()
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let segmentedControl = UISegmentedControl(items: ["Log in", "Sign up"])
    private let formStack = UIStackView()
    private let nameField = UITextField()
    private let emailField = UITextField()
    private let linkedinField = UITextField()
    private let passwordField = UITextField()
    private let confirmPasswordField = UITextField()
    private let errorLabel = UILabel()
    private let submitButton = UIButton(type: .system)
    private let switchButton = UIButton(type: .system)
    private let closeButton = UIButton(type: .system)
    private let activityIndicator = UIActivityIndicatorView(style: .medium)

    private var activeMode: Mode

    init(mode: Mode, loginEndpoint: URL, signupEndpoint: URL) {
        self.mode = mode
        self.activeMode = mode
        self.loginEndpoint = loginEndpoint
        self.signupEndpoint = signupEndpoint
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .dark
        view.backgroundColor = UIColor(hex: "050D1A")
        configureBackground()
        configureLayout()
        configureKeyboardDismissal()
        applyMode(animated: false)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        gradientLayer.frame = view.bounds
    }

    private func configureBackground() {
        gradientLayer.colors = [
            UIColor(hex: "0A1628").cgColor,
            UIColor(hex: "1A3A6B").cgColor,
            UIColor(hex: "050D1A").cgColor
        ]
        gradientLayer.locations = [0.0, 0.5, 1.0]
        view.layer.addSublayer(gradientLayer)
    }

    private func configureLayout() {
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.setImage(UIImage(systemName: "chevron.left"), for: .normal)
        closeButton.tintColor = .white
        closeButton.backgroundColor = UIColor.white.withAlphaComponent(0.12)
        closeButton.layer.cornerRadius = 22
        closeButton.addTarget(self, action: #selector(handleClose), for: .touchUpInside)
        view.addSubview(closeButton)

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.keyboardDismissMode = .interactive
        view.addSubview(scrollView)

        contentView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentView)

        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .systemFont(ofSize: 34, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.numberOfLines = 0
        contentView.addSubview(titleLabel)

        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.font = .systemFont(ofSize: 16, weight: .regular)
        subtitleLabel.textColor = UIColor.white.withAlphaComponent(0.68)
        subtitleLabel.numberOfLines = 0
        contentView.addSubview(subtitleLabel)

        segmentedControl.translatesAutoresizingMaskIntoConstraints = false
        segmentedControl.selectedSegmentTintColor = UIColor(hex: "F5F0E8")
        segmentedControl.setTitleTextAttributes([.foregroundColor: UIColor.white], for: .normal)
        segmentedControl.setTitleTextAttributes([.foregroundColor: UIColor(hex: "111827")], for: .selected)
        segmentedControl.selectedSegmentIndex = activeMode == .login ? 0 : 1
        segmentedControl.addTarget(self, action: #selector(handleModeChanged), for: .valueChanged)
        contentView.addSubview(segmentedControl)

        formStack.translatesAutoresizingMaskIntoConstraints = false
        formStack.axis = .vertical
        formStack.spacing = 12
        contentView.addSubview(formStack)

        configureTextField(nameField, placeholder: "Full name", icon: "person")
        configureTextField(emailField, placeholder: "Email address", icon: "envelope")
        configureTextField(linkedinField, placeholder: "LinkedIn profile URL (optional)", icon: "link")
        configureTextField(passwordField, placeholder: "Password", icon: "lock")
        configureTextField(confirmPasswordField, placeholder: "Confirm password", icon: "lock.shield")

        emailField.keyboardType = .emailAddress
        emailField.autocapitalizationType = .none
        emailField.textContentType = .username
        linkedinField.keyboardType = .URL
        linkedinField.autocapitalizationType = .none
        passwordField.isSecureTextEntry = true
        passwordField.textContentType = .password
        confirmPasswordField.isSecureTextEntry = true
        confirmPasswordField.textContentType = .newPassword

        [nameField, emailField, linkedinField, passwordField, confirmPasswordField].forEach { field in
            formStack.addArrangedSubview(field)
            field.heightAnchor.constraint(equalToConstant: 56).isActive = true
        }

        errorLabel.translatesAutoresizingMaskIntoConstraints = false
        errorLabel.font = .systemFont(ofSize: 13, weight: .medium)
        errorLabel.textColor = UIColor(hex: "FCA5A5")
        errorLabel.numberOfLines = 0
        errorLabel.isHidden = true
        contentView.addSubview(errorLabel)

        submitButton.translatesAutoresizingMaskIntoConstraints = false
        submitButton.backgroundColor = UIColor(hex: "F5F0E8")
        submitButton.tintColor = UIColor(hex: "111827")
        submitButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        submitButton.layer.cornerRadius = 29
        submitButton.addTarget(self, action: #selector(handleSubmit), for: .touchUpInside)
        contentView.addSubview(submitButton)

        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        activityIndicator.hidesWhenStopped = true
        submitButton.addSubview(activityIndicator)

        switchButton.translatesAutoresizingMaskIntoConstraints = false
        switchButton.tintColor = .white
        switchButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .medium)
        switchButton.addTarget(self, action: #selector(handleSwitchMode), for: .touchUpInside)
        contentView.addSubview(switchButton)

        NSLayoutConstraint.activate([
            closeButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            closeButton.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 18),
            closeButton.widthAnchor.constraint(equalToConstant: 44),
            closeButton.heightAnchor.constraint(equalToConstant: 44),

            scrollView.topAnchor.constraint(equalTo: closeButton.bottomAnchor, constant: 8),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            contentView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),

            titleLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 52),
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),

            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 10),
            subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            subtitleLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),

            segmentedControl.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 26),
            segmentedControl.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            segmentedControl.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            segmentedControl.heightAnchor.constraint(equalToConstant: 42),

            formStack.topAnchor.constraint(equalTo: segmentedControl.bottomAnchor, constant: 24),
            formStack.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            formStack.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),

            errorLabel.topAnchor.constraint(equalTo: formStack.bottomAnchor, constant: 12),
            errorLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            errorLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),

            submitButton.topAnchor.constraint(equalTo: errorLabel.bottomAnchor, constant: 18),
            submitButton.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            submitButton.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            submitButton.heightAnchor.constraint(equalToConstant: 58),

            activityIndicator.trailingAnchor.constraint(equalTo: submitButton.trailingAnchor, constant: -22),
            activityIndicator.centerYAnchor.constraint(equalTo: submitButton.centerYAnchor),

            switchButton.topAnchor.constraint(equalTo: submitButton.bottomAnchor, constant: 18),
            switchButton.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            switchButton.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -38)
        ])
    }

    private func configureTextField(_ field: UITextField, placeholder: String, icon: String) {
        field.translatesAutoresizingMaskIntoConstraints = false
        field.backgroundColor = UIColor.white.withAlphaComponent(0.12)
        field.textColor = .white
        field.tintColor = .white
        field.layer.cornerRadius = 18
        field.layer.borderWidth = 1
        field.layer.borderColor = UIColor.white.withAlphaComponent(0.14).cgColor
        field.font = .systemFont(ofSize: 16, weight: .regular)
        field.attributedPlaceholder = NSAttributedString(
            string: placeholder,
            attributes: [.foregroundColor: UIColor.white.withAlphaComponent(0.46)]
        )

        let imageView = UIImageView(image: UIImage(systemName: icon))
        imageView.tintColor = UIColor.white.withAlphaComponent(0.65)
        imageView.contentMode = .scaleAspectFit
        let wrapper = UIView(frame: CGRect(x: 0, y: 0, width: 48, height: 56))
        imageView.frame = CGRect(x: 17, y: 17, width: 20, height: 20)
        wrapper.addSubview(imageView)
        field.leftView = wrapper
        field.leftViewMode = .always
        field.returnKeyType = .next
        field.delegate = self
    }

    private func configureKeyboardDismissal() {
        let tap = UITapGestureRecognizer(target: self, action: #selector(endEditing))
        tap.cancelsTouchesInView = false
        view.addGestureRecognizer(tap)
    }

    private func applyMode(animated: Bool) {
        let changes = {
            let isSignup = self.activeMode == .signup
            self.segmentedControl.selectedSegmentIndex = isSignup ? 1 : 0
            self.titleLabel.text = isSignup ? "Create account" : "Welcome back"
            self.subtitleLabel.text = isSignup
                ? "Set up your NRITAX.AI account to manage NRI taxes with AI."
                : "Log in with your email and password to continue."
            self.nameField.isHidden = !isSignup
            self.linkedinField.isHidden = !isSignup
            self.confirmPasswordField.isHidden = !isSignup
            self.submitButton.setTitle(isSignup ? "Create account →" : "Log in →", for: .normal)
            self.switchButton.setTitle(
                isSignup ? "Already have an account? Log in" : "Need an account? Create one",
                for: .normal
            )
            self.setError(nil)
        }

        animated ? UIView.animate(withDuration: 0.22, animations: changes) : changes()
    }

    @objc private func handleModeChanged() {
        activeMode = segmentedControl.selectedSegmentIndex == 0 ? .login : .signup
        applyMode(animated: true)
    }

    @objc private func handleSwitchMode() {
        activeMode = activeMode == .login ? .signup : .login
        applyMode(animated: true)
    }

    @objc private func handleClose() {
        onCancel?()
    }

    @objc private func endEditing() {
        view.endEditing(true)
    }

    @objc private func handleSubmit() {
        view.endEditing(true)
        setError(nil)

        let email = (emailField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let password = passwordField.text ?? ""

        guard isValidEmail(email) else {
            setError("Please enter a valid email address.")
            return
        }

        guard !password.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            setError("Please enter your password.")
            return
        }

        if activeMode == .signup {
            let name = (nameField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let confirmPassword = confirmPasswordField.text ?? ""
            guard !name.isEmpty else {
                setError("Please enter your full name.")
                return
            }
            guard password.count >= 6 else {
                setError("Password must be at least 6 characters.")
                return
            }
            guard password == confirmPassword else {
                setError("Passwords do not match.")
                return
            }
            let linkedin = (linkedinField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if !linkedin.isEmpty, !linkedin.lowercased().contains("linkedin.com") {
                setError("LinkedIn profile must be a linkedin.com URL.")
                return
            }
            submitSignup(name: name, email: email, linkedin: linkedin, password: password, confirmPassword: confirmPassword)
        } else {
            submitLogin(email: email, password: password)
        }
    }

    private func submitLogin(email: String, password: String) {
        sendAuthRequest(
            endpoint: loginEndpoint,
            payload: ["email": email, "password": password]
        )
    }

    private func submitSignup(name: String, email: String, linkedin: String, password: String, confirmPassword: String) {
        sendAuthRequest(
            endpoint: signupEndpoint,
            payload: [
                "name": name,
                "email": email,
                "linkedinProfile": linkedin,
                "password": password,
                "confirmPassword": confirmPassword
            ]
        )
    }

    private func sendAuthRequest(endpoint: URL, payload: [String: String]) {
        setLoading(true)
        var request = URLRequest(url: endpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload, options: [])
        } catch {
            setLoading(false)
            setError("Could not prepare the request.")
            return
        }

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self else { return }
                self.setLoading(false)

                if let error {
                    self.setError("Authentication failed: \(error.localizedDescription)")
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse, let data else {
                    self.setError("The server returned an invalid response.")
                    return
                }

                do {
                    let authResponse = try JSONDecoder().decode(NRITaxEmailAuthResponse.self, from: data)
                    guard (200...299).contains(httpResponse.statusCode) else {
                        self.setError(authResponse.message ?? authResponse.error ?? "Authentication failed.")
                        return
                    }

                    guard let token = authResponse.token?.trimmingCharacters(in: .whitespacesAndNewlines), !token.isEmpty else {
                        self.setError("Authentication succeeded but no session token was returned.")
                        return
                    }

                    let userJSON = self.normalizedUserJSON(from: authResponse.user, fallback: payload)

                    self.onAuthenticated?(token, userJSON)
                } catch {
                    let body = String(data: data, encoding: .utf8) ?? ""
                    self.setError(body.isEmpty ? "Could not read the server response." : body)
                }
            }
        }.resume()
    }

    private func normalizedUserJSON(from user: NRITaxAppleBackendUser?, fallback: [String: String]) -> String? {
        var object: [String: Any] = [:]
        if let data = try? JSONEncoder().encode(user),
           let decoded = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            object = decoded
        }

        if (object["name"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true,
           let name = fallback["name"]?.trimmingCharacters(in: .whitespacesAndNewlines),
           !name.isEmpty {
            object["name"] = name
        }

        if (object["email"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true,
           let email = fallback["email"]?.trimmingCharacters(in: .whitespacesAndNewlines),
           !email.isEmpty {
            object["email"] = email
        }

        if (object["linkedinProfile"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true,
           let linkedIn = fallback["linkedinProfile"]?.trimmingCharacters(in: .whitespacesAndNewlines),
           !linkedIn.isEmpty {
            object["linkedinProfile"] = linkedIn
        }

        if object["provider"] == nil {
            object["provider"] = "local"
        }

        guard !object.isEmpty,
              let data = try? JSONSerialization.data(withJSONObject: object, options: []),
              let json = String(data: data, encoding: .utf8) else {
            return nil
        }
        return json
    }

    private func setLoading(_ loading: Bool) {
        submitButton.isEnabled = !loading
        segmentedControl.isEnabled = !loading
        loading ? activityIndicator.startAnimating() : activityIndicator.stopAnimating()
        submitButton.alpha = loading ? 0.72 : 1
    }

    private func setError(_ message: String?) {
        errorLabel.text = message
        errorLabel.isHidden = message == nil
    }

    private func isValidEmail(_ email: String) -> Bool {
        let pattern = #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#
        return email.range(of: pattern, options: .regularExpression) != nil
    }
}

extension NativeEmailAuthViewController: UITextFieldDelegate {
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        let orderedFields = activeMode == .signup
            ? [nameField, emailField, linkedinField, passwordField, confirmPasswordField]
            : [emailField, passwordField]

        guard let index = orderedFields.firstIndex(of: textField) else {
            textField.resignFirstResponder()
            return true
        }

        if index + 1 < orderedFields.count {
            orderedFields[index + 1].becomeFirstResponder()
        } else {
            textField.resignFirstResponder()
            handleSubmit()
        }

        return true
    }
}

private final class GoogleIconView: UIView {
    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        contentMode = .redraw
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func draw(_ rect: CGRect) {
        let inset = min(rect.width, rect.height) * 0.12
        let bounds = rect.insetBy(dx: inset, dy: inset)
        let center = CGPoint(x: bounds.midX, y: bounds.midY)
        let radius = min(bounds.width, bounds.height) / 2
        let lineWidth = max(2.4, min(rect.width, rect.height) * 0.16)

        func strokeArc(color: UIColor, start: CGFloat, end: CGFloat) {
            let path = UIBezierPath(
                arcCenter: center,
                radius: radius - lineWidth / 2,
                startAngle: start,
                endAngle: end,
                clockwise: true
            )
            path.lineWidth = lineWidth
            path.lineCapStyle = .round
            color.setStroke()
            path.stroke()
        }

        strokeArc(color: UIColor(hex: "EA4335"), start: -.pi * 0.86, end: -.pi * 0.2)
        strokeArc(color: UIColor(hex: "FBBC05"), start: -.pi * 0.2, end: .pi * 0.24)
        strokeArc(color: UIColor(hex: "34A853"), start: .pi * 0.24, end: .pi * 0.74)
        strokeArc(color: UIColor(hex: "4285F4"), start: .pi * 0.74, end: .pi * 1.18)

        let crossbar = UIBezierPath()
        crossbar.move(to: CGPoint(x: center.x, y: center.y))
        crossbar.addLine(to: CGPoint(x: bounds.maxX - lineWidth * 0.2, y: center.y))
        crossbar.lineWidth = lineWidth
        crossbar.lineCapStyle = .butt
        UIColor(hex: "4285F4").setStroke()
        crossbar.stroke()

        let innerBlue = UIBezierPath(
            arcCenter: center,
            radius: radius - lineWidth / 2,
            startAngle: 0,
            endAngle: .pi * 0.28,
            clockwise: true
        )
        innerBlue.lineWidth = lineWidth
        innerBlue.lineCapStyle = .butt
        UIColor(hex: "4285F4").setStroke()
        innerBlue.stroke()
    }
}

private struct NRITaxAppleBackendRequest: Encodable {
    struct UserPayload: Encodable {
        let name: NamePayload?
    }

    struct NamePayload: Encodable {
        let firstName: String?
        let lastName: String?
    }

    let identityToken: String
    let authorizationCode: String
    let email: String?
    let fullName: String?
    let name: String?
    let user: UserPayload?
}

private struct NRITaxAppleBackendResponse: Decodable {
    let success: Bool?
    let message: String?
    let error: String?
    let user: NRITaxAppleBackendUser?
    let token: String?
}

private struct NRITaxAppleBackendUser: Codable {
    let id: String?
    let _id: String?
    let name: String?
    let email: String?
    let provider: String?
    let profileImage: String?
}

private struct NRITaxEmailAuthResponse: Decodable {
    let success: Bool?
    let message: String?
    let error: String?
    let token: String?
    let user: NRITaxAppleBackendUser?
}

private extension UIApplication {
    var activeKeyWindow: UIWindow? {
        connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)
    }
}

private extension UIColor {
    convenience init(hex: String) {
        let scanner = Scanner(string: hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted))
        var value: UInt64 = 0
        scanner.scanHexInt64(&value)

        let red: CGFloat
        let green: CGFloat
        let blue: CGFloat
        let alpha: CGFloat

        switch hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted).count {
        case 3:
            red = CGFloat((value >> 8) & 0xF) / 15
            green = CGFloat((value >> 4) & 0xF) / 15
            blue = CGFloat(value & 0xF) / 15
            alpha = 1
        case 6:
            red = CGFloat((value >> 16) & 0xFF) / 255
            green = CGFloat((value >> 8) & 0xFF) / 255
            blue = CGFloat(value & 0xFF) / 255
            alpha = 1
        case 8:
            red = CGFloat((value >> 24) & 0xFF) / 255
            green = CGFloat((value >> 16) & 0xFF) / 255
            blue = CGFloat((value >> 8) & 0xFF) / 255
            alpha = CGFloat(value & 0xFF) / 255
        default:
            red = 1
            green = 1
            blue = 1
            alpha = 1
        }

        self.init(red: red, green: green, blue: blue, alpha: alpha)
    }
}
