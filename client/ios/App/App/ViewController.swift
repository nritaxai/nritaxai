import AuthenticationServices
import SafariServices
import UIKit
import UniformTypeIdentifiers
import WebKit

/// Hosts the nritax.ai web experience inside a review-safe WKWebView wrapper.
final class ViewController: UIViewController {
    #if DEBUG
    // Debug builds load the bundled Vite output so device testing does not depend on a local dev server.
    private lazy var appURL = bundledWebAppURL(path: "/home")
    private lazy var homeURL = bundledWebAppURL(path: "/home")
    private lazy var dashboardURL = bundledWebAppURL(path: "/home")
    #else
    // Release/TestFlight/App Store builds load the deployed site.
    private let appURL = URL(string: "https://nritax.ai/home")
    private let homeURL = URL(string: "https://nritax.ai/home")
    private let dashboardURL = URL(string: "https://nritax.ai/home")
    #endif
    private let appleAuthEndpoint = URL(string: "https://api.nritax.ai/api/auth/apple")
    private let allowedHostSuffix = "nritax.ai"
    private let cacheResetKey = "com.nritaxai.cacheResetCompleted"
    private let demoCredentialsMessage = "Having trouble? Use demo@nritax.ai / Demo@123456"

    private lazy var webView: WKWebView = {
        let webView = WKWebView(frame: .zero, configuration: buildWebViewConfiguration())
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = true
        
        // FIX: Replace custom user agent with full Safari user agent for reCAPTCHA
        webView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 NRITAXIOSWrapper/1.0"
        
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = true
        webView.backgroundColor = .white
        webView.scrollView.backgroundColor = .white
        return webView
    }()

    private let activityIndicator = UIActivityIndicatorView(style: .large)
    private let retryContainer = UIStackView()
    private let retryTitleLabel = UILabel()
    private let retryMessageLabel = UILabel()
    private let retryButton = UIButton(type: .system)
    private let appleOverlay = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterial))
    private lazy var appleButton: ASAuthorizationAppleIDButton = {
        let button = ASAuthorizationAppleIDButton(type: .signIn, style: .black)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.cornerRadius = 12
        button.addTarget(self, action: #selector(handleAppleButtonPressed), for: .touchUpInside)
        return button
    }()
    private let appleOverlayLabel = UILabel()

    private lazy var backButton: UIButton = {
        let button = UIButton(type: .system)
        button.setImage(UIImage(systemName: "chevron.left"), for: .normal)
        button.tintColor = .black
        button.backgroundColor = .white
        button.layer.cornerRadius = 22
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOpacity = 0.2
        button.layer.shadowOffset = CGSize(width: 0, height: 2)
        button.layer.shadowRadius = 4
        button.translatesAutoresizingMaskIntoConstraints = false
        button.addTarget(self, action: #selector(handleBackButtonPressed), for: .touchUpInside)
        button.isHidden = true
        button.alpha = 0.0
        return button
    }()

    private var bottomConstraint: NSLayoutConstraint?
    private var hasFinishedInitialLoad = false
    private var lastFailedURL: URL?
    private var lastRequestedURL: URL?
    private var activePageURL: URL?
    private var isHandlingAppleSignIn = false
    private var appleFailureCount = 0
    private weak var expertResumeField: UITextField?
    private weak var profilePhotoField: UITextField?
    private var activeDocumentPick: NativeDocumentPick?

    private enum NativeDocumentPick {
        case expertResume
        case profilePhoto
    }
    private var pendingBundledRoute: String?
    private var loadingTimeoutWorkItem: DispatchWorkItem?
    private var launchedWithNativeAuth = false
    private var nativeHomeView: UIView?
    private weak var nativeHomeScrollView: UIScrollView?
    private weak var nativeTaxUpdatesSection: UIView?
    private weak var nativeChatInputField: UITextField?
    private weak var nativeChatMessagesStack: UIStackView?
    private weak var nativeChatLanguageControl: UISegmentedControl?
    private var nativeChatMessages: [(role: String, text: String)] = []
    private var nativeChatLanguage = "english"

    /// Creates a concrete root view when the controller is launched outside the storyboard scene path.
    override func loadView() {
        let rootView = UIView(frame: UIScreen.main.bounds)
        rootView.backgroundColor = .white
        view = rootView
    }

    /// Builds the view hierarchy and starts the first web request.
    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .light
        view.backgroundColor = .white
        setupWebView()
        setupLoadingIndicator()
        setupRetryView()
        setupAppleOverlay()
        registerForAppleCredentialRevocation()
        setupBackButton()
        updateBackButtonVisibility()
        launchedWithNativeAuth = !(UserDefaults.standard.string(forKey: "pendingAuthToken") ?? "").isEmpty
        loadInitialPage()
        if launchedWithNativeAuth {
            showNativeAuthenticatedHome()
        }
    }

    /// Stops observing Apple credential notifications when the controller is released.
    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /// Refreshes overlay layout whenever the view's safe area changes.
    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        updateOverlayInsets()
    }

    /// Adapts the layout when iPad multitasking or device rotation changes the window size.
    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate(alongsideTransition: { [weak self] _ in
            self?.view.layoutIfNeeded()
            self?.updateOverlayInsets()
        })
    }

    /// Allows all phone orientations while letting iPad use the plist-declared full orientation set.
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        UIDevice.current.userInterfaceIdiom == .pad ? .all : .allButUpsideDown
    }

    /// Creates the persistent WKWebView configuration used by the wrapper.
    private func buildWebViewConfiguration() -> WKWebViewConfiguration {
        let configuration = WKWebViewConfiguration()
        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true
        preferences.preferredContentMode = .recommended
        configuration.defaultWebpagePreferences = preferences
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        
        // FIX: Add applicationNameForUserAgent with Mozilla prefix for reCAPTCHA compatibility
        configuration.applicationNameForUserAgent = "Mozilla/5.0"
        
        // FIX: Disable app-bound domain restriction to allow reCAPTCHA
        configuration.limitsNavigationsToAppBoundDomains = false

        let userContentController = WKUserContentController()
        userContentController.add(self, name: "nritaxNative")
        userContentController.addUserScript(WKUserScript(source: mobileScreenWidthInjectionScript(), injectionTime: .atDocumentStart, forMainFrameOnly: false))
        userContentController.addUserScript(WKUserScript(source: viewportInjectionScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        userContentController.addUserScript(WKUserScript(source: loginPageFixScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        userContentController.addUserScript(WKUserScript(source: socialLoginVisibilityFixScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false)) // FIX: Keep Google and LinkedIn sign-in buttons visible and tappable in iOS WKWebView.
        userContentController.addUserScript(WKUserScript(source: dashboardCompletionInjectionScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        userContentController.addUserScript(WKUserScript(source: dashboardForceShowSectionsScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        userContentController.addUserScript(WKUserScript(source: dashboardMissingSectionsFallbackScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        userContentController.addUserScript(WKUserScript(source: emptySpaceFixScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        userContentController.addUserScript(WKUserScript(source: pointerEventsInjectionScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        userContentController.addUserScript(WKUserScript(source: iosFloatingYuktiWidgetFixScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        userContentController.addUserScript(WKUserScript(source: iosBlankHomeRecoveryScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        userContentController.addUserScript(WKUserScript(source: threeDotsFixScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        userContentController.addUserScript(WKUserScript(source: popupHandlingScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        userContentController.addUserScript(WKUserScript(source: aiChatVisibilityFixScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false)) // FIX BUG 1/5: Force AI chat visibility, white backgrounds, bottom input, scrollable messages, and non-overlapping upgrade cards.
        userContentController.addUserScript(WKUserScript(source: pricingTouchFixScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false)) // FIX BUG 4: Make Pricing/Plans touch targets navigate to /pricing.
        userContentController.addUserScript(WKUserScript(source: threeDotsTouchFixScript(), injectionTime: .atDocumentEnd, forMainFrameOnly: false)) // FIX BUG 6: Make AI chat three-dots/kebab buttons respond to touch.
        configuration.userContentController = userContentController
        return configuration
    }

    #if DEBUG
    private func bundledWebAppURL(path: String) -> URL? {
        guard let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "public") else {
            return nil
        }

        var components = URLComponents(url: indexURL, resolvingAgainstBaseURL: false)
        components?.fragment = path
        return components?.url ?? indexURL
    }
    #endif

    /// Pins the web view to the safe area so it fills iPhone and iPad screens correctly.
    private func setupWebView() {
        view.addSubview(webView)
        let guide = view.safeAreaLayoutGuide
        let topConstraint = webView.topAnchor.constraint(equalTo: guide.topAnchor)
        bottomConstraint = webView.bottomAnchor.constraint(equalTo: guide.bottomAnchor)

        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: guide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: guide.trailingAnchor),
            topConstraint,
            bottomConstraint,
        ].compactMap { $0 })
    }

    /// Adds the native back button to the view hierarchy with proper positioning.
    private func setupBackButton() {
        view.addSubview(backButton)
        NSLayoutConstraint.activate([
            backButton.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            backButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            backButton.widthAnchor.constraint(equalToConstant: 44),
            backButton.heightAnchor.constraint(equalToConstant: 44),
        ])
        view.bringSubviewToFront(backButton)
    }

    /// Adds a centered loading spinner while the initial page and redirects resolve.
    private func setupLoadingIndicator() {
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        activityIndicator.hidesWhenStopped = true
        view.addSubview(activityIndicator)

        NSLayoutConstraint.activate([
            activityIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    /// Builds the retry UI shown after a recoverable top-level navigation failure.
    private func setupRetryView() {
        retryContainer.translatesAutoresizingMaskIntoConstraints = false
        retryContainer.axis = .vertical
        retryContainer.spacing = 12
        retryContainer.alignment = .center
        retryContainer.isHidden = true
        retryContainer.layoutMargins = UIEdgeInsets(top: 24, left: 24, bottom: 24, right: 24)
        retryContainer.isLayoutMarginsRelativeArrangement = true
        retryContainer.backgroundColor = .secondarySystemBackground
        retryContainer.layer.cornerRadius = 18

        retryTitleLabel.text = "Unable to load NRITAX.AI"
        retryTitleLabel.font = .preferredFont(forTextStyle: .title3)
        retryTitleLabel.textAlignment = .center
        retryTitleLabel.numberOfLines = 0

        retryMessageLabel.font = .preferredFont(forTextStyle: .body)
        retryMessageLabel.textColor = .secondaryLabel
        retryMessageLabel.textAlignment = .center
        retryMessageLabel.numberOfLines = 0
        retryMessageLabel.text = "Check your connection and try again."

        retryButton.configuration = .filled()
        retryButton.setTitle("Retry", for: .normal)
        retryButton.addTarget(self, action: #selector(handleRetryButtonPressed), for: .touchUpInside)

        retryContainer.addArrangedSubview(retryTitleLabel)
        retryContainer.addArrangedSubview(retryMessageLabel)
        retryContainer.addArrangedSubview(retryButton)
        view.addSubview(retryContainer)

        NSLayoutConstraint.activate([
            retryContainer.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            retryContainer.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            retryContainer.leadingAnchor.constraint(greaterThanOrEqualTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            retryContainer.trailingAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            retryContainer.widthAnchor.constraint(lessThanOrEqualToConstant: 420),
        ])
    }

    private func showNativeAuthenticatedHome() {
        guard nativeHomeView == nil else { return }

        let root = UIView()
        root.translatesAutoresizingMaskIntoConstraints = false
        root.backgroundColor = UIColor(hex: "F2F2F7")
        view.addSubview(root)
        nativeHomeView = root

        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.contentInsetAdjustmentBehavior = .never
        root.addSubview(scrollView)
        nativeHomeScrollView = scrollView

        let content = UIStackView()
        content.translatesAutoresizingMaskIntoConstraints = false
        content.axis = .vertical
        content.spacing = 18
        scrollView.addSubview(content)

        let header = UIView()
        header.translatesAutoresizingMaskIntoConstraints = false
        content.addArrangedSubview(header)

        let profileButton = UIButton(type: .system)
        profileButton.translatesAutoresizingMaskIntoConstraints = false
        profileButton.backgroundColor = UIColor(hex: "DBEAFE")
        profileButton.layer.cornerRadius = 24
        profileButton.layer.cornerCurve = .continuous
        profileButton.clipsToBounds = true
        profileButton.addTarget(self, action: #selector(openNativeProfile), for: .touchUpInside)
        header.addSubview(profileButton)

        if let image = nativeProfileImage() {
            let imageView = UIImageView(image: image)
            imageView.translatesAutoresizingMaskIntoConstraints = false
            imageView.contentMode = .scaleAspectFill
            profileButton.addSubview(imageView)
            NSLayoutConstraint.activate([
                imageView.topAnchor.constraint(equalTo: profileButton.topAnchor),
                imageView.leadingAnchor.constraint(equalTo: profileButton.leadingAnchor),
                imageView.trailingAnchor.constraint(equalTo: profileButton.trailingAnchor),
                imageView.bottomAnchor.constraint(equalTo: profileButton.bottomAnchor)
            ])
        } else {
            profileButton.setImage(UIImage(systemName: "person.fill"), for: .normal)
            profileButton.tintColor = UIColor(hex: "2563EB")
        }

        let greetingLabel = UILabel()
        greetingLabel.translatesAutoresizingMaskIntoConstraints = false
        greetingLabel.text = "Good morning, \(nativeUserFirstName())"
        greetingLabel.font = .systemFont(ofSize: 20, weight: .semibold)
        greetingLabel.textColor = UIColor(hex: "3B3B3B")
        header.addSubview(greetingLabel)

        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.text = "Your AI Tax Assistant"
        titleLabel.font = .systemFont(ofSize: 32, weight: .bold)
        titleLabel.textColor = UIColor(hex: "0F172A")
        titleLabel.numberOfLines = 0
        header.addSubview(titleLabel)

        let subtitleLabel = UILabel()
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.text = "Manage NRI taxes, AI answers, reports, expert consults, calculators, updates, and account tools from one native workspace."
        subtitleLabel.font = .systemFont(ofSize: 15, weight: .regular)
        subtitleLabel.textColor = UIColor(hex: "64748B")
        subtitleLabel.numberOfLines = 0
        header.addSubview(subtitleLabel)

        let grid = UIStackView()
        grid.translatesAutoresizingMaskIntoConstraints = false
        grid.axis = .vertical
        grid.spacing = 14
        content.addArrangedSubview(grid)

        let row1 = nativeHomeRow()
        row1.addArrangedSubview(nativeHomeCard(title: "AI Chat", subtitle: "Ask Yukti", symbol: "sparkles", tint: UIColor(hex: "1A3CFF"), action: #selector(openNativeChat)))
        row1.addArrangedSubview(nativeHomeCard(title: "Reports", subtitle: "Documents and profile", symbol: "chart.pie", tint: UIColor(hex: "1A3CFF"), action: #selector(openNativeReports)))
        grid.addArrangedSubview(row1)

        let row2 = nativeHomeRow()
        row2.addArrangedSubview(nativeHomeCard(title: "Consult", subtitle: "Expert CPA support", symbol: "person.2", tint: UIColor(hex: "1A3CFF"), action: #selector(openNativeConsult)))
        row2.addArrangedSubview(nativeHomeCard(title: "Calculate", subtitle: "Tax estimators", symbol: "function", tint: UIColor(hex: "1A3CFF"), action: #selector(openNativeCalculators)))
        grid.addArrangedSubview(row2)

        let row3 = nativeHomeRow()
        row3.addArrangedSubview(nativeHomeCard(title: "Tax Updates", subtitle: "Latest guidance", symbol: "newspaper", tint: UIColor(hex: "1A3CFF"), action: #selector(scrollNativeHomeToTaxUpdates)))
        row3.addArrangedSubview(nativeHomeCard(title: "Join Expert", subtitle: "Advisor onboarding", symbol: "briefcase", tint: UIColor(hex: "1A3CFF"), action: #selector(openNativeJoinExpert)))
        grid.addArrangedSubview(row3)

        let statsRow = nativeHomeRow()
        statsRow.addArrangedSubview(nativeStatCard(label: "Tax Questions", value: "24", description: "Answered"))
        statsRow.addArrangedSubview(nativeStatCard(label: "Savings", value: "₹3.8L", description: "Projected"))
        content.addArrangedSubview(statsRow)

        content.addArrangedSubview(nativeSectionHeader(eyebrow: "WHY NRITAX", title: "Core features"))
        content.addArrangedSubview(nativeInfoCard(title: "AI-Powered Assistance", description: "Instant answers for DTAA, NRI filing, residency, and remittance questions.", symbol: "sparkles"))
        content.addArrangedSubview(nativeInfoCard(title: "Expert CPA Support", description: "Connect with specialists for personalized planning and compliance.", symbol: "person.2"))
        content.addArrangedSubview(nativeInfoCard(title: "Multi-Language Support", description: "Use English, Hindi, Tamil, and Indonesian for tax guidance.", symbol: "globe"))
        content.addArrangedSubview(nativeInfoCard(title: "Compliance Protection", description: "Track key filings, documents, and cross-border tax obligations.", symbol: "shield.checkered"))

        let updatesHeader = nativeSectionHeader(eyebrow: "REGULATORY INTELLIGENCE", title: "Tax Updates")
        content.addArrangedSubview(updatesHeader)
        nativeTaxUpdatesSection = updatesHeader
        content.addArrangedSubview(nativeUpdateCard(label: "DTAA UPDATE", title: "DTAA filing checklist refresh for FY 2025-26", source: "CBDT"))
        content.addArrangedSubview(nativeUpdateCard(label: "INTERNATIONAL TAX ALERT", title: "Updated NRI tax residency documentation guidance", source: "Gazette"))
        content.addArrangedSubview(nativeUpdateCard(label: "TAX TREATY UPDATE", title: "Revised remittance notes for Form 15CA/15CB", source: "NRITAX Research"))

        let expertButton = UIButton(type: .system)
        expertButton.translatesAutoresizingMaskIntoConstraints = false
        expertButton.setTitle("Join as an Expert", for: .normal)
        expertButton.setTitleColor(.white, for: .normal)
        expertButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .bold)
        expertButton.backgroundColor = UIColor(hex: "0F172A")
        expertButton.layer.cornerRadius = 20
        expertButton.layer.cornerCurve = .continuous
        expertButton.addTarget(self, action: #selector(openNativeJoinExpert), for: .touchUpInside)
        content.addArrangedSubview(expertButton)

        let bottomNav = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterialLight))
        bottomNav.translatesAutoresizingMaskIntoConstraints = false
        bottomNav.layer.cornerRadius = 26
        bottomNav.layer.cornerCurve = .continuous
        bottomNav.clipsToBounds = true
        root.addSubview(bottomNav)

        let navStack = UIStackView()
        navStack.translatesAutoresizingMaskIntoConstraints = false
        navStack.axis = .horizontal
        navStack.distribution = .fillEqually
        navStack.spacing = 4
        bottomNav.contentView.addSubview(navStack)
        navStack.addArrangedSubview(nativeTabButton(title: "Home", symbol: "house.fill", tint: UIColor(hex: "1A3CFF"), action: #selector(showNativeHomeFromBottomNav)))
        navStack.addArrangedSubview(nativeTabButton(title: "AI Chat", symbol: "sparkles", tint: UIColor(hex: "64748B"), action: #selector(openNativeChat)))
        navStack.addArrangedSubview(nativeTabButton(title: "Yukti", symbol: "brain.head.profile", tint: UIColor(hex: "64748B"), action: #selector(openNativeYukti)))
        navStack.addArrangedSubview(nativeTabButton(title: "Profile", symbol: "person.crop.circle", tint: UIColor(hex: "64748B"), action: #selector(openNativeProfile)))

        NSLayoutConstraint.activate([
            root.topAnchor.constraint(equalTo: view.topAnchor),
            root.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            root.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            root.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            scrollView.topAnchor.constraint(equalTo: root.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: root.bottomAnchor),

            content.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 96),
            content.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 16),
            content.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -16),
            content.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -126),
            content.widthAnchor.constraint(lessThanOrEqualToConstant: 760),
            content.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor, constant: -32).withPriority(.defaultHigh),
            content.centerXAnchor.constraint(equalTo: scrollView.frameLayoutGuide.centerXAnchor),

            profileButton.topAnchor.constraint(equalTo: header.topAnchor),
            profileButton.trailingAnchor.constraint(equalTo: header.trailingAnchor),
            profileButton.widthAnchor.constraint(equalToConstant: 48),
            profileButton.heightAnchor.constraint(equalToConstant: 48),

            greetingLabel.topAnchor.constraint(equalTo: header.topAnchor),
            greetingLabel.leadingAnchor.constraint(equalTo: header.leadingAnchor),
            greetingLabel.trailingAnchor.constraint(lessThanOrEqualTo: profileButton.leadingAnchor, constant: -12),

            titleLabel.topAnchor.constraint(equalTo: greetingLabel.bottomAnchor, constant: 8),
            titleLabel.leadingAnchor.constraint(equalTo: greetingLabel.leadingAnchor),
            titleLabel.trailingAnchor.constraint(equalTo: header.trailingAnchor),

            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            subtitleLabel.leadingAnchor.constraint(equalTo: greetingLabel.leadingAnchor),
            subtitleLabel.trailingAnchor.constraint(equalTo: header.trailingAnchor),
            subtitleLabel.bottomAnchor.constraint(equalTo: header.bottomAnchor),

            row1.heightAnchor.constraint(equalToConstant: 118),
            row2.heightAnchor.constraint(equalToConstant: 118),
            row3.heightAnchor.constraint(equalToConstant: 118),
            statsRow.heightAnchor.constraint(equalToConstant: 132),
            expertButton.heightAnchor.constraint(equalToConstant: 58),

            bottomNav.leadingAnchor.constraint(equalTo: root.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            bottomNav.trailingAnchor.constraint(equalTo: root.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            bottomNav.bottomAnchor.constraint(equalTo: root.safeAreaLayoutGuide.bottomAnchor, constant: -10),
            bottomNav.heightAnchor.constraint(equalToConstant: 74),

            navStack.topAnchor.constraint(equalTo: bottomNav.contentView.topAnchor, constant: 8),
            navStack.leadingAnchor.constraint(equalTo: bottomNav.contentView.leadingAnchor, constant: 8),
            navStack.trailingAnchor.constraint(equalTo: bottomNav.contentView.trailingAnchor, constant: -8),
            navStack.bottomAnchor.constraint(equalTo: bottomNav.contentView.bottomAnchor, constant: -8)
        ])

        view.bringSubviewToFront(root)
    }

    private func nativeHomeRow() -> UIStackView {
        let row = UIStackView()
        row.translatesAutoresizingMaskIntoConstraints = false
        row.axis = .horizontal
        row.distribution = .fillEqually
        row.spacing = 14
        return row
    }

    private func nativeHomeCard(title: String, subtitle: String, symbol: String, tint: UIColor, action: Selector) -> UIButton {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.backgroundColor = .white
        button.layer.cornerRadius = 20
        button.layer.cornerCurve = .continuous
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOpacity = 0.08
        button.layer.shadowOffset = CGSize(width: 0, height: 2)
        button.layer.shadowRadius = 12
        button.addTarget(self, action: action, for: .touchUpInside)

        let icon = UIImageView(image: UIImage(systemName: symbol))
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.tintColor = tint
        icon.contentMode = .scaleAspectFit
        button.addSubview(icon)

        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 17, weight: .bold)
        titleLabel.textColor = UIColor(hex: "0F172A")
        titleLabel.numberOfLines = 2
        button.addSubview(titleLabel)

        let subtitleLabel = UILabel()
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.text = subtitle
        subtitleLabel.font = .systemFont(ofSize: 13, weight: .regular)
        subtitleLabel.textColor = UIColor(hex: "64748B")
        subtitleLabel.numberOfLines = 2
        button.addSubview(subtitleLabel)

        NSLayoutConstraint.activate([
            icon.topAnchor.constraint(equalTo: button.topAnchor, constant: 18),
            icon.leadingAnchor.constraint(equalTo: button.leadingAnchor, constant: 18),
            icon.widthAnchor.constraint(equalToConstant: 24),
            icon.heightAnchor.constraint(equalToConstant: 24),

            titleLabel.topAnchor.constraint(equalTo: icon.bottomAnchor, constant: 12),
            titleLabel.leadingAnchor.constraint(equalTo: icon.leadingAnchor),
            titleLabel.trailingAnchor.constraint(equalTo: button.trailingAnchor, constant: -18),

            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 5),
            subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            subtitleLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            subtitleLabel.bottomAnchor.constraint(lessThanOrEqualTo: button.bottomAnchor, constant: -16)
        ])

        return button
    }

    private func showNativeFeatureScreen(selectedTab: String, title: String, subtitle: String, cards: [UIView]) {
        nativeHomeView?.removeFromSuperview()
        nativeHomeView = nil
        nativeTaxUpdatesSection = nil

        let root = UIView()
        root.translatesAutoresizingMaskIntoConstraints = false
        root.backgroundColor = UIColor(hex: "F2F2F7")
        view.addSubview(root)
        nativeHomeView = root

        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.contentInsetAdjustmentBehavior = .never
        root.addSubview(scrollView)
        nativeHomeScrollView = scrollView

        let content = UIStackView()
        content.translatesAutoresizingMaskIntoConstraints = false
        content.axis = .vertical
        content.spacing = 16
        scrollView.addSubview(content)

        let header = UIView()
        header.translatesAutoresizingMaskIntoConstraints = false
        content.addArrangedSubview(header)

        let appLabel = UILabel()
        appLabel.translatesAutoresizingMaskIntoConstraints = false
        appLabel.attributedText = NSAttributedString(
            string: "NRITAX.AI",
            attributes: [
                .font: UIFont.systemFont(ofSize: 12, weight: .heavy),
                .foregroundColor: UIColor(hex: "2563EB"),
                .kern: 0.8
            ]
        )
        header.addSubview(appLabel)

        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 32, weight: .bold)
        titleLabel.textColor = UIColor(hex: "0F172A")
        titleLabel.numberOfLines = 0
        header.addSubview(titleLabel)

        let subtitleLabel = UILabel()
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.text = subtitle
        subtitleLabel.font = .systemFont(ofSize: 15, weight: .regular)
        subtitleLabel.textColor = UIColor(hex: "64748B")
        subtitleLabel.numberOfLines = 0
        header.addSubview(subtitleLabel)

        cards.forEach { content.addArrangedSubview($0) }
        addNativeBottomNav(to: root, selectedTab: selectedTab)

        NSLayoutConstraint.activate([
            root.topAnchor.constraint(equalTo: view.topAnchor),
            root.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            root.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            root.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            scrollView.topAnchor.constraint(equalTo: root.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: root.bottomAnchor),

            content.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 68),
            content.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 16),
            content.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -16),
            content.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -126),
            content.widthAnchor.constraint(lessThanOrEqualToConstant: 760),
            content.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor, constant: -32).withPriority(.defaultHigh),
            content.centerXAnchor.constraint(equalTo: scrollView.frameLayoutGuide.centerXAnchor),

            header.heightAnchor.constraint(greaterThanOrEqualToConstant: 142),
            appLabel.topAnchor.constraint(equalTo: header.topAnchor),
            appLabel.leadingAnchor.constraint(equalTo: header.leadingAnchor),
            appLabel.trailingAnchor.constraint(equalTo: header.trailingAnchor),
            titleLabel.topAnchor.constraint(equalTo: appLabel.bottomAnchor, constant: 10),
            titleLabel.leadingAnchor.constraint(equalTo: header.leadingAnchor),
            titleLabel.trailingAnchor.constraint(equalTo: header.trailingAnchor),
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            subtitleLabel.leadingAnchor.constraint(equalTo: header.leadingAnchor),
            subtitleLabel.trailingAnchor.constraint(equalTo: header.trailingAnchor)
        ])

        view.bringSubviewToFront(root)
    }

    private func addNativeBottomNav(to root: UIView, selectedTab: String) {
        let bottomNav = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterialLight))
        bottomNav.translatesAutoresizingMaskIntoConstraints = false
        bottomNav.layer.cornerRadius = 26
        bottomNav.layer.cornerCurve = .continuous
        bottomNav.clipsToBounds = true
        root.addSubview(bottomNav)

        let navStack = UIStackView()
        navStack.translatesAutoresizingMaskIntoConstraints = false
        navStack.axis = .horizontal
        navStack.distribution = .fillEqually
        navStack.spacing = 4
        bottomNav.contentView.addSubview(navStack)

        let active = UIColor(hex: "1A3CFF")
        let inactive = UIColor(hex: "64748B")
        navStack.addArrangedSubview(nativeTabButton(title: "Home", symbol: "house.fill", tint: selectedTab == "home" ? active : inactive, action: #selector(showNativeHomeFromBottomNav)))
        navStack.addArrangedSubview(nativeTabButton(title: "AI Chat", symbol: "sparkles", tint: selectedTab == "chat" ? active : inactive, action: #selector(openNativeChat)))
        navStack.addArrangedSubview(nativeTabButton(title: "Yukti", symbol: "brain.head.profile", tint: selectedTab == "yukti" ? active : inactive, action: #selector(openNativeYukti)))
        navStack.addArrangedSubview(nativeTabButton(title: "Profile", symbol: "person.crop.circle", tint: selectedTab == "profile" ? active : inactive, action: #selector(openNativeProfile)))

        NSLayoutConstraint.activate([
            bottomNav.leadingAnchor.constraint(equalTo: root.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            bottomNav.trailingAnchor.constraint(equalTo: root.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            bottomNav.bottomAnchor.constraint(equalTo: root.safeAreaLayoutGuide.bottomAnchor, constant: -10),
            bottomNav.heightAnchor.constraint(equalToConstant: 74),

            navStack.topAnchor.constraint(equalTo: bottomNav.contentView.topAnchor, constant: 8),
            navStack.leadingAnchor.constraint(equalTo: bottomNav.contentView.leadingAnchor, constant: 8),
            navStack.trailingAnchor.constraint(equalTo: bottomNav.contentView.trailingAnchor, constant: -8),
            navStack.bottomAnchor.constraint(equalTo: bottomNav.contentView.bottomAnchor, constant: -8)
        ])
    }

    private func nativeActionCard(title: String, description: String, symbol: String, buttonTitle: String? = nil, action: Selector? = nil) -> UIView {
        let card = nativePlainCard()

        let iconWrap = UIView()
        iconWrap.translatesAutoresizingMaskIntoConstraints = false
        iconWrap.backgroundColor = UIColor(hex: "E8EEFF")
        iconWrap.layer.cornerRadius = 18
        iconWrap.layer.cornerCurve = .continuous
        card.addSubview(iconWrap)

        let icon = UIImageView(image: UIImage(systemName: symbol))
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.tintColor = UIColor(hex: "1A3CFF")
        icon.contentMode = .scaleAspectFit
        iconWrap.addSubview(icon)

        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 18, weight: .bold)
        titleLabel.textColor = UIColor(hex: "0F172A")
        titleLabel.numberOfLines = 0
        card.addSubview(titleLabel)

        let descriptionLabel = UILabel()
        descriptionLabel.translatesAutoresizingMaskIntoConstraints = false
        descriptionLabel.text = description
        descriptionLabel.font = .systemFont(ofSize: 14, weight: .regular)
        descriptionLabel.textColor = UIColor(hex: "64748B")
        descriptionLabel.numberOfLines = 0
        card.addSubview(descriptionLabel)

        var bottomAnchor = descriptionLabel.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -20)
        if let buttonTitle, let action {
            let button = UIButton(type: .system)
            button.translatesAutoresizingMaskIntoConstraints = false
            button.setTitle(buttonTitle, for: .normal)
            button.setTitleColor(.white, for: .normal)
            button.titleLabel?.font = .systemFont(ofSize: 15, weight: .bold)
            button.backgroundColor = UIColor(hex: "0F172A")
            button.layer.cornerRadius = 16
            button.layer.cornerCurve = .continuous
            button.addTarget(self, action: action, for: .touchUpInside)
            card.addSubview(button)
            bottomAnchor = button.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -18)

            NSLayoutConstraint.activate([
                button.topAnchor.constraint(equalTo: descriptionLabel.bottomAnchor, constant: 16),
                button.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
                button.trailingAnchor.constraint(lessThanOrEqualTo: card.trailingAnchor, constant: -18),
                button.widthAnchor.constraint(greaterThanOrEqualToConstant: 150),
                button.heightAnchor.constraint(equalToConstant: 46)
            ])
        }

        NSLayoutConstraint.activate([
            card.heightAnchor.constraint(greaterThanOrEqualToConstant: buttonTitle == nil ? 128 : 184),
            iconWrap.topAnchor.constraint(equalTo: card.topAnchor, constant: 20),
            iconWrap.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            iconWrap.widthAnchor.constraint(equalToConstant: 52),
            iconWrap.heightAnchor.constraint(equalToConstant: 52),
            icon.centerXAnchor.constraint(equalTo: iconWrap.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconWrap.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 26),
            icon.heightAnchor.constraint(equalToConstant: 26),
            titleLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 20),
            titleLabel.leadingAnchor.constraint(equalTo: iconWrap.trailingAnchor, constant: 14),
            titleLabel.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            descriptionLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            descriptionLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            descriptionLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            bottomAnchor
        ])

        return card
    }

    private func nativeChatComposerCard() -> UIView {
        let card = nativePlainCard()

        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.text = "Start with a question"
        label.font = .systemFont(ofSize: 17, weight: .bold)
        label.textColor = UIColor(hex: "0F172A")
        card.addSubview(label)

        let field = UITextField()
        field.translatesAutoresizingMaskIntoConstraints = false
        field.placeholder = "Ask about DTAA, ITR, residency..."
        field.font = .systemFont(ofSize: 15, weight: .regular)
        field.backgroundColor = UIColor(hex: "F8FAFC")
        field.layer.cornerRadius = 16
        field.layer.borderWidth = 1
        field.layer.borderColor = UIColor(hex: "E2E8F0").cgColor
        field.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 14, height: 1))
        field.leftViewMode = .always
        field.returnKeyType = .send
        field.addTarget(self, action: #selector(handleNativeChatSend), for: .editingDidEndOnExit)
        card.addSubview(field)
        nativeChatInputField = field

        let sendButton = UIButton(type: .system)
        sendButton.translatesAutoresizingMaskIntoConstraints = false
        sendButton.setImage(UIImage(systemName: "paperplane.fill"), for: .normal)
        sendButton.tintColor = .white
        sendButton.backgroundColor = UIColor(hex: "1A3CFF")
        sendButton.layer.cornerRadius = 22
        sendButton.addTarget(self, action: #selector(handleNativeChatSend), for: .touchUpInside)
        card.addSubview(sendButton)

        NSLayoutConstraint.activate([
            card.heightAnchor.constraint(equalToConstant: 138),
            label.topAnchor.constraint(equalTo: card.topAnchor, constant: 18),
            label.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18),
            label.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
            field.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 14),
            field.leadingAnchor.constraint(equalTo: label.leadingAnchor),
            field.trailingAnchor.constraint(equalTo: sendButton.leadingAnchor, constant: -10),
            field.heightAnchor.constraint(equalToConstant: 48),
            sendButton.centerYAnchor.constraint(equalTo: field.centerYAnchor),
            sendButton.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
            sendButton.widthAnchor.constraint(equalToConstant: 44),
            sendButton.heightAnchor.constraint(equalToConstant: 44)
        ])

        return card
    }

    private func nativeChatControlsCard() -> UIView {
        let card = nativePlainCard()

        let language = UISegmentedControl(items: ["English", "Hindi", "Tamil", "Bahasa"])
        language.translatesAutoresizingMaskIntoConstraints = false
        language.selectedSegmentIndex = ["english", "hindi", "tamil", "indonesian"].firstIndex(of: nativeChatLanguage) ?? 0
        language.addTarget(self, action: #selector(handleNativeChatLanguageChanged), for: .valueChanged)
        card.addSubview(language)
        nativeChatLanguageControl = language

        let clearButton = UIButton(type: .system)
        clearButton.translatesAutoresizingMaskIntoConstraints = false
        clearButton.setTitle("Clear", for: .normal)
        clearButton.setImage(UIImage(systemName: "trash"), for: .normal)
        clearButton.tintColor = UIColor(hex: "0F172A")
        clearButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
        clearButton.addTarget(self, action: #selector(clearNativeChat), for: .touchUpInside)
        card.addSubview(clearButton)

        let transcriptButton = UIButton(type: .system)
        transcriptButton.translatesAutoresizingMaskIntoConstraints = false
        transcriptButton.setTitle("Transcript", for: .normal)
        transcriptButton.setImage(UIImage(systemName: "square.and.arrow.down"), for: .normal)
        transcriptButton.tintColor = UIColor(hex: "0F172A")
        transcriptButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
        transcriptButton.addTarget(self, action: #selector(showNativeTranscript), for: .touchUpInside)
        card.addSubview(transcriptButton)

        NSLayoutConstraint.activate([
            card.heightAnchor.constraint(equalToConstant: 122),
            language.topAnchor.constraint(equalTo: card.topAnchor, constant: 18),
            language.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18),
            language.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
            language.heightAnchor.constraint(equalToConstant: 36),
            clearButton.topAnchor.constraint(equalTo: language.bottomAnchor, constant: 16),
            clearButton.leadingAnchor.constraint(equalTo: language.leadingAnchor),
            clearButton.heightAnchor.constraint(equalToConstant: 34),
            transcriptButton.topAnchor.constraint(equalTo: clearButton.topAnchor),
            transcriptButton.trailingAnchor.constraint(equalTo: language.trailingAnchor),
            transcriptButton.heightAnchor.constraint(equalToConstant: 34)
        ])

        return card
    }

    private func nativeStarterQuestionsCard() -> UIView {
        let card = nativePlainCard()
        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 10
        card.addSubview(stack)

        let title = UILabel()
        title.text = "Starter questions"
        title.font = .systemFont(ofSize: 17, weight: .bold)
        title.textColor = UIColor(hex: "0F172A")
        stack.addArrangedSubview(title)

        [
            "How do I determine NRI residency?",
            "Can I claim DTAA relief?",
            "What documents do I need for ITR filing?",
            "How is Indian rental income taxed?"
        ].forEach { question in
            let button = UIButton(type: .system)
            var title = AttributedString(question)
            title.font = UIFont.systemFont(ofSize: 15, weight: .semibold)
            var configuration = UIButton.Configuration.plain()
            configuration.attributedTitle = title
            configuration.baseForegroundColor = UIColor(hex: "1A3CFF")
            configuration.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12)
            configuration.titleLineBreakMode = .byWordWrapping
            configuration.background.backgroundColor = UIColor(hex: "F8FAFC")
            configuration.background.cornerRadius = 14
            button.contentHorizontalAlignment = .left
            button.configuration = configuration
            button.titleLabel?.numberOfLines = 0
            button.addAction(UIAction { [weak self] _ in
                self?.nativeChatInputField?.text = question
                self?.handleNativeChatSend()
            }, for: .touchUpInside)
            stack.addArrangedSubview(button)
        }

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 18),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -18)
        ])

        return card
    }

    private func nativeChatMessagesCard() -> UIView {
        let card = nativePlainCard()
        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 10
        card.addSubview(stack)
        nativeChatMessagesStack = stack
        renderNativeChatMessages()

        NSLayoutConstraint.activate([
            card.heightAnchor.constraint(greaterThanOrEqualToConstant: 160),
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16)
        ])

        return card
    }

    private func renderNativeChatMessages() {
        guard let stack = nativeChatMessagesStack else { return }
        stack.arrangedSubviews.forEach { view in
            stack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }

        if nativeChatMessages.isEmpty {
            nativeChatMessages.append((role: "ai", text: nativeChatWelcomeMessage()))
        }

        nativeChatMessages.forEach { message in
            stack.addArrangedSubview(nativeChatBubble(role: message.role, text: message.text))
        }
    }

    private func nativeChatBubble(role: String, text: String) -> UIView {
        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.text = text
        label.font = .systemFont(ofSize: 14, weight: .regular)
        label.numberOfLines = 0
        label.textColor = role == "user" ? .white : UIColor(hex: "0F172A")
        label.backgroundColor = role == "user" ? UIColor(hex: "2563EB") : UIColor(hex: "F8FAFC")
        label.layer.cornerRadius = 16
        label.layer.masksToBounds = true

        let wrapper = UIView()
        wrapper.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(label)

        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: wrapper.topAnchor),
            label.bottomAnchor.constraint(equalTo: wrapper.bottomAnchor),
            label.widthAnchor.constraint(lessThanOrEqualTo: wrapper.widthAnchor, multiplier: 0.9)
        ])

        if role == "user" {
            label.trailingAnchor.constraint(equalTo: wrapper.trailingAnchor).isActive = true
            label.leadingAnchor.constraint(greaterThanOrEqualTo: wrapper.leadingAnchor).isActive = true
        } else {
            label.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor).isActive = true
            label.trailingAnchor.constraint(lessThanOrEqualTo: wrapper.trailingAnchor).isActive = true
        }

        label.layoutMargins = UIEdgeInsets(top: 10, left: 12, bottom: 10, right: 12)
        return wrapper
    }

    private func nativeYuktiPromptCard() -> UIView {
        let card = nativePlainCard()

        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.text = "Ask Yukti"
        label.font = .systemFont(ofSize: 17, weight: .bold)
        label.textColor = UIColor(hex: "0F172A")
        card.addSubview(label)

        let field = UITextField()
        field.translatesAutoresizingMaskIntoConstraints = false
        field.placeholder = "Ask about services, pricing, calculators..."
        field.font = .systemFont(ofSize: 15, weight: .regular)
        field.backgroundColor = UIColor(hex: "F8FAFC")
        field.layer.cornerRadius = 16
        field.layer.borderWidth = 1
        field.layer.borderColor = UIColor(hex: "E2E8F0").cgColor
        field.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 14, height: 1))
        field.leftViewMode = .always
        field.returnKeyType = .send
        card.addSubview(field)

        let sendButton = UIButton(type: .system)
        sendButton.translatesAutoresizingMaskIntoConstraints = false
        sendButton.setImage(UIImage(systemName: "paperplane.fill"), for: .normal)
        sendButton.tintColor = .white
        sendButton.backgroundColor = UIColor(hex: "1A3CFF")
        sendButton.layer.cornerRadius = 22
        card.addSubview(sendButton)

        let reply = UILabel()
        reply.translatesAutoresizingMaskIntoConstraints = false
        reply.text = "I can help you choose the right NRITAX tool, explain pricing, open calculators, start AI chat, or guide you to expert consultation."
        reply.font = .systemFont(ofSize: 14, weight: .regular)
        reply.textColor = UIColor(hex: "64748B")
        reply.numberOfLines = 0
        card.addSubview(reply)

        let askAction = UIAction { [weak self, weak field, weak reply] _ in
            let query = field?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !query.isEmpty else { return }
            reply?.text = self?.nativeYuktiReply(for: query)
            field?.text = ""
        }
        sendButton.addAction(askAction, for: .touchUpInside)
        field.addAction(askAction, for: .editingDidEndOnExit)

        NSLayoutConstraint.activate([
            card.heightAnchor.constraint(greaterThanOrEqualToConstant: 204),
            label.topAnchor.constraint(equalTo: card.topAnchor, constant: 18),
            label.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18),
            label.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
            field.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 14),
            field.leadingAnchor.constraint(equalTo: label.leadingAnchor),
            field.trailingAnchor.constraint(equalTo: sendButton.leadingAnchor, constant: -10),
            field.heightAnchor.constraint(equalToConstant: 48),
            sendButton.centerYAnchor.constraint(equalTo: field.centerYAnchor),
            sendButton.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
            sendButton.widthAnchor.constraint(equalToConstant: 44),
            sendButton.heightAnchor.constraint(equalToConstant: 44),
            reply.topAnchor.constraint(equalTo: field.bottomAnchor, constant: 16),
            reply.leadingAnchor.constraint(equalTo: label.leadingAnchor),
            reply.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
            reply.bottomAnchor.constraint(lessThanOrEqualTo: card.bottomAnchor, constant: -18)
        ])

        return card
    }

    private func nativeYuktiReply(for query: String) -> String {
        let text = query.lowercased()
        if text.range(of: "price|pricing|cost|fee|plan|upgrade", options: .regularExpression) != nil {
            return "Open Pricing Plans to compare Starter, Professional, and expert-supported options."
        }
        if text.range(of: "calculator|calculate|residency|dtaa", options: .regularExpression) != nil {
            return "Use Calculators for residency, income tax, DTAA credit, and planning estimates."
        }
        if text.range(of: "chat|ai|question|tax help|advice", options: .regularExpression) != nil {
            return "AI Chat is best for detailed NRI tax questions and follow-up conversations."
        }
        if text.range(of: "cpa|consult|expert|appointment|book", options: .regularExpression) != nil {
            return "Consult lets you book expert help for personalized tax guidance."
        }
        if text.range(of: "support|contact|email|message|help|complaint|issue|problem", options: .regularExpression) != nil {
            return "Describe the issue and NRITAX support can review it. You can also use expert consultation for urgent tax matters."
        }
        return "I can help with NRITAX services, pricing, calculators, compliance, AI chat, and CPA consultation."
    }

    private func nativePlanCard(
        name: String,
        badge: String,
        price: String,
        detail: String,
        features: [(String, Bool)],
        cta: String,
        action: Selector?
    ) -> UIView {
        let card = nativePlainCard()
        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 12
        card.addSubview(stack)

        let badgeLabel = UILabel()
        badgeLabel.text = badge
        badgeLabel.font = .systemFont(ofSize: 12, weight: .heavy)
        badgeLabel.textColor = UIColor(hex: "2563EB")
        stack.addArrangedSubview(badgeLabel)

        let nameLabel = UILabel()
        nameLabel.text = name
        nameLabel.font = .systemFont(ofSize: 24, weight: .heavy)
        nameLabel.textColor = UIColor(hex: "0F172A")
        stack.addArrangedSubview(nameLabel)

        let priceLabel = UILabel()
        priceLabel.text = price
        priceLabel.font = .systemFont(ofSize: 22, weight: .bold)
        priceLabel.textColor = UIColor(hex: "0F172A")
        stack.addArrangedSubview(priceLabel)

        let detailLabel = UILabel()
        detailLabel.text = detail
        detailLabel.font = .systemFont(ofSize: 14, weight: .regular)
        detailLabel.textColor = UIColor(hex: "64748B")
        detailLabel.numberOfLines = 0
        stack.addArrangedSubview(detailLabel)

        features.forEach { feature, included in
            let row = UILabel()
            row.text = "\(included ? "✓" : "–") \(feature)"
            row.font = .systemFont(ofSize: 14, weight: included ? .semibold : .regular)
            row.textColor = included ? UIColor(hex: "0F172A") : UIColor(hex: "94A3B8")
            row.numberOfLines = 0
            stack.addArrangedSubview(row)
        }

        let button = UIButton(type: .system)
        button.setTitle(cta, for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 15, weight: .bold)
        button.backgroundColor = UIColor(hex: "0F172A")
        button.layer.cornerRadius = 16
        button.heightAnchor.constraint(equalToConstant: 48).isActive = true
        if let action {
            button.addTarget(self, action: action, for: .touchUpInside)
        }
        stack.addArrangedSubview(button)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -20)
        ])

        return card
    }

    private func nativeResidencyCalculatorCard() -> UIView {
        let card = nativeFormCard(title: "Tax Residency Status", symbol: "person.2")
        let stack = card.subviews.compactMap { $0 as? UIStackView }.first!
        let indiaDays = nativeNumberField("Days in India, FY Apr-Mar", placeholder: "150")
        let indonesiaDays = nativeNumberField("Days in Indonesia, calendar year", placeholder: "200")
        let citizen = UISegmentedControl(items: ["Indian citizen", "Not citizen"])
        citizen.selectedSegmentIndex = 0
        let indianIncome = UISegmentedControl(items: ["Indian income", "No Indian income"])
        indianIncome.selectedSegmentIndex = 0
        let result = nativeResultLabel()
        stack.addArrangedSubview(indiaDays.container)
        stack.addArrangedSubview(indonesiaDays.container)
        stack.addArrangedSubview(citizen)
        stack.addArrangedSubview(indianIncome)
        stack.addArrangedSubview(nativeSmallButton("Calculate residency") {
            let india = Int(indiaDays.field.text ?? "") ?? 0
            let indonesia = Int(indonesiaDays.field.text ?? "") ?? 0
            let isCitizen = citizen.selectedSegmentIndex == 0
            let hasIncome = indianIncome.selectedSegmentIndex == 0
            let indiaStatus: String
            let indiaNote: String
            if india >= 182 {
                indiaStatus = "Resident"
                indiaNote = "182 or more days in India during the financial year."
            } else if india >= 120 && hasIncome {
                indiaStatus = "RNOR"
                indiaNote = "120-181 days with Indian income can trigger RNOR treatment."
            } else if india >= 60 && isCitizen {
                indiaStatus = "RNOR"
                indiaNote = "Indian citizen with 60-181 days may require RNOR review."
            } else {
                indiaStatus = "Non-Resident"
                indiaNote = "Less than the main residency thresholds."
            }
            let indonesiaStatus = indonesia >= 183 ? "Resident" : "Non-Resident"
            let indonesiaNote = indonesia >= 183 ? "183 or more days in Indonesia." : "Less than 183 days in Indonesia."
            result.text = "India: \(indiaStatus)\n\(indiaNote)\n\nIndonesia: \(indonesiaStatus)\n\(indonesiaNote)"
        })
        stack.addArrangedSubview(result)
        return card
    }

    private func nativeIncomeCalculatorCard() -> UIView {
        let card = nativeFormCard(title: "Income Tax Calculator", symbol: "function")
        let stack = card.subviews.compactMap { $0 as? UIStackView }.first!
        let country = UISegmentedControl(items: ["India", "Indonesia"])
        country.selectedSegmentIndex = 0
        let income = nativeNumberField("Annual income", placeholder: "1000000")
        let type = UISegmentedControl(items: ["Salary", "Business", "Rental"])
        type.selectedSegmentIndex = 0
        let result = nativeResultLabel()
        stack.addArrangedSubview(country)
        stack.addArrangedSubview(income.container)
        stack.addArrangedSubview(type)
        stack.addArrangedSubview(nativeSmallButton("Calculate tax") {
            let amount = Double(income.field.text ?? "") ?? 0
            let isIndia = country.selectedSegmentIndex == 0
            let tax: Double
            if isIndia {
                if amount <= 300000 { tax = 0 }
                else if amount <= 700000 { tax = (amount - 300000) * 0.05 }
                else if amount <= 1000000 { tax = 20000 + (amount - 700000) * 0.10 }
                else if amount <= 1200000 { tax = 50000 + (amount - 1000000) * 0.15 }
                else if amount <= 1500000 { tax = 80000 + (amount - 1200000) * 0.20 }
                else { tax = 140000 + (amount - 1500000) * 0.30 }
            } else {
                if amount <= 60000000 { tax = amount * 0.05 }
                else if amount <= 250000000 { tax = 3000000 + (amount - 60000000) * 0.15 }
                else if amount <= 500000000 { tax = 31500000 + (amount - 250000000) * 0.25 }
                else { tax = 94000000 + (amount - 500000000) * 0.30 }
            }
            let currency = isIndia ? "INR" : "IDR"
            let rate = amount > 0 ? (tax / amount) * 100 : 0
            result.text = "Estimated tax: \(currency) \(Int(tax).formatted())\nEffective rate: \(String(format: "%.2f", rate))%\nTake-home: \(currency) \(Int(max(0, amount - tax)).formatted())"
        })
        stack.addArrangedSubview(result)
        return card
    }

    private func nativeDTAACalculatorCard() -> UIView {
        let card = nativeFormCard(title: "DTAA Tax Credit", symbol: "building.columns")
        let stack = card.subviews.compactMap { $0 as? UIStackView }.first!
        let income = nativeNumberField("Income earned in India (INR)", placeholder: "1000000")
        let taxPaid = nativeNumberField("Tax paid in India (INR)", placeholder: "100000")
        let foreignRate = nativeNumberField("Foreign tax rate (%)", placeholder: "20")
        let result = nativeResultLabel()
        stack.addArrangedSubview(income.container)
        stack.addArrangedSubview(taxPaid.container)
        stack.addArrangedSubview(foreignRate.container)
        stack.addArrangedSubview(nativeSmallButton("Calculate DTAA credit") {
            let inc = Double(income.field.text ?? "") ?? 0
            let paid = Double(taxPaid.field.text ?? "") ?? 0
            let rate = Double(foreignRate.field.text ?? "") ?? 0
            let foreignTax = inc * (rate / 100)
            let credit = min(paid, foreignTax)
            let net = max(0, foreignTax - credit)
            let burden = paid + net
            let effective = inc > 0 ? burden / inc * 100 : 0
            result.text = "Foreign tax on Indian income: INR \(Int(foreignTax).formatted())\nTax credit available: INR \(Int(credit).formatted())\nNet foreign tax payable: INR \(Int(net).formatted())\nEffective total burden: \(String(format: "%.2f", effective))%"
        })
        stack.addArrangedSubview(result)
        return card
    }

    private func nativeRequestFormCard(title: String, buttonTitle: String, successMessage: String) -> UIView {
        let card = nativeFormCard(title: title, symbol: "doc.text")
        let stack = card.subviews.compactMap { $0 as? UIStackView }.first!
        let name = nativeNumberField("Name", placeholder: "Your name")
        name.field.keyboardType = .default
        let email = nativeNumberField("Email", placeholder: "you@example.com")
        email.field.keyboardType = .emailAddress
        let notes = nativeNumberField("Notes", placeholder: "Briefly describe what you need")
        notes.field.keyboardType = .default
        let result = nativeResultLabel()
        result.text = "Fill the fields and submit. This stays inside the native app."
        stack.addArrangedSubview(name.container)
        stack.addArrangedSubview(email.container)
        stack.addArrangedSubview(notes.container)
        stack.addArrangedSubview(nativeSmallButton(buttonTitle) {
            let nameText = name.field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let emailText = email.field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !nameText.isEmpty, emailText.contains("@") else {
                result.text = "Please enter your name and a valid email."
                return
            }
            result.text = successMessage
        })
        stack.addArrangedSubview(result)
        return card
    }

    private func nativeConsultationFormCard() -> UIView {
        let card = nativeFormCard(title: "Book expert consultation", symbol: "person.2")
        let stack = card.subviews.compactMap { $0 as? UIStackView }.first!

        let name = nativeTextField("Full Name *", placeholder: "Your full name")
        let email = nativeTextField("Email *", placeholder: "your.email@example.com", keyboardType: .emailAddress)
        let phone = nativeTextField("Phone Number *", placeholder: "+1 234 567 8900", keyboardType: .phonePad)
        let whatsapp = nativeTextField("WhatsApp Number", placeholder: "+62 812 3456 7890", keyboardType: .phonePad)
        let contactMethod = nativeSegmentedField("Preferred Contact Method *", items: ["Email", "Phone", "WhatsApp"], selectedIndex: 0)
        let country = nativeTextField("Country of Residence *", placeholder: "United States")
        let timeZone = nativeTextField("Preferred Timezone *", placeholder: "Asia/Kolkata or America/New_York")
        let preferredDate = nativeTextField("Preferred Date *", placeholder: "YYYY-MM-DD")
        preferredDate.field.keyboardType = .numbersAndPunctuation
        let preferredTime = nativeTextField("Preferred Time *", placeholder: "09:00, 14:30, etc.")
        preferredTime.field.keyboardType = .numbersAndPunctuation
        let service = nativeSegmentedField("Service Required *", items: ["Planning", "DTAA", "ITR", "Other"], selectedIndex: 0)
        let query = nativeTextField("Tax Query Details *", placeholder: "Describe your tax situation and concerns")
        let result = nativeResultLabel()
        result.text = "All consultations are confidential and comply with ICAI standards."

        [
            name.container,
            email.container,
            phone.container,
            whatsapp.container,
            contactMethod.container,
            country.container,
            timeZone.container,
            preferredDate.container,
            preferredTime.container,
            service.container,
            query.container
        ].forEach { stack.addArrangedSubview($0) }

        stack.addArrangedSubview(nativeSmallButton("Submit Request") {
            let requiredFields = [
                name.field,
                email.field,
                phone.field,
                country.field,
                timeZone.field,
                preferredDate.field,
                preferredTime.field,
                query.field
            ]
            let missingRequired = requiredFields.contains { ($0.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            let emailText = email.field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let wantsWhatsApp = contactMethod.control.selectedSegmentIndex == 2
            let whatsappText = whatsapp.field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

            if missingRequired {
                result.text = "Please complete all required consultation fields."
                return
            }

            if !emailText.contains("@") || !emailText.contains(".") {
                result.text = "Please enter a valid email address."
                return
            }

            if wantsWhatsApp && whatsappText.isEmpty {
                result.text = "Please add your WhatsApp number or choose a different contact method."
                return
            }

            let selectedService = service.control.titleForSegment(at: service.control.selectedSegmentIndex) ?? "Consultation"
            result.text = "Consultation request captured for \(selectedService). NRITAX support can submit these details to the booking workflow next."
        })
        stack.addArrangedSubview(result)
        return card
    }

    private func nativeExpertApplicationFormCard() -> UIView {
        let card = nativeFormCard(title: "Expert Registration Form", symbol: "briefcase")
        let stack = card.subviews.compactMap { $0 as? UIStackView }.first!

        let fullName = nativeTextField("Full Name *", placeholder: "Enter your full name")
        let email = nativeTextField("Email *", placeholder: "Enter your email address", keyboardType: .emailAddress)
        let pincode = nativeTextField("Pincode *", placeholder: "6-digit pincode", keyboardType: .numberPad)
        let membership = nativeTextField("Membership Number *", placeholder: "Enter your membership number")
        let cop = nativeSegmentedField("COP *", items: ["Active", "Inactive", "N/A"], selectedIndex: UISegmentedControl.noSegment)
        let qualification = nativeSegmentedField("Qualification *", items: ["CA", "CPA", "Tax", "Other"], selectedIndex: UISegmentedControl.noSegment)
        let expertise = nativeSegmentedField("Area of Expertise *", items: ["DTAA", "FEMA", "Filing", "Other"], selectedIndex: UISegmentedControl.noSegment)
        let customQualification = nativeTextField("Other Qualification", placeholder: "Required if you choose Other")
        let customExpertise = nativeTextField("Other Expertise", placeholder: "Required if you choose Other")
        let profile = nativeResumeUploadField()
        let result = nativeResultLabel()
        result.text = "Your details will be reviewed by the NRITAX team before onboarding."

        [
            fullName.container,
            email.container,
            pincode.container,
            membership.container,
            cop.container,
            qualification.container,
            customQualification.container,
            expertise.container,
            customExpertise.container,
            profile.container
        ].forEach { stack.addArrangedSubview($0) }

        stack.addArrangedSubview(nativeSmallButton("Submit Application") {
            let requiredTextFields = [fullName.field, email.field, pincode.field, membership.field, profile.field]
            let hasMissingText = requiredTextFields.contains { ($0.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            let emailText = email.field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let pincodeText = pincode.field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let needsCustomQualification = qualification.control.selectedSegmentIndex == 3
            let needsCustomExpertise = expertise.control.selectedSegmentIndex == 3

            if hasMissingText || cop.control.selectedSegmentIndex == UISegmentedControl.noSegment || qualification.control.selectedSegmentIndex == UISegmentedControl.noSegment || expertise.control.selectedSegmentIndex == UISegmentedControl.noSegment {
                result.text = "Please fill all required expert onboarding fields."
                return
            }

            if !emailText.contains("@") || !emailText.contains(".") {
                result.text = "Please enter a valid email address."
                return
            }

            if pincodeText.count != 6 || Int(pincodeText) == nil {
                result.text = "Please enter a valid 6-digit pincode."
                return
            }

            if needsCustomQualification && (customQualification.field.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                result.text = "Please enter your qualification."
                return
            }

            if needsCustomExpertise && (customExpertise.field.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                result.text = "Please enter your area of expertise."
                return
            }

            result.text = "Expert onboarding application captured. In the web flow this is submitted with profile upload and CAPTCHA; native handoff can connect to the same webhook next."
        })
        stack.addArrangedSubview(result)
        return card
    }

    private func nativeResumeUploadField() -> (container: UIView, field: UITextField) {
        let container = UIStackView()
        container.axis = .vertical
        container.spacing = 8

        let title = UILabel()
        title.text = "Profile / Resume *"
        title.font = .systemFont(ofSize: 13, weight: .semibold)
        title.textColor = UIColor(hex: "475569")

        let field = UITextField()
        field.placeholder = "Choose PDF, DOC, or DOCX"
        field.borderStyle = .roundedRect
        field.backgroundColor = UIColor(hex: "F8FAFC")
        field.isUserInteractionEnabled = false
        field.heightAnchor.constraint(equalToConstant: 44).isActive = true
        expertResumeField = field

        let button = nativeSmallButton("Choose File") { [weak self] in
            self?.selectExpertResumeDocument()
        }

        let helper = UILabel()
        helper.text = "Opens Files, iCloud Drive, or synced Desktop folders. Accepted formats: PDF, DOC, DOCX."
        helper.font = .systemFont(ofSize: 12, weight: .regular)
        helper.textColor = UIColor(hex: "64748B")
        helper.numberOfLines = 0

        container.addArrangedSubview(title)
        container.addArrangedSubview(field)
        container.addArrangedSubview(button)
        container.addArrangedSubview(helper)
        return (container, field)
    }

    private func nativeProfilePhotoUploadField() -> (container: UIView, field: UITextField) {
        let container = UIStackView()
        container.axis = .vertical
        container.spacing = 8

        let title = UILabel()
        title.text = "Profile Photo"
        title.font = .systemFont(ofSize: 13, weight: .semibold)
        title.textColor = UIColor(hex: "475569")

        let field = UITextField()
        field.placeholder = "Choose PNG, JPG, WEBP, or GIF"
        field.borderStyle = .roundedRect
        field.backgroundColor = UIColor(hex: "F8FAFC")
        field.isUserInteractionEnabled = false
        field.text = nativeProfileImageFileName()
        field.heightAnchor.constraint(equalToConstant: 44).isActive = true
        profilePhotoField = field

        let button = nativeSmallButton("Upload Photo") { [weak self] in
            self?.selectNativeProfilePhoto()
        }

        let helper = UILabel()
        helper.text = "Choose a photo from Files, iCloud Drive, or a synced Desktop folder. It appears in Profile and the Home header."
        helper.font = .systemFont(ofSize: 12, weight: .regular)
        helper.textColor = UIColor(hex: "64748B")
        helper.numberOfLines = 0

        container.addArrangedSubview(title)
        container.addArrangedSubview(field)
        container.addArrangedSubview(button)
        container.addArrangedSubview(helper)
        return (container, field)
    }

    private func selectExpertResumeDocument() {
        activeDocumentPick = .expertResume
        let doc = UTType(filenameExtension: "doc") ?? .data
        let docx = UTType(filenameExtension: "docx") ?? .data
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.pdf, doc, docx], asCopy: true)
        picker.delegate = self
        picker.allowsMultipleSelection = false
        present(picker, animated: true)
    }

    private func selectNativeProfilePhoto() {
        activeDocumentPick = .profilePhoto
        let types: [UTType] = [.image, .png, .jpeg, UTType(filenameExtension: "webp") ?? .image, UTType(filenameExtension: "gif") ?? .image]
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
        picker.delegate = self
        picker.allowsMultipleSelection = false
        present(picker, animated: true)
    }

    private func nativeFormCard(title: String, symbol: String) -> UIView {
        let card = nativePlainCard()
        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 12
        card.addSubview(stack)
        let header = UILabel()
        header.text = title
        header.font = .systemFont(ofSize: 20, weight: .bold)
        header.textColor = UIColor(hex: "0F172A")
        stack.addArrangedSubview(header)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -20)
        ])
        return card
    }

    private func nativeNumberField(_ label: String, placeholder: String) -> (container: UIView, field: UITextField) {
        let container = UIStackView()
        container.axis = .vertical
        container.spacing = 6
        let title = UILabel()
        title.text = label
        title.font = .systemFont(ofSize: 13, weight: .semibold)
        title.textColor = UIColor(hex: "475569")
        let field = UITextField()
        field.placeholder = placeholder
        field.keyboardType = .decimalPad
        field.borderStyle = .roundedRect
        field.backgroundColor = UIColor(hex: "F8FAFC")
        field.heightAnchor.constraint(equalToConstant: 44).isActive = true
        container.addArrangedSubview(title)
        container.addArrangedSubview(field)
        return (container, field)
    }

    private func nativeTextField(_ label: String, placeholder: String, keyboardType: UIKeyboardType = .default) -> (container: UIView, field: UITextField) {
        let field = nativeNumberField(label, placeholder: placeholder)
        field.field.keyboardType = keyboardType
        field.field.autocapitalizationType = keyboardType == .emailAddress ? .none : .sentences
        field.field.autocorrectionType = keyboardType == .emailAddress ? .no : .default
        return field
    }

    private func nativeSegmentedField(_ label: String, items: [String], selectedIndex: Int) -> (container: UIView, control: UISegmentedControl) {
        let container = UIStackView()
        container.axis = .vertical
        container.spacing = 6

        let title = UILabel()
        title.text = label
        title.font = .systemFont(ofSize: 13, weight: .semibold)
        title.textColor = UIColor(hex: "475569")

        let control = UISegmentedControl(items: items)
        control.selectedSegmentIndex = selectedIndex
        control.selectedSegmentTintColor = UIColor(hex: "DBEAFE")
        control.setTitleTextAttributes([.foregroundColor: UIColor(hex: "0F172A")], for: .normal)
        control.setTitleTextAttributes([.foregroundColor: UIColor(hex: "1D4ED8")], for: .selected)
        control.heightAnchor.constraint(equalToConstant: 40).isActive = true

        container.addArrangedSubview(title)
        container.addArrangedSubview(control)
        return (container, control)
    }

    private func nativeResultLabel() -> UILabel {
        let label = UILabel()
        label.text = "Enter values and calculate."
        label.font = .systemFont(ofSize: 14, weight: .semibold)
        label.textColor = UIColor(hex: "0F172A")
        label.numberOfLines = 0
        label.backgroundColor = UIColor(hex: "EFF6FF")
        label.layer.cornerRadius = 12
        label.layer.masksToBounds = true
        return label
    }

    private func nativeSmallButton(_ title: String, action: @escaping () -> Void) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 15, weight: .bold)
        button.backgroundColor = UIColor(hex: "0F172A")
        button.layer.cornerRadius = 14
        button.heightAnchor.constraint(equalToConstant: 46).isActive = true
        button.addAction(UIAction { _ in action() }, for: .touchUpInside)
        return button
    }

    private func nativeSectionHeader(eyebrow: String, title: String) -> UIView {
        let container = UIView()
        container.translatesAutoresizingMaskIntoConstraints = false

        let eyebrowLabel = UILabel()
        eyebrowLabel.translatesAutoresizingMaskIntoConstraints = false
        eyebrowLabel.attributedText = NSAttributedString(
            string: eyebrow,
            attributes: [
                .font: UIFont.systemFont(ofSize: 12, weight: .heavy),
                .foregroundColor: UIColor(hex: "2563EB"),
                .kern: 0.8
            ]
        )
        container.addSubview(eyebrowLabel)

        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 24, weight: .heavy)
        titleLabel.textColor = UIColor(hex: "0F172A")
        titleLabel.numberOfLines = 0
        container.addSubview(titleLabel)

        NSLayoutConstraint.activate([
            container.heightAnchor.constraint(greaterThanOrEqualToConstant: 58),
            eyebrowLabel.topAnchor.constraint(equalTo: container.topAnchor),
            eyebrowLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            eyebrowLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            titleLabel.topAnchor.constraint(equalTo: eyebrowLabel.bottomAnchor, constant: 6),
            titleLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            titleLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            titleLabel.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])

        return container
    }

    private func nativeStatCard(label: String, value: String, description: String) -> UIView {
        let card = nativePlainCard()

        let labelView = UILabel()
        labelView.translatesAutoresizingMaskIntoConstraints = false
        labelView.text = label
        labelView.font = .systemFont(ofSize: 12, weight: .semibold)
        labelView.textColor = UIColor(hex: "6B7280")
        card.addSubview(labelView)

        let valueView = UILabel()
        valueView.translatesAutoresizingMaskIntoConstraints = false
        valueView.text = value
        valueView.font = .systemFont(ofSize: 28, weight: .bold)
        valueView.textColor = UIColor(hex: "0F172A")
        card.addSubview(valueView)

        let descriptionView = UILabel()
        descriptionView.translatesAutoresizingMaskIntoConstraints = false
        descriptionView.text = description
        descriptionView.font = .systemFont(ofSize: 13, weight: .regular)
        descriptionView.textColor = UIColor(hex: "6B7280")
        card.addSubview(descriptionView)

        NSLayoutConstraint.activate([
            labelView.topAnchor.constraint(equalTo: card.topAnchor, constant: 18),
            labelView.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18),
            labelView.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
            valueView.topAnchor.constraint(equalTo: labelView.bottomAnchor, constant: 8),
            valueView.leadingAnchor.constraint(equalTo: labelView.leadingAnchor),
            valueView.trailingAnchor.constraint(equalTo: labelView.trailingAnchor),
            descriptionView.topAnchor.constraint(equalTo: valueView.bottomAnchor, constant: 6),
            descriptionView.leadingAnchor.constraint(equalTo: labelView.leadingAnchor),
            descriptionView.trailingAnchor.constraint(equalTo: labelView.trailingAnchor)
        ])

        return card
    }

    private func nativeInfoCard(title: String, description: String, symbol: String) -> UIView {
        let card = nativePlainCard()

        let iconWrap = UIView()
        iconWrap.translatesAutoresizingMaskIntoConstraints = false
        iconWrap.backgroundColor = UIColor(hex: "E8EEFF")
        iconWrap.layer.cornerRadius = 14
        iconWrap.layer.cornerCurve = .continuous
        card.addSubview(iconWrap)

        let icon = UIImageView(image: UIImage(systemName: symbol))
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.tintColor = UIColor(hex: "1A3CFF")
        icon.contentMode = .scaleAspectFit
        iconWrap.addSubview(icon)

        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 16, weight: .bold)
        titleLabel.textColor = UIColor(hex: "0F172A")
        titleLabel.numberOfLines = 0
        card.addSubview(titleLabel)

        let descriptionLabel = UILabel()
        descriptionLabel.translatesAutoresizingMaskIntoConstraints = false
        descriptionLabel.text = description
        descriptionLabel.font = .systemFont(ofSize: 14, weight: .regular)
        descriptionLabel.textColor = UIColor(hex: "64748B")
        descriptionLabel.numberOfLines = 0
        card.addSubview(descriptionLabel)

        NSLayoutConstraint.activate([
            card.heightAnchor.constraint(greaterThanOrEqualToConstant: 116),
            iconWrap.topAnchor.constraint(equalTo: card.topAnchor, constant: 18),
            iconWrap.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18),
            iconWrap.widthAnchor.constraint(equalToConstant: 40),
            iconWrap.heightAnchor.constraint(equalToConstant: 40),
            icon.centerXAnchor.constraint(equalTo: iconWrap.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconWrap.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 22),
            icon.heightAnchor.constraint(equalToConstant: 22),
            titleLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 18),
            titleLabel.leadingAnchor.constraint(equalTo: iconWrap.trailingAnchor, constant: 14),
            titleLabel.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
            descriptionLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 6),
            descriptionLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            descriptionLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            descriptionLabel.bottomAnchor.constraint(lessThanOrEqualTo: card.bottomAnchor, constant: -18)
        ])

        return card
    }

    private func nativeUpdateCard(label: String, title: String, source: String) -> UIView {
        let card = nativePlainCard()

        let badge = UILabel()
        badge.translatesAutoresizingMaskIntoConstraints = false
        badge.text = label
        badge.font = .systemFont(ofSize: 10, weight: .heavy)
        badge.textColor = .white
        badge.textAlignment = .center
        badge.backgroundColor = UIColor(hex: "0F172A")
        badge.layer.cornerRadius = 8
        badge.layer.masksToBounds = true
        card.addSubview(badge)

        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 16, weight: .bold)
        titleLabel.textColor = UIColor(hex: "0F172A")
        titleLabel.numberOfLines = 0
        card.addSubview(titleLabel)

        let sourceLabel = UILabel()
        sourceLabel.translatesAutoresizingMaskIntoConstraints = false
        sourceLabel.text = "Source: \(source)"
        sourceLabel.font = .systemFont(ofSize: 13, weight: .regular)
        sourceLabel.textColor = UIColor(hex: "64748B")
        card.addSubview(sourceLabel)

        NSLayoutConstraint.activate([
            card.heightAnchor.constraint(greaterThanOrEqualToConstant: 128),
            badge.topAnchor.constraint(equalTo: card.topAnchor, constant: 18),
            badge.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18),
            badge.heightAnchor.constraint(equalToConstant: 24),
            badge.widthAnchor.constraint(greaterThanOrEqualToConstant: 88),
            titleLabel.topAnchor.constraint(equalTo: badge.bottomAnchor, constant: 12),
            titleLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18),
            titleLabel.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
            sourceLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            sourceLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            sourceLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            sourceLabel.bottomAnchor.constraint(lessThanOrEqualTo: card.bottomAnchor, constant: -18)
        ])

        return card
    }

    private func nativePlainCard() -> UIView {
        let card = UIView()
        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = .white
        card.layer.cornerRadius = 20
        card.layer.cornerCurve = .continuous
        card.layer.shadowColor = UIColor.black.cgColor
        card.layer.shadowOpacity = 0.08
        card.layer.shadowOffset = CGSize(width: 0, height: 2)
        card.layer.shadowRadius = 12
        return card
    }

    private func nativeTabButton(title: String, symbol: String, tint: UIColor, action: Selector?) -> UIButton {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.tintColor = tint
        button.setTitleColor(tint, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 11, weight: .semibold)
        button.setImage(UIImage(systemName: symbol), for: .normal)
        button.setTitle(title, for: .normal)
        button.alignImageAboveTitle(spacing: 4)
        if let action {
            button.addTarget(self, action: action, for: .touchUpInside)
        }
        return button
    }

    private func nativeUserFirstName() -> String {
        let object = nativeStoredUser()

        let fullName = (object["name"] as? String) ?? (object["fullName"] as? String) ?? ""
        let trimmed = fullName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let first = trimmed.split(separator: " ").first else {
            return "there"
        }

        return String(first)
    }

    @objc private func openNativeChat() {
        showNativeFeatureScreen(
            selectedTab: "chat",
            title: "AI Chat",
            subtitle: "Ask Yukti about NRI tax filing, DTAA, residency, remittances, deductions, and compliance.",
            cards: [
                nativeChatControlsCard(),
                nativeActionCard(
                    title: "Yukti is ready",
                    description: "Get guidance for India-US taxes, foreign income, rental income, capital gains, Form 15CA/15CB, and filing steps.",
                    symbol: "sparkles"
                ),
                nativeChatMessagesCard(),
                nativeChatComposerCard(),
                nativeStarterQuestionsCard(),
                nativeActionCard(
                    title: "Need expert review?",
                    description: "For complex filing or notice responses, connect with an NRITAX expert.",
                    symbol: "person.2",
                    buttonTitle: "Book consult",
                    action: #selector(openNativeConsult)
                )
            ]
        )
    }

    @objc private func openNativeReports() {
        openNativeProfile()
    }

    @objc private func openNativeCalculators() {
        showNativeFeatureScreen(
            selectedTab: "home",
            title: "Calculators",
            subtitle: "Free tools to help you understand NRI tax obligations, residency, income tax, and DTAA credits.",
            cards: [
                nativeResidencyCalculatorCard(),
                nativeIncomeCalculatorCard(),
                nativeDTAACalculatorCard(),
                nativeActionCard(
                    title: "Disclaimer",
                    description: "These are simplified estimates for educational purposes only. Consult a tax professional for accurate filing and personalized advice.",
                    symbol: "info.circle"
                )
            ]
        )
    }

    @objc private func openNativeConsult() {
        showNativeFeatureScreen(
            selectedTab: "home",
            title: "Consult",
            subtitle: "Get expert CPA support for personalized NRI tax planning, filing, notices, and cross-border questions.",
            cards: [
                nativeConsultationFormCard(),
                nativeActionCard(title: "Prepare for the call", description: "Keep passport travel dates, PAN, income documents, Form 16/26AS/AIS, bank details, and treaty documents ready.", symbol: "doc.text"),
                nativeActionCard(title: "Ask AI first", description: "Use AI Chat to draft your questions before speaking with an expert.", symbol: "sparkles", buttonTitle: "Open AI Chat", action: #selector(openNativeChat))
            ]
        )
    }

    @objc private func openNativeProfile() {
        showNativeFeatureScreen(
            selectedTab: "profile",
            title: "Profile",
            subtitle: "Manage your account, tax documents, reports, subscription, and expert consultation history.",
            cards: [
                nativeProfileSummaryCard(),
                nativeProfileDetailsCard(),
                nativeProfilePlanCard(),
                nativeProfilePasswordCard(),
                nativeActionCard(
                    title: "Reports and documents",
                    description: "Access generated reports, uploaded documents, filing notes, and planning summaries.",
                    symbol: "folder"
                ),
                nativeActionCard(
                    title: "Subscription",
                    description: "View plans and manage checkout for premium AI and expert features.",
                    symbol: "creditcard",
                    buttonTitle: "Subscribe / Plans",
                    action: #selector(openNativePricing)
                ),
                nativeProfileAccountActionsCard()
            ]
        )
    }

    private func nativeProfileSummaryCard() -> UIView {
        let user = nativeStoredUser()
        let card = nativePlainCard()

        let avatar = UIView()
        avatar.translatesAutoresizingMaskIntoConstraints = false
        avatar.backgroundColor = UIColor(hex: "DBEAFE")
        avatar.layer.cornerRadius = 32
        avatar.layer.cornerCurve = .continuous
        avatar.clipsToBounds = true
        card.addSubview(avatar)

        let avatarIcon = UIImageView(image: nativeProfileImage() ?? UIImage(systemName: "person.fill"))
        avatarIcon.translatesAutoresizingMaskIntoConstraints = false
        avatarIcon.tintColor = nativeProfileImage() == nil ? UIColor(hex: "2563EB") : nil
        avatarIcon.contentMode = nativeProfileImage() == nil ? .scaleAspectFit : .scaleAspectFill
        avatar.addSubview(avatarIcon)

        let eyebrow = UILabel()
        eyebrow.translatesAutoresizingMaskIntoConstraints = false
        eyebrow.text = "WELCOME"
        eyebrow.font = .systemFont(ofSize: 11, weight: .heavy)
        eyebrow.textColor = UIColor(hex: "64748B")
        card.addSubview(eyebrow)

        let name = UILabel()
        name.translatesAutoresizingMaskIntoConstraints = false
        name.text = user["name"] as? String ?? "NRITAX User"
        name.font = .systemFont(ofSize: 24, weight: .heavy)
        name.textColor = UIColor(hex: "0F172A")
        name.numberOfLines = 0
        card.addSubview(name)

        let email = UILabel()
        email.translatesAutoresizingMaskIntoConstraints = false
        email.text = user["email"] as? String ?? "Email not available"
        email.font = .systemFont(ofSize: 15, weight: .regular)
        email.textColor = UIColor(hex: "475569")
        email.numberOfLines = 0
        card.addSubview(email)

        let badge = UILabel()
        badge.translatesAutoresizingMaskIntoConstraints = false
        badge.text = "Starter Plan"
        badge.textAlignment = .center
        badge.font = .systemFont(ofSize: 12, weight: .bold)
        badge.textColor = UIColor(hex: "1D4ED8")
        badge.backgroundColor = UIColor(hex: "EFF6FF")
        badge.layer.cornerRadius = 12
        badge.layer.masksToBounds = true
        card.addSubview(badge)

        NSLayoutConstraint.activate([
            card.heightAnchor.constraint(greaterThanOrEqualToConstant: 138),
            avatar.topAnchor.constraint(equalTo: card.topAnchor, constant: 22),
            avatar.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            avatar.widthAnchor.constraint(equalToConstant: 64),
            avatar.heightAnchor.constraint(equalToConstant: 64),
            avatarIcon.topAnchor.constraint(equalTo: avatar.topAnchor),
            avatarIcon.leadingAnchor.constraint(equalTo: avatar.leadingAnchor),
            avatarIcon.trailingAnchor.constraint(equalTo: avatar.trailingAnchor),
            avatarIcon.bottomAnchor.constraint(equalTo: avatar.bottomAnchor),
            eyebrow.topAnchor.constraint(equalTo: avatar.topAnchor, constant: 2),
            eyebrow.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 16),
            eyebrow.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            name.topAnchor.constraint(equalTo: eyebrow.bottomAnchor, constant: 4),
            name.leadingAnchor.constraint(equalTo: eyebrow.leadingAnchor),
            name.trailingAnchor.constraint(equalTo: eyebrow.trailingAnchor),
            email.topAnchor.constraint(equalTo: name.bottomAnchor, constant: 4),
            email.leadingAnchor.constraint(equalTo: eyebrow.leadingAnchor),
            email.trailingAnchor.constraint(equalTo: eyebrow.trailingAnchor),
            badge.topAnchor.constraint(equalTo: email.bottomAnchor, constant: 12),
            badge.leadingAnchor.constraint(equalTo: eyebrow.leadingAnchor),
            badge.widthAnchor.constraint(greaterThanOrEqualToConstant: 106),
            badge.heightAnchor.constraint(equalToConstant: 28),
            badge.bottomAnchor.constraint(lessThanOrEqualTo: card.bottomAnchor, constant: -20)
        ])

        return card
    }

    private func nativeProfileDetailsCard() -> UIView {
        let user = nativeStoredUser()
        let card = nativeFormCard(title: "User Details", symbol: "person.text.rectangle")
        let stack = card.subviews.compactMap { $0 as? UIStackView }.first!
        let name = nativeTextField("Full Name", placeholder: "Full name")
        name.field.text = user["name"] as? String
        let email = nativeTextField("Email Address", placeholder: "Email", keyboardType: .emailAddress)
        email.field.text = user["email"] as? String
        email.field.isEnabled = false
        let linkedIn = nativeTextField("LinkedIn Profile", placeholder: "https://www.linkedin.com/in/your-profile", keyboardType: .URL)
        linkedIn.field.text = user["linkedinProfile"] as? String
        let photo = nativeProfilePhotoUploadField()
        let provider = nativeTextField("Sign-in Provider", placeholder: "local")
        provider.field.text = user["provider"] as? String ?? "local"
        provider.field.isEnabled = false
        let phone = nativeTextField("Phone", placeholder: "+1 555 123 4567", keyboardType: .phonePad)
        phone.field.text = user["phone"] as? String
        let country = nativeTextField("Country of Residence", placeholder: "United States")
        country.field.text = user["countryOfResidence"] as? String
        let language = nativeSegmentedField("Preferred Language", items: ["English", "Hindi", "Tamil", "Bahasa"], selectedIndex: 0)
        let bio = nativeTextField("Bio", placeholder: "Tell us about your tax profile goals")
        bio.field.text = user["bio"] as? String
        let result = nativeResultLabel()
        result.text = "Edit your profile details here. Saving can be connected to /api/auth/profile."

        [name.container, email.container, linkedIn.container, photo.container, provider.container, phone.container, country.container, language.container, bio.container].forEach { stack.addArrangedSubview($0) }
        stack.addArrangedSubview(nativeSmallButton("Save Changes") {
            let emailText = email.field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let linkedInText = linkedIn.field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !emailText.contains("@") {
                result.text = "Email is missing or invalid."
                return
            }
            if !linkedInText.isEmpty && !linkedInText.lowercased().contains("linkedin.com") {
                result.text = "LinkedIn profile must be a valid linkedin.com URL."
                return
            }
            var updated = self.nativeStoredUser()
            updated["name"] = name.field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            updated["email"] = emailText
            updated["linkedinProfile"] = linkedInText
            updated["provider"] = provider.field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "local"
            updated["phone"] = phone.field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            updated["countryOfResidence"] = country.field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            updated["preferredLanguage"] = language.control.titleForSegment(at: language.control.selectedSegmentIndex) ?? "English"
            updated["bio"] = bio.field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if let profileImage = UserDefaults.standard.string(forKey: "nritaxProfileImagePath"), !profileImage.isEmpty {
                updated["profileImage"] = profileImage
            }
            self.persistNativeUser(updated)
            self.openNativeProfile()
        })
        stack.addArrangedSubview(result)
        return card
    }

    private func nativeProfilePlanCard() -> UIView {
        let card = nativeFormCard(title: "Plan Details", symbol: "crown")
        let stack = card.subviews.compactMap { $0 as? UIStackView }.first!
        let details = nativeResultLabel()
        details.text = "Current Plan: Starter\nStart: Not available\nRenewal: Not available\nChat used this month: 0\nRemaining messages: 5\nMember since: Synced after profile API loads"
        stack.addArrangedSubview(details)
        stack.addArrangedSubview(nativeSmallButton("View Access / Manage") { [weak self] in
            self?.openNativePricing()
        })
        return card
    }

    private func nativeProfilePasswordCard() -> UIView {
        let card = nativeFormCard(title: "Change Password", symbol: "lock")
        let stack = card.subviews.compactMap { $0 as? UIStackView }.first!
        let current = nativeTextField("Current Password", placeholder: "Required for email accounts")
        current.field.isSecureTextEntry = true
        let newPassword = nativeTextField("New Password", placeholder: "At least 6 characters")
        newPassword.field.isSecureTextEntry = true
        let confirm = nativeTextField("Confirm New Password", placeholder: "Repeat new password")
        confirm.field.isSecureTextEntry = true
        let result = nativeResultLabel()
        result.text = "Use at least 6 characters. Confirm password must match exactly."
        [current.container, newPassword.container, confirm.container].forEach { stack.addArrangedSubview($0) }
        stack.addArrangedSubview(nativeSmallButton("Update Password") {
            let next = newPassword.field.text ?? ""
            let again = confirm.field.text ?? ""
            guard next.count >= 6 else {
                result.text = "New password must be at least 6 characters."
                return
            }
            guard next == again else {
                result.text = "Confirm password must match exactly."
                return
            }
            result.text = "Password update captured. This can be submitted to /api/auth/change-password."
        })
        stack.addArrangedSubview(result)
        return card
    }

    private func nativeProfileAccountActionsCard() -> UIView {
        let card = nativeFormCard(title: "Account Actions", symbol: "exclamationmark.triangle")
        let stack = card.subviews.compactMap { $0 as? UIStackView }.first!
        stack.addArrangedSubview(nativeSmallButton("Logout") { [weak self] in
            self?.logoutNativeUser()
        })
        stack.addArrangedSubview(nativeSmallButton("Delete Account") { [weak self] in
            self?.showNativeDeleteAccountConfirmation()
        })
        let note = nativeResultLabel()
        note.text = "Deleting account is permanent. Your profile and subscription mapping will be removed."
        stack.addArrangedSubview(note)
        return card
    }

    private func nativeStoredUser() -> [String: Any] {
        let userJSON = UserDefaults.standard.string(forKey: "nritaxNativeUser")
            ?? UserDefaults.standard.string(forKey: "pendingAuthUser")
            ?? ""
        guard !userJSON.isEmpty,
              let data = userJSON.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return [:]
        }
        return object
    }

    private func persistNativeUser(_ user: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(user),
              let data = try? JSONSerialization.data(withJSONObject: user, options: []),
              let json = String(data: data, encoding: .utf8) else {
            return
        }
        UserDefaults.standard.set(json, forKey: "nritaxNativeUser")
        UserDefaults.standard.set(json, forKey: "pendingAuthUser")
    }

    private func nativeProfileImageFileName() -> String {
        guard let path = UserDefaults.standard.string(forKey: "nritaxProfileImagePath"), !path.isEmpty else {
            return ""
        }
        return URL(fileURLWithPath: path).lastPathComponent
    }

    private func nativeProfileImage() -> UIImage? {
        let user = nativeStoredUser()
        let path = (UserDefaults.standard.string(forKey: "nritaxProfileImagePath") ?? user["profileImage"] as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !path.isEmpty else { return nil }
        if path.hasPrefix("http"), let url = URL(string: path), let data = try? Data(contentsOf: url) {
            return UIImage(data: data)
        }
        return UIImage(contentsOfFile: path)
    }

    private func storeNativeProfilePhoto(from url: URL) {
        let didAccess = url.startAccessingSecurityScopedResource()
        defer {
            if didAccess {
                url.stopAccessingSecurityScopedResource()
            }
        }

        guard let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            return
        }

        let destination = documents.appendingPathComponent("nritax-profile-photo-\(url.lastPathComponent)")
        try? FileManager.default.removeItem(at: destination)

        do {
            try FileManager.default.copyItem(at: url, to: destination)
            UserDefaults.standard.set(destination.path, forKey: "nritaxProfileImagePath")
            profilePhotoField?.text = destination.lastPathComponent
            var user = nativeStoredUser()
            user["profileImage"] = destination.path
            persistNativeUser(user)
            openNativeProfile()
        } catch {
            let alert = UIAlertController(
                title: "Profile Photo",
                message: "Could not import the selected photo: \(error.localizedDescription)",
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            present(alert, animated: true)
        }
    }

    private func logoutNativeUser() {
        UserDefaults.standard.removeObject(forKey: "pendingAuthToken")
        UserDefaults.standard.removeObject(forKey: "pendingAuthUser")
        UserDefaults.standard.removeObject(forKey: "nritaxNativeUser")
        UserDefaults.standard.removeObject(forKey: "nritaxProfileImagePath")
        let cookieStore = WKWebsiteDataStore.default().httpCookieStore
        cookieStore.getAllCookies { cookies in
            cookies.filter { $0.name == "token" || $0.domain.contains("nritax.ai") }.forEach { cookieStore.delete($0) }
            DispatchQueue.main.async {
                guard let window = self.view.window else { return }
                UIView.transition(with: window, duration: 0.35, options: .transitionCrossDissolve) {
                    window.rootViewController = NRITaxLoginViewController()
                }
            }
        }
    }

    private func showNativeDeleteAccountConfirmation() {
        let alert = UIAlertController(
            title: "Delete Account",
            message: "This is permanent. Type DELETE MY ACCOUNT to remove your NRITAX account and profile data.",
            preferredStyle: .alert
        )
        alert.addTextField { textField in
            textField.placeholder = "DELETE MY ACCOUNT"
            textField.autocapitalizationType = .allCharacters
            textField.autocorrectionType = .no
            textField.clearButtonMode = .whileEditing
        }
        alert.addAction(UIAlertAction(title: "Delete", style: .destructive) { [weak self, weak alert] _ in
            let phrase = alert?.textFields?.first?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard phrase == "DELETE MY ACCOUNT" else {
                self?.showNativeAccountMessage(
                    title: "Delete Account",
                    message: "Please type DELETE MY ACCOUNT exactly to continue."
                )
                return
            }
            self?.performNativeDeleteAccount()
        })
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        present(alert, animated: true)
    }

    private func performNativeDeleteAccount() {
        guard let token = nativeAuthToken(),
              let url = URL(string: "https://api.nritax.ai/api/auth/delete-account") else {
            showNativeAccountMessage(
                title: "Delete Account",
                message: "No active authenticated session was found. Please log in again, then try deleting your account."
            )
            return
        }

        let progress = UIAlertController(
            title: "Deleting Account",
            message: "Please wait while we remove your account.",
            preferredStyle: .alert
        )
        present(progress, animated: true)

        var request = URLRequest(url: url, timeoutInterval: 30)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self else { return }
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
            let serverMessage = self.nativeAPIMessage(from: data)

            DispatchQueue.main.async {
                progress.dismiss(animated: true) {
                    if let error {
                        self.showNativeAccountMessage(title: "Delete Account", message: error.localizedDescription)
                        return
                    }

                    guard (200...299).contains(statusCode) else {
                        self.showNativeAccountMessage(
                            title: "Delete Account",
                            message: serverMessage.isEmpty ? "Failed to delete account. Please try again." : serverMessage
                        )
                        return
                    }

                    self.logoutNativeUser()
                }
            }
        }.resume()
    }

    private func nativeAPIMessage(from data: Data?) -> String {
        guard let data,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return ""
        }
        return (json["message"] as? String ?? json["error"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func showNativeAccountMessage(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    @objc private func openNativePricing() {
        showNativeFeatureScreen(
            selectedTab: "profile",
            title: "Subscribe",
            subtitle: "Simple, transparent pricing from the web app, adapted for the native iOS shell.",
            cards: [
                nativePlanCard(
                    name: "Starter",
                    badge: "Current Free Plan",
                    price: "₹0",
                    detail: "Start with essential NRI tax tools and updates.",
                    features: [
                        ("5 AI chat messages per month", true),
                        ("Basic DTAA information", true),
                        ("Tax calculators", true),
                        ("Email support", true),
                        ("Access to tax updates", true),
                        ("Unlimited AI chat", false),
                        ("CPA consultation", false),
                        ("Advanced DTAA guidance", false)
                    ],
                    cta: "Included",
                    action: nil
                ),
                nativePlanCard(
                    name: "Professional",
                    badge: "Most Popular",
                    price: "₹999/month or ₹9,999/year",
                    detail: "For NRIs who need ongoing planning and faster support.",
                    features: [
                        ("Unlimited AI chat", true),
                        ("Advanced DTAA guidance", true),
                        ("All tax calculators", true),
                        ("Priority email support", true),
                        ("Personalized tax insights", true),
                        ("Dedicated advisor", true)
                    ],
                    cta: "Contact Support",
                    action: #selector(contactNativeSupport)
                ),
                nativePlanCard(
                    name: "Enterprise",
                    badge: "Custom",
                    price: "Custom",
                    detail: "Complete solution for high-touch tax and compliance needs.",
                    features: [
                        ("Everything in Professional", true),
                        ("Unlimited CPA consultations", true),
                        ("Dedicated advisor, high priority", true),
                        ("Priority response SLA", true),
                        ("Quarterly planning review", true),
                        ("Custom compliance workflows", true)
                    ],
                    cta: "Contact Support",
                    action: #selector(contactNativeSupport)
                ),
                nativeActionCard(
                    title: "Restore subscription",
                    description: "Already subscribed on the web? Sign in with the same account and your paid access will sync from the server.",
                    symbol: "arrow.clockwise",
                    buttonTitle: "Sync access",
                    action: #selector(showNativeRestoreNotice)
                )
            ]
        )
    }

    @objc private func openNativeJoinExpert() {
        showNativeFeatureScreen(
            selectedTab: "home",
            title: "Join Expert",
            subtitle: "Apply to support NRITAX users with CPA, CA, tax, accounting, and cross-border advisory expertise.",
            cards: [
                nativeExpertApplicationFormCard(),
                nativeActionCard(title: "What we look for", description: "NRI tax experience, strong client communication, filing/compliance knowledge, and verified credentials.", symbol: "checkmark.shield"),
                nativeActionCard(title: "Contact NRITAX", description: "For immediate onboarding questions, email the team directly.", symbol: "envelope", buttonTitle: "Email support", action: #selector(contactNativeSupport))
            ]
        )
    }

    @objc private func openNativeYukti() {
        showNativeFeatureScreen(
            selectedTab: "yukti",
            title: "Yukti",
            subtitle: "Your guided NRI tax assistant for choosing tools, asking questions, and finding the right next step.",
            cards: [
                nativeYuktiPromptCard(),
                nativeActionCard(
                    title: "Ask AI Tax Chat",
                    description: "Open the native AI chat screen for tax questions, residency guidance, DTAA relief, and ITR support.",
                    symbol: "message",
                    buttonTitle: "Open AI Chat",
                    action: #selector(openNativeChat)
                ),
                nativeActionCard(
                    title: "Use calculators",
                    description: "Estimate tax, compare residency outcomes, and prepare for filing decisions.",
                    symbol: "function",
                    buttonTitle: "Open calculators",
                    action: #selector(openNativeCalculators)
                ),
                nativeActionCard(
                    title: "Talk to an expert",
                    description: "Book personalized support when the answer depends on your documents or cross-border situation.",
                    symbol: "person.2",
                    buttonTitle: "Consult expert",
                    action: #selector(openNativeConsult)
                )
            ]
        )
    }

    @objc private func scrollNativeHomeToTaxUpdates() {
        guard let scrollView = nativeHomeScrollView,
              let section = nativeTaxUpdatesSection else { return }
        let origin = section.convert(CGPoint(x: 0, y: -12), to: scrollView)
        scrollView.setContentOffset(CGPoint(x: 0, y: max(origin.y, 0)), animated: true)
    }

    @objc private func showNativeHomeFromBottomNav() {
        nativeHomeView?.removeFromSuperview()
        nativeHomeView = nil
        showNativeAuthenticatedHome()
    }

    @objc private func handleNativeChatSend() {
        let question = nativeChatInputField?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !question.isEmpty else { return }
        nativeChatInputField?.text = ""
        nativeChatMessages.append((role: "user", text: question))
        nativeChatMessages.append((role: "ai", text: "Thinking..."))
        renderNativeChatMessages()
        sendNativeChatQuestion(question)
    }

    @objc private func handleNativeChatLanguageChanged() {
        let languages = ["english", "hindi", "tamil", "indonesian"]
        let index = nativeChatLanguageControl?.selectedSegmentIndex ?? 0
        nativeChatLanguage = languages.indices.contains(index) ? languages[index] : "english"
        clearNativeChat()
    }

    @objc private func clearNativeChat() {
        nativeChatMessages = [(role: "ai", text: nativeChatWelcomeMessage())]
        renderNativeChatMessages()
    }

    @objc private func showNativeTranscript() {
        let transcript = nativeChatMessages
            .map { "\($0.role == "user" ? "You" : "Yukti"): \($0.text)" }
            .joined(separator: "\n\n")
        let activity = UIActivityViewController(activityItems: [transcript], applicationActivities: nil)
        if let popover = activity.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        }
        present(activity, animated: true)
    }

    @objc private func showNativeCalculatorNotice() {
        presentErrorAlert(
            title: "Calculators",
            message: "This calculator tool is available in the native app shell. Use AI Chat for case-specific estimates while the full form UI is connected."
        )
    }

    @objc private func showNativeConsultNotice() {
        presentErrorAlert(
            title: "Consult",
            message: "Consult booking is ready in the native app shell. We can connect this button to the booking API next without opening the blank web page."
        )
    }

    @objc private func showNativeStarterNotice() {
        presentErrorAlert(
            title: "Starter Plan",
            message: "Starter access is included with your account."
        )
    }

    @objc private func showNativeSubscribeNotice() {
        presentErrorAlert(
            title: "Subscribe",
            message: "Paid purchases are hidden in this iOS build until Apple In-App Purchase is implemented. Existing paid access can still be restored by signing in with the same account."
        )
    }

    @objc private func showNativeRestoreNotice() {
        presentErrorAlert(
            title: "Restore Access",
            message: "Subscription access syncs from the server for the signed-in account. If you subscribed on the web, use the same login here."
        )
    }

    @objc private func showNativeJoinExpertNotice() {
        presentErrorAlert(
            title: "Join Expert",
            message: "Expert onboarding is ready in the native app shell. Email support to complete onboarding while the native form is connected."
        )
    }

    @objc private func contactNativeSupport() {
        if let url = URL(string: "mailto:ask@nritax.ai?subject=NRITAX.AI%20iOS%20Support") {
            UIApplication.shared.open(url)
        }
    }

    private func sendNativeChatQuestion(_ question: String) {
        guard let url = URL(string: "https://api.nritax.ai/api/chat") else {
            finishNativeChatReply(nativeChatFallbackReply())
            return
        }

        var request = URLRequest(url: url, timeoutInterval: 30)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(nativeGuestSessionId(), forHTTPHeaderField: "x-guest-session-id")
        if let token = nativeAuthToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "message": question,
            "language": nativeChatLanguage,
            "knowledgeSource": "dtaa"
        ])

        URLSession.shared.dataTask(with: request) { [weak self] data, _, error in
            guard let self else { return }
            guard error == nil,
                  let data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let reply = json["reply"] as? String,
                  !reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                DispatchQueue.main.async {
                    self.finishNativeChatReply(self.nativeChatFallbackReply())
                }
                return
            }

            DispatchQueue.main.async {
                self.finishNativeChatReply(self.cleanNativeReply(reply))
            }
        }.resume()
    }

    private func finishNativeChatReply(_ reply: String) {
        if let index = nativeChatMessages.lastIndex(where: { $0.role == "ai" && $0.text == "Thinking..." }) {
            nativeChatMessages[index] = (role: "ai", text: reply)
        } else {
            nativeChatMessages.append((role: "ai", text: reply))
        }
        renderNativeChatMessages()
    }

    private func nativeChatWelcomeMessage() -> String {
        switch nativeChatLanguage {
        case "hindi":
            return "Namaste. Main aapka AI tax assistant hoon. DTAA, NRI tax, residency, aur tax planning mein madad kar sakta hoon."
        case "tamil":
            return "Vanakkam. Naan ungal AI tax assistant. DTAA, NRI tax, residency, matrum tax planning-il uthava mudiyum."
        case "indonesian":
            return "Halo. Saya asisten pajak AI Anda untuk DTAA, pajak NRI, residensi, dan perencanaan pajak."
        default:
            return "Hi. I am your AI chat assistant. I can help with DTAA regulations, NRI tax queries, residency, and tax planning."
        }
    }

    private func nativeChatFallbackReply() -> String {
        switch nativeChatLanguage {
        case "hindi":
            return "Main filhaal live AI service access nahi kar paa raha hoon. Aap apna question dobara try kar sakte hain, ya urgent case mein CPA consultation use karein."
        case "tamil":
            return "Naan ippo live AI service-ai access panna mudiyala. Kelviya thirumba try pannunga, illaina urgent case-ku CPA consultation use pannunga."
        case "indonesian":
            return "Layanan AI langsung sedang tidak tersedia. Coba ulangi pertanyaan Anda, atau gunakan konsultasi CPA untuk kasus mendesak."
        default:
            return "I am temporarily unable to access live AI services. Your question was received locally. Please retry in a moment or use CPA Consultation for urgent cases."
        }
    }

    private func cleanNativeReply(_ text: String) -> String {
        text
            .replacingOccurrences(of: "**", with: "")
            .replacingOccurrences(of: "__", with: "")
            .replacingOccurrences(of: "### ", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func nativeGuestSessionId() -> String {
        let key = "nritaxNativeGuestChatSession"
        if let existing = UserDefaults.standard.string(forKey: key), !existing.isEmpty {
            return existing
        }
        let next = "guest-\(UUID().uuidString)"
        UserDefaults.standard.set(next, forKey: key)
        return next
    }

    private func nativeAuthToken() -> String? {
        let token = UserDefaults.standard.string(forKey: "nritaxAuthToken")
            ?? UserDefaults.standard.string(forKey: "pendingAuthToken")
        let trimmed = token?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }

    private func openNativeRoute(_ route: String) {
        nativeHomeView?.removeFromSuperview()
        nativeHomeView = nil
        #if DEBUG
        openBundledRoute(route)
        #else
        loadURL(URL(string: "https://nritax.ai\(route)"))
        #endif
    }

    #if DEBUG
    private func openBundledRoute(_ route: String) {
        let normalizedRoute = route.hasPrefix("/") ? route : "/\(route)"
        guard webView.url?.isFileURL == true else {
            loadURL(bundledWebAppURL(path: normalizedRoute))
            return
        }

        pendingBundledRoute = normalizedRoute
        let escapedRoute = normalizedRoute
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let script = """
        try {
          var nextHash = '#\(escapedRoute)';
          if (window.location.hash !== nextHash) {
            window.location.hash = nextHash;
          }
          window.dispatchEvent(new HashChangeEvent('hashchange'));
          window.dispatchEvent(new PopStateEvent('popstate'));
          true;
        } catch (error) {
          console.error('[nritax-ios] bundled route navigation failed', error);
          false;
        }
        """

        webView.evaluateJavaScript(script) { [weak self] result, _ in
            guard let self else { return }
            if (result as? Bool) == true {
                self.pendingBundledRoute = nil
                self.finishLoadingState()
            } else {
                self.loadURL(self.bundledWebAppURL(path: normalizedRoute))
            }
        }
    }
    #endif

    /// Adds the native Sign in with Apple call-to-action above the web content on auth pages.
    private func setupAppleOverlay() {
        appleOverlay.translatesAutoresizingMaskIntoConstraints = false
        appleOverlay.layer.cornerRadius = 18
        appleOverlay.clipsToBounds = true
        appleOverlay.isHidden = true

        let contentView = appleOverlay.contentView
        contentView.layoutMargins = UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14)

        appleOverlayLabel.translatesAutoresizingMaskIntoConstraints = false
        appleOverlayLabel.text = "Use the native Apple sign-in flow if the website popup is blocked."
        appleOverlayLabel.font = .preferredFont(forTextStyle: .footnote)
        appleOverlayLabel.textColor = .secondaryLabel
        appleOverlayLabel.numberOfLines = 0
        appleOverlayLabel.textAlignment = .center

        contentView.addSubview(appleOverlayLabel)
        contentView.addSubview(appleButton)
        view.addSubview(appleOverlay)

        NSLayoutConstraint.activate([
            appleOverlay.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            appleOverlay.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            appleOverlay.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
            appleOverlayLabel.topAnchor.constraint(equalTo: contentView.layoutMarginsGuide.topAnchor),
            appleOverlayLabel.leadingAnchor.constraint(equalTo: contentView.layoutMarginsGuide.leadingAnchor),
            appleOverlayLabel.trailingAnchor.constraint(equalTo: contentView.layoutMarginsGuide.trailingAnchor),
            appleButton.topAnchor.constraint(equalTo: appleOverlayLabel.bottomAnchor, constant: 10),
            appleButton.leadingAnchor.constraint(equalTo: contentView.layoutMarginsGuide.leadingAnchor),
            appleButton.trailingAnchor.constraint(equalTo: contentView.layoutMarginsGuide.trailingAnchor),
            appleButton.heightAnchor.constraint(equalToConstant: 50),
            appleButton.bottomAnchor.constraint(equalTo: contentView.layoutMarginsGuide.bottomAnchor),
        ])
    }

    /// Starts the first navigation after clearing transient caches that may preserve a broken state.
    private func loadInitialPage() {
        clearTransientCachesIfNeeded { [weak self] in
            guard let self else { return }
            if let pending = UserDefaults.standard.string(forKey: "pendingInitialURL"),
               !pending.isEmpty, let pendingURL = URL(string: pending) {
                UserDefaults.standard.removeObject(forKey: "pendingInitialURL")
                self.loadURL(pendingURL)
            } else {
                self.loadURL(self.appURL)
            }
        }
    }

    /// Loads a URL with cache bypass headers so the reviewer does not get a stale login screen.
    private func loadURL(_ url: URL?) {
        guard let url else {
            showRetryState(message: "The app launch URL is invalid.")
            return
        }

        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        request.setValue("no-cache", forHTTPHeaderField: "Pragma")
        lastRequestedURL = url
        hideRetryState()
        activityIndicator.startAnimating()
        scheduleLoadingFallback()

        if url.isFileURL {
            pendingBundledRoute = url.fragment
            var fileURL = url
            if var components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
                components.fragment = nil
                fileURL = components.url ?? url
            }
            let readAccessURL = fileURL.deletingLastPathComponent()
            webView.loadFileURL(fileURL, allowingReadAccessTo: readAccessURL)
            return
        }

        webView.load(request)
    }

    private func scheduleLoadingFallback() {
        loadingTimeoutWorkItem?.cancel()
        let workItem = DispatchWorkItem { [weak self] in
            guard let self, self.activityIndicator.isAnimating else { return }
            self.activityIndicator.stopAnimating()
            self.hideRetryState()
            self.applyPendingBundledRouteIfNeeded()
        }
        loadingTimeoutWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 4.0, execute: workItem)
    }

    private func finishLoadingState() {
        loadingTimeoutWorkItem?.cancel()
        loadingTimeoutWorkItem = nil
        activityIndicator.stopAnimating()
        hideRetryState()
    }

    private func applyPendingBundledRouteIfNeeded() {
        guard let route = pendingBundledRoute, !route.isEmpty else {
            return
        }

        let normalizedRoute = route.hasPrefix("/") ? route : "/\(route)"
        let escapedRoute = normalizedRoute
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let script = """
        try {
          var nextHash = '#\(escapedRoute)';
          if (window.location.hash !== nextHash) {
            window.location.hash = nextHash;
          }
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        } catch (error) {
          console.error('[nritax-ios] bundled route apply failed', error);
        }
        """
        webView.evaluateJavaScript(script) { [weak self] _, _ in
            self?.pendingBundledRoute = nil
        }
    }

    /// Removes only caches and service-worker artifacts while preserving cookies and web storage.
    private func clearTransientCachesIfNeeded(completion: @escaping () -> Void) {
        let didReset = UserDefaults.standard.bool(forKey: cacheResetKey)
        let shouldReset = !didReset || !hasFinishedInitialLoad
        guard shouldReset else {
            URLCache.shared.removeAllCachedResponses()
            completion()
            return
        }

        let dataTypes: Set<String> = [
            WKWebsiteDataTypeDiskCache,
            WKWebsiteDataTypeMemoryCache,
            WKWebsiteDataTypeFetchCache,
            WKWebsiteDataTypeOfflineWebApplicationCache,
            WKWebsiteDataTypeServiceWorkerRegistrations,
            // NOTE: WKWebsiteDataTypeCookies is intentionally NOT included
            // to preserve reCAPTCHA session tokens
        ]

        WKWebsiteDataStore.default().removeData(ofTypes: dataTypes, modifiedSince: .distantPast) {
            URLCache.shared.removeAllCachedResponses()
            UserDefaults.standard.set(true, forKey: self.cacheResetKey)
            completion()
        }
    }

    /// Returns whether a host belongs to nritax.ai, Google, or their subdomains.
    private func isAllowedHost(_ host: String?) -> Bool {
        guard let host = host?.lowercased() else {
            return false
        }

        // Allow nritax.ai and subdomains
        if host == allowedHostSuffix || host.hasSuffix(".\(allowedHostSuffix)") {
            return true
        }

        // Allow localhost and private LAN hosts for local development.
        if isLocalDevelopmentHost(host) {
            return true
        }

        // Allow social auth and reCAPTCHA domains inside the wrapper.
        let trustedAuthDomains = ["google.com", "gstatic.com", "recaptcha.net", "linkedin.com", "licdn.com"]
        for domain in trustedAuthDomains {
            if host == domain || host.hasSuffix(".\(domain)") {
                return true
            }
        }

        return false
    }

    private func isLocalDevelopmentHost(_ host: String?) -> Bool {
        guard let host = host?.lowercased() else {
            return false
        }

        if host == "localhost" || host == "127.0.0.1" || host == "::1" {
            return true
        }

        if host.hasPrefix("192.168.") || host.hasPrefix("10.") {
            return true
        }

        let parts = host.split(separator: ".").compactMap { Int($0) }
        if parts.count == 4, parts[0] == 172, (16...31).contains(parts[1]) {
            return true
        }

        return false
    }

    /// Returns whether the current URL should show the native Sign in with Apple overlay.
    private func shouldShowAppleOverlay(for url: URL?) -> Bool {
        false
    }

    /// Updates the overlay visibility and safe-area spacing based on the active page.
    private func updateAppleOverlayVisibility() {
        let shouldShow = shouldShowAppleOverlay(for: activePageURL) && !isHandlingAppleSignIn
        appleOverlay.isHidden = !shouldShow
        updateOverlayInsets()
    }

    /// Keeps the web view content clear of the Apple sign-in overlay on small windows and split view.
    private func updateOverlayInsets() {
        let bottomInset = appleOverlay.isHidden ? 0 : 108
        bottomConstraint?.constant = -CGFloat(bottomInset)
        view.layoutIfNeeded()
    }

    /// Updates the visibility of the back button based on whether the web view can go back.
    private func updateBackButtonVisibility() {
        let shouldShow = webView.canGoBack
        if shouldShow != !backButton.isHidden {
            UIView.animate(withDuration: 0.25) {
                self.backButton.alpha = shouldShow ? 1.0 : 0.0
            } completion: { _ in
                self.backButton.isHidden = !shouldShow
            }
        }
    }

    /// Shows the retry card with a friendly message instead of leaving the user on a blank screen.
    private func showRetryState(message: String) {
        retryMessageLabel.text = message
        retryContainer.isHidden = false
        appleOverlay.isHidden = true
        activityIndicator.stopAnimating()
    }

    /// Hides the retry card once loading can proceed again.
    private func hideRetryState() {
        retryContainer.isHidden = true
        updateAppleOverlayVisibility()
    }

    /// Presents a native error alert for Apple sign-in and other user-facing failures.
    private func presentErrorAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    /// Presents a native confirmation alert after session injection succeeds.
    private func presentSuccessAlert(message: String) {
        let alert = UIAlertController(title: "Signed In", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Continue", style: .default))
        present(alert, animated: true)
    }

    /// Prints step-by-step Apple sign-in diagnostics for App Review and device logs.
    private func logAppleSignIn(_ message: String) {
        print("[nritax-ios][apple-auth] \(message)")
    }

    /// Appends the demo-account fallback after repeated Apple sign-in failures.
    private func decorateAppleFailureMessage(_ message: String) -> String {
        guard appleFailureCount >= 2 else {
            return message
        }

        return "\(message)\n\n\(demoCredentialsMessage)"
    }

    /// Starts the native Apple sign-in flow from the overlay button.
    @objc private func handleAppleButtonPressed() {
        startAppleSignIn()
    }

    /// Retries the last failed load after clearing transient caches again.
    @objc private func handleRetryButtonPressed() {
        clearTransientCachesIfNeeded { [weak self] in
            self?.loadURL(self?.lastFailedURL ?? self?.appURL)
        }
    }

    /// Navigates back in the web view when the back button is tapped.
    @objc private func handleBackButtonPressed() {
        webView.goBack()
    }

    /// Reacts to Apple's revoked-credential notification and clears local auth state in the web app.
    @objc private func handleAppleCredentialRevoked() {
        let revokeScript = """
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          sessionStorage.removeItem('auth_popup');
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new Event('auth-changed'));
        } catch (error) {
          console.error('[nritax-ios] failed to clear revoked session', error);
        }
        """

        webView.evaluateJavaScript(revokeScript)
        presentErrorAlert(
            title: "Apple Sign-In Expired",
            message: "Your Apple credentials were revoked. Please sign in again."
        )
        loadURL(appURL)
    }

    /// Observes Apple credential revocation so the app can surface a clear message.
    private func registerForAppleCredentialRevocation() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppleCredentialRevoked),
            name: ASAuthorizationAppleIDProvider.credentialRevokedNotification,
            object: nil
        )
    }

    /// Starts the native ASAuthorization flow and hides the overlay while the sheet is active.
    private func startAppleSignIn() {
        guard !isHandlingAppleSignIn else {
            return
        }

        logAppleSignIn("Starting native Apple sign-in flow.")
        isHandlingAppleSignIn = true
        updateAppleOverlayVisibility()

        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.email, .fullName]

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        logAppleSignIn("Configured ASAuthorizationController with presentationContextProvider.")
        controller.performRequests()
    }

    /// Sends the native Apple credential payload to the backend and decodes the resulting session.
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
        let requestBody = AppleBackendRequest(
            identityToken: identityToken,
            authorizationCode: authorizationCode,
            email: credential.email,
            fullName: fullName?.isEmpty == true ? nil : fullName,
            name: fullName?.isEmpty == true ? nil : fullName,
            user: AppleBackendRequest.UserPayload(
                name: AppleBackendRequest.NamePayload(
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
                let backendResponse = try JSONDecoder().decode(AppleBackendResponse.self, from: data)
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

    /// Stores the returned session in web storage and refreshes the site into the logged-in state.
    private func injectAuthenticatedSession(token: String, user: AppleBackendUser?, displayName: String?) {
        let trimmedToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedToken.isEmpty else {
            logAppleSignIn("Session injection aborted because token was empty.")
            handleAppleFailure(message: "Sign in failed. Please try demo@nritax.ai / Demo@123456 instead.")
            return
        }

        logAppleSignIn("Preparing session injection into WKWebView. tokenLength=\(trimmedToken.count)")
        persistSessionCookie(token: token)

        let userLiteral = (try? jsonLiteral(for: user)) ?? "null"
        let tokenLiteral = (try? stringLiteral(for: trimmedToken)) ?? "''"
        let message = "WELCOME \(displayName?.isEmpty == false ? displayName ?? "User" : "User")!"
        let messageLiteral = (try? stringLiteral(for: message)) ?? "'Signed in successfully.'"
        let dashboardLiteral = (try? stringLiteral(for: dashboardURL?.absoluteString ?? homeURL?.absoluteString ?? appURL?.absoluteString ?? "https://nritax.ai/dashboard")) ?? "'https://nritax.ai/dashboard'"

        let script = """
        try {
          localStorage.setItem('token', \(tokenLiteral));
          localStorage.setItem('user', JSON.stringify(\(userLiteral)));
          document.cookie = 'token=' + encodeURIComponent(\(tokenLiteral)) + '; path=/; domain=.nritax.ai; Secure; SameSite=None';
          sessionStorage.setItem('auth_popup', \(messageLiteral));
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new Event('auth-changed'));
          window.dispatchEvent(new CustomEvent('nritax:auth-popup', {
            detail: { message: \(messageLiteral), type: 'success', duration: 1000 }
          }));
          window.location.href = \(dashboardLiteral);
        } catch (error) {
          console.error('[nritax-ios] failed to persist auth session', error);
          throw error;
        }
        true;
        """

        webView.evaluateJavaScript(script) { [weak self] _, error in
            guard let self else {
                return
            }

            if let error {
                self.logAppleSignIn("Session injection failed during evaluateJavaScript: \(error.localizedDescription)")
                self.handleAppleFailure(message: "Session injection failed: \(error.localizedDescription)")
                return
            }

            self.webView.evaluateJavaScript(self.dismissLoginModalScript(), completionHandler: nil) // FIX BUG 2: Remove any login modal that appears after the authenticated session is injected.
            self.logAppleSignIn("Session injection succeeded. Reloading authenticated dashboard.")
            self.appleFailureCount = 0
            self.isHandlingAppleSignIn = false
            self.updateAppleOverlayVisibility()
            self.updateBackButtonVisibility()
            self.presentSuccessAlert(message: message)
            self.loadURL(self.dashboardURL ?? self.homeURL ?? self.appURL)
        }
    }

    /// Persists the session token as a secure cookie for the website and its subdomains.
    private func persistSessionCookie(token: String) {
        guard
            let cookie = HTTPCookie(properties: [
                .domain: ".nritax.ai",
                .path: "/",
                .name: "token",
                .value: token,
                .secure: true,
                .expires: Date().addingTimeInterval(60 * 60 * 24 * 7),
            ])
        else {
            logAppleSignIn("Cookie creation failed for token persistence.")
            return
        }

        logAppleSignIn("Persisting auth cookie into WKWebView cookie store.")
        webView.configuration.websiteDataStore.httpCookieStore.setCookie(cookie)
    }

    /// Converts a Swift string into a JavaScript string literal safely.
    private func stringLiteral(for value: String) throws -> String {
        let data = try JSONEncoder().encode(value)
        guard let string = String(data: data, encoding: .utf8) else {
            throw WrapperError.serializationFailed
        }
        return string
    }

    /// Converts an encodable payload into a JavaScript object literal safely.
    private func jsonLiteral<T: Encodable>(for value: T?) throws -> String {
        guard let value else {
            return "null"
        }

        let data = try JSONEncoder().encode(value)
        guard let string = String(data: data, encoding: .utf8) else {
            throw WrapperError.serializationFailed
        }
        return string
    }

    /// Ends the Apple flow with a user-facing error and restores the overlay.
    private func handleAppleFailure(message: String) {
        appleFailureCount += 1
        logAppleSignIn("Apple sign-in failure #\(appleFailureCount): \(message)")
        isHandlingAppleSignIn = false
        updateAppleOverlayVisibility()
        presentErrorAlert(title: "Apple Sign-In Failed", message: decorateAppleFailureMessage(message))
    }

    /// Handles URLs that should leave the app instead of loading inside the WKWebView.
    private func openExternally(_ url: URL) {
        if url.scheme?.hasPrefix("http") == true, UIDevice.current.userInterfaceIdiom == .pad {
            let safariController = SFSafariViewController(url: url)
            present(safariController, animated: true)
            return
        }

        UIApplication.shared.open(url)
    }

    /// Makes responsive JavaScript choose the same compact layout used by the Android wrapper.
    private func mobileScreenWidthInjectionScript() -> String {
        #"""
        (function() {
          try {
            window.__NRITAX_IOS_WRAPPER__ = true;
            localStorage.setItem('nritax_ios_wrapper', 'true');
            Object.defineProperty(screen, 'width', {
              configurable: true,
              get: function() { return 390; }
            });
            Object.defineProperty(screen, 'availWidth', {
              configurable: true,
              get: function() { return 390; }
            });
            Object.defineProperty(window, 'innerWidth', {
              configurable: true,
              get: function() { return 390; }
            });
            Object.defineProperty(document.documentElement, 'clientWidth', {
              configurable: true,
              get: function() { return 390; }
            });
          } catch (error) {
            console.error('[nritax-ios] screen width injection failed', error);
          }
        })();
        """#
    }

    /// Returns a conservative script that injects a viewport tag and neutralizes common blockers.
    private func viewportInjectionScript() -> String {
        """
        (function() {
          try {
            window.__NRITAX_IOS_WRAPPER__ = true;
            localStorage.setItem('nritax_ios_wrapper', 'true');
            var head = document.head || document.getElementsByTagName('head')[0];
            if (head) {
              var existingViewport = document.querySelector('meta[name=\"viewport\"]');
              if (!existingViewport) {
                existingViewport = document.createElement('meta');
                existingViewport.name = 'viewport';
                head.appendChild(existingViewport);
              }
              existingViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0');
            }
          } catch (error) {
            console.error('[nritax-ios] viewport injection failed', error);
          }
        })();
        """
    }

    /// Fixes the hosted login modal layout in iOS WKWebView without showing a duplicate native Apple sheet.
    private func loginPageFixScript() -> String {
        #"""
        (function() {
          function installLoginFixStyle() {
            var head = document.head || document.getElementsByTagName('head')[0];
            if (!head || document.getElementById('nritax-ios-login-fix-style')) return;

            var style = document.createElement('style');
            style.id = 'nritax-ios-login-fix-style';
            style.textContent = `
              html, body {
                width: 100% !important;
                min-height: 100dvh !important;
                overflow-x: hidden !important;
                -webkit-text-size-adjust: 100% !important;
              }

              body:has([role="dialog"]) {
                overflow: hidden !important;
              }

              [data-radix-dialog-overlay],
              [class*="overlay"],
              [class*="backdrop"] {
                position: fixed !important;
                inset: 0 !important;
              }

              [role="dialog"],
              [data-radix-dialog-content],
              [class*="DialogContent"],
              [class*="dialog-content"],
              [class*="modal-content"],
              [class*="auth"][class*="modal"] {
                width: min(92vw, 430px) !important;
                max-width: calc(100vw - 28px) !important;
                max-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 28px) !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                -webkit-overflow-scrolling: touch !important;
                border-radius: 18px !important;
                padding: 24px 28px !important;
                box-sizing: border-box !important;
                overscroll-behavior: contain !important;
              }

              [role="dialog"] > *,
              [data-radix-dialog-content] > *,
              [class*="DialogContent"] > *,
              [class*="dialog-content"] > *,
              [class*="modal-content"] > * {
                max-width: 100% !important;
              }

              [role="dialog"] h1,
              [role="dialog"] h2,
              [data-radix-dialog-content] h1,
              [data-radix-dialog-content] h2 {
                font-size: clamp(24px, 7vw, 30px) !important;
                line-height: 1.15 !important;
                letter-spacing: 0 !important;
              }

              [role="dialog"] p,
              [data-radix-dialog-content] p {
                line-height: 1.35 !important;
              }

              [role="dialog"] input,
              [data-radix-dialog-content] input,
              [class*="modal"] input {
                display: block !important;
                width: 100% !important;
                min-height: 48px !important;
                height: 48px !important;
                padding: 0 14px !important;
                border: 1px solid #dbe3ef !important;
                border-radius: 12px !important;
                background: #ffffff !important;
                color: #0f172a !important;
                font-size: 16px !important;
                line-height: 1.2 !important;
                opacity: 1 !important;
                visibility: visible !important;
                box-sizing: border-box !important;
                -webkit-appearance: none !important;
              }

              [role="dialog"] label,
              [data-radix-dialog-content] label,
              [class*="modal"] label {
                display: block !important;
                margin: 12px 0 6px !important;
                font-size: 14px !important;
                line-height: 1.2 !important;
                color: #0f172a !important;
              }

              [role="dialog"] button,
              [role="dialog"] a,
              [data-radix-dialog-content] button,
              [data-radix-dialog-content] a {
                max-width: 100% !important;
                min-height: 46px !important;
                box-sizing: border-box !important;
                white-space: normal !important;
                touch-action: manipulation !important;
              }

              [role="dialog"] button[type="submit"],
              [data-radix-dialog-content] button[type="submit"] {
                width: 100% !important;
                margin-top: 14px !important;
              }

              [role="dialog"] [class*="tabs"],
              [role="dialog"] [role="tablist"],
              [data-radix-dialog-content] [class*="tabs"],
              [data-radix-dialog-content] [role="tablist"] {
                width: 100% !important;
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 0 !important;
                min-height: 48px !important;
                border-radius: 16px !important;
                overflow: hidden !important;
              }

              [role="dialog"] [role="tab"],
              [data-radix-dialog-content] [role="tab"] {
                width: 100% !important;
                justify-content: center !important;
              }

              [role="dialog"] [aria-label*="Close"],
              [role="dialog"] button:has(svg),
              [data-radix-dialog-content] [aria-label*="Close"],
              [data-radix-dialog-content] button:has(svg) {
                min-height: 40px !important;
              }

              [role="dialog"] [class*="google"],
              [role="dialog"] [class*="Google"],
              [role="dialog"] iframe,
              [data-radix-dialog-content] [class*="google"],
              [data-radix-dialog-content] [class*="Google"],
              [data-radix-dialog-content] iframe {
                max-width: 100% !important;
                width: 100% !important;
              }

              [role="dialog"]::after,
              [data-radix-dialog-content]::after {
                content: "" !important;
                display: block !important;
                height: 8px !important;
              }
            `;
            head.appendChild(style);
          }

          function fixLoginModal() {
            installLoginFixStyle();

            var dialogs = Array.prototype.slice.call(document.querySelectorAll('[role="dialog"], [data-radix-dialog-content], [class*="modal"], [class*="DialogContent"]'));
            dialogs.forEach(function(dialog) {
              if (!(dialog instanceof HTMLElement)) return;
              var text = String(dialog.innerText || dialog.textContent || '').toLowerCase();
              if (text.indexOf('login') === -1 && text.indexOf('sign up') === -1 && text.indexOf('welcome to nritax') === -1) return;

              dialog.style.setProperty('max-height', 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 28px)', 'important');
              dialog.style.setProperty('overflow-y', 'auto', 'important');
              dialog.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
              dialog.style.setProperty('width', 'min(92vw, 430px)', 'important');
              dialog.style.setProperty('max-width', 'calc(100vw - 28px)', 'important');
              dialog.style.setProperty('box-sizing', 'border-box', 'important');
            });

            document.querySelectorAll('input').forEach(function(input) {
              if (!(input instanceof HTMLElement)) return;
              input.style.setProperty('display', 'block', 'important');
              input.style.setProperty('visibility', 'visible', 'important');
              input.style.setProperty('opacity', '1', 'important');
            });
          }

          fixLoginModal();
          document.addEventListener('DOMContentLoaded', fixLoginModal);
          window.addEventListener('load', fixLoginModal);
          setTimeout(fixLoginModal, 300);
          setTimeout(fixLoginModal, 1000);

          new MutationObserver(function() {
            clearTimeout(window.__NRITAX_IOS_LOGIN_FIX_TIMER__);
            window.__NRITAX_IOS_LOGIN_FIX_TIMER__ = setTimeout(fixLoginModal, 80);
          }).observe(document.documentElement || document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'open', 'aria-hidden']
          });
        })();
        """#
    }

    /// Forces Google and LinkedIn login buttons to remain visible and tappable inside iOS WKWebView.
    private func socialLoginVisibilityFixScript() -> String {
        #"""
        (function() {
          function installSocialLoginStyle() {
            var head = document.head || document.getElementsByTagName('head')[0];
            if (!head || document.getElementById('nritax-ios-social-login-fix')) return;

            var style = document.createElement('style');
            style.id = 'nritax-ios-social-login-fix';
            style.textContent = `
              [class*="google" i],
              [id*="google" i],
              [aria-label*="google" i],
              [data-provider*="google" i],
              [href*="google" i],
              button:has([class*="google" i]),
              button:has([alt*="google" i]),
              a:has([class*="google" i]),
              a:has([alt*="google" i]),
              [class*="linkedin" i],
              [class*="linked-in" i],
              [id*="linkedin" i],
              [id*="linked-in" i],
              [aria-label*="linkedin" i],
              [aria-label*="linkedIn" i],
              [data-provider*="linkedin" i],
              [href*="linkedin" i],
              button:has([class*="linkedin" i]),
              button:has([alt*="linkedin" i]),
              a:has([class*="linkedin" i]),
              a:has([alt*="linkedin" i]) {
                display: flex !important; /* FIX: Restore hidden Google/LinkedIn sign-in controls. */
                visibility: visible !important; /* FIX: Ensure social login buttons are not visually hidden on iOS. */
                opacity: 1 !important; /* FIX: Prevent transparent social login buttons. */
                pointer-events: auto !important; /* FIX: Allow taps on Google/LinkedIn buttons. */
                position: relative !important; /* FIX: Make z-index effective above modal layers. */
                z-index: 9999 !important; /* FIX: Keep social login buttons above overlapping wrappers. */
                width: 100% !important; /* FIX: Keep social login buttons usable in narrow iOS modals. */
                min-height: 46px !important; /* FIX: Preserve accessible tap target height. */
                align-items: center !important; /* FIX: Keep icon/text aligned after forcing display flex. */
                justify-content: center !important; /* FIX: Keep social login labels centered. */
              }

              [role="dialog"] [class*="social" i],
              [role="dialog"] [class*="oauth" i],
              [data-radix-dialog-content] [class*="social" i],
              [data-radix-dialog-content] [class*="oauth" i],
              [class*="modal" i] [class*="social" i],
              [class*="modal" i] [class*="oauth" i] {
                display: flex !important; /* FIX: Restore social login button container layout. */
                visibility: visible !important; /* FIX: Ensure social login container is visible. */
                opacity: 1 !important; /* FIX: Ensure social login container is opaque. */
                flex-direction: column !important; /* FIX: Stack Google and LinkedIn buttons cleanly. */
                gap: 10px !important; /* FIX: Add spacing between Google and LinkedIn buttons. */
                width: 100% !important; /* FIX: Prevent clipped social login container. */
                height: auto !important; /* FIX: Prevent zero-height social login container. */
                max-height: none !important; /* FIX: Prevent iOS modal CSS from clipping social buttons. */
                overflow: visible !important; /* FIX: Stop social buttons from being hidden by overflow. */
              }
            `;
            head.appendChild(style);
          }

          function fixSocialLoginButtons() {
            installSocialLoginStyle();
            var candidates = Array.prototype.slice.call(document.querySelectorAll('button, a, div[role="button"], [data-provider], [aria-label]'));
            candidates.forEach(function(el) {
              if (!(el instanceof HTMLElement)) return;
              var text = String(el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('data-provider') || el.href || '').toLowerCase();
              var className = String(el.className || '').toLowerCase();
              var id = String(el.id || '').toLowerCase();
              var isSocialLogin = text.indexOf('google') !== -1 ||
                text.indexOf('linkedin') !== -1 ||
                text.indexOf('linked in') !== -1 ||
                className.indexOf('google') !== -1 ||
                className.indexOf('linkedin') !== -1 ||
                className.indexOf('linked-in') !== -1 ||
                id.indexOf('google') !== -1 ||
                id.indexOf('linkedin') !== -1 ||
                id.indexOf('linked-in') !== -1;
              if (!isSocialLogin) return;

              el.style.setProperty('display', 'flex', 'important'); // FIX: Unhide Google/LinkedIn auth elements.
              el.style.setProperty('visibility', 'visible', 'important'); // FIX: Make social auth elements visible.
              el.style.setProperty('opacity', '1', 'important'); // FIX: Make social auth elements opaque.
              el.style.setProperty('pointer-events', 'auto', 'important'); // FIX: Make social auth elements tappable.
              el.style.setProperty('position', 'relative', 'important'); // FIX: Allow z-index above modal overlays.
              el.style.setProperty('z-index', '9999', 'important'); // FIX: Keep social auth elements above overlapping layers.
              el.style.setProperty('min-height', '46px', 'important'); // FIX: Preserve iOS tap target height.
            });
          }

          fixSocialLoginButtons();
          document.addEventListener('DOMContentLoaded', fixSocialLoginButtons);
          window.addEventListener('load', fixSocialLoginButtons);
          setTimeout(fixSocialLoginButtons, 300);
          setTimeout(fixSocialLoginButtons, 1000);
          setTimeout(fixSocialLoginButtons, 2000);
          new MutationObserver(function() {
            clearTimeout(window.__NRITAX_IOS_SOCIAL_LOGIN_TIMER__);
            window.__NRITAX_IOS_SOCIAL_LOGIN_TIMER__ = setTimeout(fixSocialLoginButtons, 80);
          }).observe(document.documentElement || document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'aria-hidden', 'hidden']
          });
        })();
        """#
    }

    /// Forces the dashboard sections visible, removes blank spacers, and restores iOS pricing navigation.
    private func dashboardCompletionInjectionScript() -> String {
        #"""
        (function() {
          if (window.__NRITAX_IOS_DASHBOARD_COMPLETION__) {
            return;
          }
          window.__NRITAX_IOS_DASHBOARD_COMPLETION__ = true;

          function installStyle() {
            var head = document.head || document.getElementsByTagName('head')[0];
            if (!head || document.getElementById('nritax-ios-dashboard-completion-style')) {
              return;
            }

            var style = document.createElement('style');
            style.id = 'nritax-ios-dashboard-completion-style';
            style.textContent = `
              * {
                visibility: visible !important;
              }

              [class*="welcome"],
              [class*="banner"],
              [class*="hero"],
              [class*="explore"],
              [class*="categories"],
              [class*="quick-action"],
              [class*="quickAction"],
              [class*="features"],
              [class*="stats"],
              [class*="updates"],
              [class*="pricing"],
              [class*="plans"] {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                height: auto !important;
                max-height: none !important;
                overflow: visible !important;
              }

              [aria-hidden="true"][class*="welcome"],
              [aria-hidden="true"][class*="banner"],
              [aria-hidden="true"][class*="hero"],
              [aria-hidden="true"][class*="explore"],
              [aria-hidden="true"][class*="categories"],
              [aria-hidden="true"][class*="quick-action"],
              [aria-hidden="true"][class*="features"],
              [aria-hidden="true"][class*="stats"],
              [aria-hidden="true"][class*="updates"],
              [aria-hidden="true"][class*="pricing"],
              [aria-hidden="true"][class*="plans"] {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
              }

              [class*="quick-action"],
              [class*="quickAction"] {
                position: relative !important;
              }

              [class*="quick-action"]::before,
              [class*="quickAction"]::before {
                content: "" !important;
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 12px !important;
                bottom: 12px !important;
                width: 4px !important;
                border-radius: 999px !important;
                background: #2563eb !important;
              }

              @media (min-width: 769px) {
                body {
                  font-size: 120% !important;
                }

                section,
                main > div,
                [class*="section"],
                [class*="welcome"],
                [class*="banner"],
                [class*="hero"],
                [class*="explore"],
                [class*="categories"],
                [class*="features"],
                [class*="stats"],
                [class*="updates"],
                [class*="pricing"],
                [class*="plans"] {
                  padding: 24px !important;
                }

                [class*="cards"],
                [class*="grid"],
                [class*="categories"],
                [class*="plans"],
                [class*="pricing"] {
                  display: grid !important;
                  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                  gap: 16px !important;
                  align-items: stretch !important;
                }

                [class*="card"],
                [class*="plan"],
                [class*="quick-action"],
                [class*="quickAction"] {
                  min-width: 0 !important;
                }
              }
            `;
            head.appendChild(style);
          }

          function normalize(value) {
            return String(value || '').trim().toLowerCase();
          }

          function forceDashboardSections(root) {
            if (!root || !root.querySelectorAll) {
              return;
            }

            var selectors = [
              '[class*="welcome"]',
              '[class*="banner"]',
              '[class*="hero"]',
              '[class*="explore"]',
              '[class*="categories"]',
              '[class*="quick-action"]',
              '[class*="quickAction"]',
              '[class*="features"]',
              '[class*="stats"]',
              '[class*="updates"]',
              '[class*="pricing"]',
              '[class*="plans"]'
            ].join(',');

            root.querySelectorAll(selectors).forEach(function(node) {
              if (!(node instanceof HTMLElement)) {
                return;
              }
              node.hidden = false;
              if (node.getAttribute('aria-hidden') === 'true') {
                node.setAttribute('aria-hidden', 'false');
              }
              node.style.setProperty('display', 'block', 'important');
              node.style.setProperty('visibility', 'visible', 'important');
              node.style.setProperty('opacity', '1', 'important');
              node.style.setProperty('height', 'auto', 'important');
              node.style.setProperty('max-height', 'none', 'important');
              node.style.setProperty('overflow', 'visible', 'important');
            });
          }

          function removeEmptySpacers() {
            var candidates = document.querySelectorAll('div, section');
            candidates.forEach(function(node) {
              if (!(node instanceof HTMLElement)) {
                return;
              }

              var id = normalize(node.id);
              var className = normalize(node.className);
              if (id === 'root' || id === 'app' || className.indexOf('nav') !== -1 || className.indexOf('tab') !== -1) {
                return;
              }

              var text = normalize(node.textContent);
              var hasMedia = node.querySelector('img, svg, canvas, video, iframe, button, a, input, textarea, select');
              var looksLikeSpacer = className.indexOf('spacer') !== -1 ||
                className.indexOf('empty') !== -1 ||
                className.indexOf('placeholder') !== -1 ||
                className.indexOf('skeleton') !== -1 ||
                node.getAttribute('data-spacer') === 'true';
              var rect = node.getBoundingClientRect();
              var style = window.getComputedStyle(node);
              var hasBlankHeight = rect.height > 24 && text.length === 0 && !hasMedia;
              var isMostlyMargin = parseFloat(style.marginTop || '0') + parseFloat(style.marginBottom || '0') > 32 && text.length === 0 && !hasMedia;

              if (looksLikeSpacer || hasBlankHeight || isMostlyMargin) {
                node.remove();
              }
            });
          }

          function applyFixes() {
            installStyle();
            forceDashboardSections(document);
            removeEmptySpacers();
          }

          applyFixes();
          window.addEventListener('load', applyFixes);
          document.addEventListener('DOMContentLoaded', applyFixes);
          setTimeout(applyFixes, 300);
          setTimeout(applyFixes, 1200);
          setTimeout(applyFixes, 2500);

          new MutationObserver(function() {
            window.requestAnimationFrame(applyFixes);
          }).observe(document.documentElement || document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
          });
        })();
        """#
    }

    /// Injects dashboard CSS that forces all key Android-matching sections to render in WKWebView.
    private func dashboardForceShowSectionsScript() -> String {
        #"""
        (function() {
          var dashboardFixCSS = `
            [class*="welcome"], [class*="banner"],
            [class*="explore"], [class*="categor"],
            [class*="quick"], [class*="action"],
            [class*="feature"], [class*="stat"],
            [class*="update"], [class*="pricing"],
            [class*="plan"], [class*="recent"] {
              display: block !important;
              visibility: visible !important;
              opacity: 1 !important;
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
            }
          `;

          function injectDashboardFixCSS() {
            var head = document.head || document.getElementsByTagName('head')[0];
            if (!head || document.getElementById('nritax-ios-dashboard-force-show-style')) {
              return;
            }
            var style = document.createElement('style');
            style.id = 'nritax-ios-dashboard-force-show-style';
            style.textContent = dashboardFixCSS;
            head.appendChild(style);
          }

          function forceDashboardSectionsVisible() {
            var selectors = [
              '[class*="welcome"]', '[class*="banner"]',
              '[class*="explore"]', '[class*="categor"]',
              '[class*="quick"]', '[class*="action"]',
              '[class*="feature"]', '[class*="stat"]',
              '[class*="update"]', '[class*="pricing"]',
              '[class*="plan"]', '[class*="recent"]'
            ].join(',');

            document.querySelectorAll(selectors).forEach(function(node) {
              if (!(node instanceof HTMLElement)) return;
              node.hidden = false;
              if (node.getAttribute('aria-hidden') === 'true') {
                node.setAttribute('aria-hidden', 'false');
              }
              node.style.setProperty('display', 'block', 'important');
              node.style.setProperty('visibility', 'visible', 'important');
              node.style.setProperty('opacity', '1', 'important');
              node.style.setProperty('height', 'auto', 'important');
              node.style.setProperty('max-height', 'none', 'important');
              node.style.setProperty('overflow', 'visible', 'important');
            });
          }

          function applyDashboardForceShow() {
            injectDashboardFixCSS();
            forceDashboardSectionsVisible();
          }

          applyDashboardForceShow();
          document.addEventListener('DOMContentLoaded', applyDashboardForceShow);
          window.addEventListener('load', applyDashboardForceShow);
          setTimeout(applyDashboardForceShow, 300);
          setTimeout(applyDashboardForceShow, 1200);

          new MutationObserver(function() {
            clearTimeout(window.__NRITAX_IOS_FORCE_SHOW_TIMER__);
            window.__NRITAX_IOS_FORCE_SHOW_TIMER__ = setTimeout(applyDashboardForceShow, 80);
          }).observe(document.documentElement || document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
          });
        })();
        """#
    }

    /// Builds missing dashboard sections when the wrapped web app does not render them in iOS WKWebView.
    private func dashboardMissingSectionsFallbackScript() -> String {
        #"""
        (function() {
          function isDashboardLikePage() {
            var path = String(window.location.pathname || '').toLowerCase();
            var bodyText = String(document.body && document.body.innerText || '').toLowerCase();
            return path.indexOf('dashboard') !== -1 ||
              path.indexOf('home') !== -1 ||
              bodyText.indexOf('dashboard') !== -1 ||
              bodyText.indexOf('ai tax assistant') !== -1 ||
              bodyText.indexOf('nritax.ai') !== -1;
          }

          function hasText(text) {
            var bodyText = String(document.body && document.body.innerText || '').toLowerCase();
            return bodyText.indexOf(String(text || '').toLowerCase()) !== -1;
          }

          function make(tag, className, text) {
            var el = document.createElement(tag);
            if (className) el.className = className;
            if (text) el.textContent = text;
            return el;
          }

          function installFallbackStyle() {
            var head = document.head || document.getElementsByTagName('head')[0];
            if (!head || document.getElementById('nritax-ios-dashboard-fallback-style')) return;
            var style = document.createElement('style');
            style.id = 'nritax-ios-dashboard-fallback-style';
            style.textContent = `
              #nritax-ios-dashboard-fallback {
                display: grid !important;
                gap: 16px !important;
                padding: 16px 16px calc(92px + env(safe-area-inset-bottom)) !important;
                background: #f6f8fc !important;
                color: #0f172a !important;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro", "Segoe UI", sans-serif !important;
              }
              #nritax-ios-dashboard-fallback * {
                box-sizing: border-box !important;
                visibility: visible !important;
                opacity: 1 !important;
              }
              .nritax-ios-welcome-banner {
                border-radius: 22px !important;
                padding: 22px !important;
                background: linear-gradient(135deg, #1638d8, #3b82f6) !important;
                color: white !important;
                box-shadow: 0 12px 28px rgba(37, 99, 235, 0.24) !important;
              }
              .nritax-ios-section-title {
                margin: 4px 0 10px !important;
                font-size: 18px !important;
                line-height: 1.2 !important;
                font-weight: 800 !important;
                color: #0f172a !important;
              }
              .nritax-ios-grid {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 12px !important;
              }
              .nritax-ios-card {
                position: relative !important;
                min-height: 94px !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: center !important;
                gap: 7px !important;
                border-radius: 18px !important;
                border: 1px solid rgba(15, 23, 42, 0.08) !important;
                background: white !important;
                padding: 16px 16px 16px 20px !important;
                color: #0f172a !important;
                text-decoration: none !important;
                box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08) !important;
                overflow: hidden !important;
              }
              .nritax-ios-card::before {
                content: "" !important;
                position: absolute !important;
                left: 0 !important;
                top: 14px !important;
                bottom: 14px !important;
                width: 5px !important;
                border-radius: 999px !important;
                background: var(--bar, #2563eb) !important;
              }
              .nritax-ios-card strong {
                display: block !important;
                font-size: 15px !important;
                line-height: 1.2 !important;
                color: #0f172a !important;
              }
              .nritax-ios-card span {
                display: block !important;
                font-size: 12px !important;
                line-height: 1.35 !important;
                color: #64748b !important;
              }
              .nritax-ios-stats {
                display: grid !important;
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                gap: 10px !important;
              }
              .nritax-ios-stat {
                min-height: 84px !important;
                border-radius: 18px !important;
                background: white !important;
                padding: 14px 10px !important;
                text-align: center !important;
                box-shadow: 0 8px 22px rgba(15, 23, 42, 0.07) !important;
              }
              .nritax-ios-stat strong {
                display: block !important;
                font-size: 22px !important;
                color: #1d4ed8 !important;
              }
              .nritax-ios-stat span {
                display: block !important;
                margin-top: 6px !important;
                font-size: 11px !important;
                color: #64748b !important;
              }
              .nritax-ios-pricing-upgrade {
                border-radius: 20px !important;
                padding: 18px !important;
                background: #0f172a !important;
                color: white !important;
                box-shadow: 0 12px 28px rgba(15, 23, 42, 0.22) !important;
              }
              .nritax-ios-pricing-upgrade a {
                display: inline-flex !important;
                margin-top: 12px !important;
                border-radius: 999px !important;
                background: white !important;
                color: #0f172a !important;
                padding: 10px 14px !important;
                font-size: 13px !important;
                font-weight: 800 !important;
                text-decoration: none !important;
              }
              @media (min-width: 700px) {
                #nritax-ios-dashboard-fallback {
                  max-width: 860px !important;
                  margin: 0 auto !important;
                  padding-left: 24px !important;
                  padding-right: 24px !important;
                }
              }
            `;
            head.appendChild(style);
          }

          function card(title, subtitle, href, color) {
            var el = make(href ? 'a' : 'div', 'nritax-ios-card');
            if (href) el.href = href;
            el.style.setProperty('--bar', color || '#2563eb');
            el.appendChild(make('strong', '', title));
            el.appendChild(make('span', '', subtitle));
            return el;
          }

          function section(title, children) {
            var wrapper = make('section', 'nritax-ios-fallback-section');
            wrapper.appendChild(make('h2', 'nritax-ios-section-title', title));
            children.forEach(function(child) { wrapper.appendChild(child); });
            return wrapper;
          }

          function buildFallbackDashboard() {
            if (!document.body || !isDashboardLikePage()) return;
            var path = String(window.location.pathname || '').toLowerCase();
            var bodyText = String(document.body && document.body.innerText || '').toLowerCase();
            if (path.indexOf('home') !== -1 && bodyText.indexOf('good morning') !== -1 && bodyText.indexOf('your ai tax assistant') !== -1) return; // FIX: Do not overlay the real iOS home dashboard with the fallback blue card.
            if (path.indexOf('ios-yukti') !== -1 || path.indexOf('yukti') !== -1) return; // FIX: Do not replace the Yukti page with dashboard fallback content.

            var existing = document.getElementById('nritax-ios-dashboard-fallback');
            var missingWelcome = !hasText('Welcome to NRITAX.AI');
            var missingCategories = !hasText('DTAA') || !hasText('ITR Filing');
            var missingActions = !hasText('Consult CPA') || !hasText('Join Expert');
            var missingStats = !hasText('4 Languages') || !hasText('<2 min');
            var missingUpdates = !hasText('Recent Updates');
            var missingPricing = !hasText('Upgrade') && !hasText('Pricing');

            if (!(missingWelcome || missingCategories || missingActions || missingStats || missingUpdates || missingPricing)) {
              if (existing) existing.remove();
              return;
            }

            installFallbackStyle();

            var root = existing || make('div', '');
            root.id = 'nritax-ios-dashboard-fallback';
            root.innerHTML = '';

            if (missingWelcome) {
              var welcome = make('section', 'nritax-ios-welcome-banner');
              welcome.appendChild(make('p', '', 'Welcome to NRITAX.AI'));
              var welcomeTitle = make('h1', '', 'Your cross-border tax dashboard');
              welcomeTitle.style.cssText = 'margin:8px 0 0!important;font-size:28px!important;line-height:1.1!important;font-weight:800!important;color:white!important;';
              welcome.appendChild(welcomeTitle);
              var welcomeCopy = make('p', '', 'Track NRI tax tasks, get AI help, consult experts, and stay ready for filing.');
              welcomeCopy.style.cssText = 'margin:10px 0 0!important;color:rgba(255,255,255,.86)!important;font-size:14px!important;line-height:1.45!important;';
              welcome.appendChild(welcomeCopy);
              root.appendChild(welcome);
            }

            if (missingCategories) {
              var categoryGrid = make('div', 'nritax-ios-grid');
              categoryGrid.appendChild(card('DTAA', 'Treaty relief and double-tax guidance', '/chat', '#2563eb'));
              categoryGrid.appendChild(card('ITR Filing', 'Filing support for NRI income', '/calculators', '#16a34a'));
              root.appendChild(section('Explore Categories', [categoryGrid]));
            }

            if (missingActions) {
              var actionsGrid = make('div', 'nritax-ios-grid');
              actionsGrid.appendChild(card('AI Chat', 'Ask YUKTI your tax question', '/chat', '#7c3aed'));
              actionsGrid.appendChild(card('Consult CPA', 'Book expert tax guidance', '/consult', '#0ea5e9'));
              actionsGrid.appendChild(card('Calculators', 'Estimate tax and savings', '/calculators', '#f59e0b'));
              actionsGrid.appendChild(card('Join Expert', 'Apply to the expert network', '/join-as-expert', '#ef4444'));
              root.appendChild(section('Quick Actions', [actionsGrid]));
            }

            if (missingStats) {
              var stats = make('div', 'nritax-ios-stats');
              [['24/7', 'AI assistance'], ['4 Languages', 'Global support'], ['<2 min', 'Fast answers']].forEach(function(item) {
                var stat = make('div', 'nritax-ios-stat');
                stat.appendChild(make('strong', '', item[0]));
                stat.appendChild(make('span', '', item[1]));
                stats.appendChild(stat);
              });
              root.appendChild(section('Key Features', [stats]));
            }

            if (missingUpdates) {
              var updates = make('div', '');
              updates.appendChild(card('Recent Updates', 'Latest residency, DTAA, and filing reminders are available in your dashboard.', '/dashboard', '#2563eb'));
              root.appendChild(section('Recent Updates', [updates]));
            }

            if (missingPricing) {
              var pricing = make('section', 'nritax-ios-pricing-upgrade');
              pricing.appendChild(make('h2', '', 'Upgrade your tax workflow'));
              pricing.lastChild.style.cssText = 'margin:0!important;font-size:21px!important;line-height:1.2!important;color:white!important;';
              var copy = make('p', '', 'Unlock deeper reports, guided filing support, and faster expert access.');
              copy.style.cssText = 'margin:8px 0 0!important;color:rgba(255,255,255,.78)!important;font-size:14px!important;line-height:1.45!important;';
              pricing.appendChild(copy);
              var link = make('a', '', 'View Pricing');
              link.href = '/pricing';
              pricing.appendChild(link);
              root.appendChild(pricing);
            }

            var target = document.querySelector('main') ||
              document.querySelector('[role="main"]') ||
              document.querySelector('#root > div') ||
              document.body;

            if (!existing) {
              target.appendChild(root);
            }
          }

          buildFallbackDashboard();
          document.addEventListener('DOMContentLoaded', buildFallbackDashboard);
          window.addEventListener('load', buildFallbackDashboard);
          window.addEventListener('popstate', function() { setTimeout(buildFallbackDashboard, 150); });
          setTimeout(buildFallbackDashboard, 500);
          setTimeout(buildFallbackDashboard, 1600);
          setTimeout(buildFallbackDashboard, 3500);

          new MutationObserver(function() {
            clearTimeout(window.__NRITAX_IOS_DASHBOARD_FALLBACK_TIMER__);
            window.__NRITAX_IOS_DASHBOARD_FALLBACK_TIMER__ = setTimeout(buildFallbackDashboard, 120);
          }).observe(document.documentElement || document.body, {childList:true, subtree:true});
        })();
        """#
    }

    /// Adds a Pricing tab to the web bottom navigation if the site bundle omits it on iOS.
    private func pricingNavInjectionScript() -> String {
        #"""
        (function() {
          if (window.__NRITAX_IOS_PRICING_NAV_FIX__) {
            return;
          }
          window.__NRITAX_IOS_PRICING_NAV_FIX__ = true;

          function normalize(value) {
            return String(value || '').trim().toLowerCase();
          }

          function findBottomNav() {
            var candidates = Array.prototype.slice.call(document.querySelectorAll(
              'nav, [class*="bottom-nav"], [class*="bottomNav"], [class*="tab-bar"], [class*="tabbar"], [class*="navbar"], [role="navigation"]'
            ));

            return candidates.find(function(candidate) {
              if (!(candidate instanceof HTMLElement)) return false;
              var rect = candidate.getBoundingClientRect();
              var style = window.getComputedStyle(candidate);
              var text = normalize(candidate.innerText || candidate.textContent);
              var hasTabs = candidate.querySelectorAll('a, button, [role="tab"]').length >= 2;
              var isBottomPosition = style.position === 'fixed' && rect.bottom >= window.innerHeight - 96;
              var hasBottomName = normalize(candidate.className).indexOf('bottom') !== -1 || normalize(candidate.className).indexOf('tab') !== -1;
              return hasTabs && (isBottomPosition || hasBottomName || /home|chat|consult|profile|account/.test(text));
            });
          }

          function navHasPricing(nav) {
            return Boolean(nav && nav.querySelector(
              'a[href="/pricing"], a[href$="/pricing"], a[href*="/pricing"], [data-nritax-ios-pricing-tab="true"], [aria-label="Pricing"]'
            ));
          }

          function iconMarkup() {
            return '<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"></path><path d="M7 7h.01"></path></svg>';
          }

          function routeToPricing(event) {
            if (event) {
              event.preventDefault();
              event.stopPropagation();
            }

            if (window.history && window.history.pushState) {
              window.history.pushState({}, '', '/pricing');
              window.dispatchEvent(new PopStateEvent('popstate'));
              window.dispatchEvent(new Event('locationchange'));
            } else {
              window.location.href = '/pricing';
            }
          }

          function escapeHTML(value) {
            return String(value || '').replace(/[&<>"']/g, function(character) {
              return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
              }[character];
            });
          }

          function installPricingStyle() {
            var head = document.head || document.getElementsByTagName('head')[0];
            if (!head || document.getElementById('nritax-ios-pricing-nav-style')) return;
            var style = document.createElement('style');
            style.id = 'nritax-ios-pricing-nav-style';
            style.textContent = `
              [data-nritax-ios-pricing-tab="true"] {
                min-width: 0 !important;
                flex: 1 1 0 !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 2px !important;
                color: inherit !important;
                text-decoration: none !important;
                font: inherit !important;
                border: 0 !important;
                background: transparent !important;
                touch-action: manipulation !important;
              }
              [data-nritax-ios-pricing-tab="true"] svg {
                display: block !important;
                width: 22px !important;
                height: 22px !important;
                margin: 0 auto 2px !important;
              }
              [data-nritax-ios-pricing-tab="true"] span {
                display: block !important;
                font-size: 10px !important;
                line-height: 1.1 !important;
                white-space: nowrap !important;
              }
              #nritax-ios-pricing-banner {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                margin: 16px !important;
                padding: 18px !important;
                border-radius: 18px !important;
                background: linear-gradient(135deg, #1d4ed8, #2563eb) !important;
                color: #ffffff !important;
                box-shadow: 0 14px 30px rgba(37, 99, 235, 0.28) !important;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro", "Segoe UI", sans-serif !important;
                box-sizing: border-box !important;
              }
              #nritax-ios-pricing-banner strong {
                display: block !important;
                margin: 0 !important;
                color: #ffffff !important;
                font-size: 18px !important;
                line-height: 1.2 !important;
              }
              #nritax-ios-pricing-banner p {
                margin: 8px 0 0 !important;
                color: rgba(255,255,255,.86) !important;
                font-size: 14px !important;
                line-height: 1.4 !important;
              }
              #nritax-ios-pricing-banner a {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                min-height: 40px !important;
                margin-top: 14px !important;
                padding: 0 16px !important;
                border-radius: 999px !important;
                background: #ffffff !important;
                color: #1d4ed8 !important;
                font-size: 14px !important;
                font-weight: 800 !important;
                text-decoration: none !important;
              }
            `;
            head.appendChild(style);
          }

          function currentPlanLabel() {
            try {
              var user = JSON.parse(localStorage.getItem('user') || '{}');
              var plan = user.plan || user.currentPlan || user.subscriptionPlan || user.subscription;
              if (plan && typeof plan === 'object') {
                plan = plan.name || plan.tier || plan.status;
              }
              plan = String(plan || '').trim();
              if (plan) return plan.charAt(0).toUpperCase() + plan.slice(1);
            } catch (_) {}

            var text = normalize(document.body && document.body.innerText);
            var match = text.match(/current plan\s*:?\s*([a-z0-9 _-]+)/i);
            if (match && match[1]) return match[1].trim();
            return 'Free';
          }

          function addPricingBanner() {
            if (!document.body || document.getElementById('nritax-ios-pricing-banner')) return;
            var path = normalize(window.location.pathname);
            if (path.indexOf('/pricing') !== -1) return;

            var banner = document.createElement('section');
            banner.id = 'nritax-ios-pricing-banner';
            banner.setAttribute('class', 'nritax-ios-pricing-banner pricing upgrade plan');
            banner.innerHTML = '<strong>Current plan: ' + escapeHTML(currentPlanLabel()) + '</strong><p>Upgrade for advanced reports, guided filing support, and faster expert access.</p><a href="/pricing">Upgrade</a>';

            var link = banner.querySelector('a');
            link.addEventListener('click', routeToPricing);

            var target = document.querySelector('main') ||
              document.querySelector('[role="main"]') ||
              document.querySelector('#root > div') ||
              document.body;
            target.insertBefore(banner, target.firstChild);
          }

          function addPricingTab() {
            installPricingStyle();
            var nav = findBottomNav();
            if (!nav) {
              addPricingBanner();
              return;
            }

            if (navHasPricing(nav)) return;

            var tabs = nav.querySelectorAll('a, button, [role="tab"]');
            if (tabs.length === 0) {
              addPricingBanner();
              return;
            }

            var lastTab = tabs[tabs.length - 1];
            var referenceTab = tabs[0];
            var pricingTab = referenceTab.cloneNode(false);
            pricingTab.setAttribute('data-nritax-ios-pricing-tab', 'true');
            pricingTab.setAttribute('aria-label', 'Pricing');
            pricingTab.className = referenceTab.className || lastTab.className || '';

            if (pricingTab.tagName === 'A') {
              pricingTab.href = '/pricing';
            } else {
              pricingTab.type = 'button';
            }

            pricingTab.innerHTML = iconMarkup() + '<span>Pricing</span>';
            pricingTab.addEventListener('click', routeToPricing);

            if (lastTab && lastTab.parentNode === nav) {
              nav.insertBefore(pricingTab, lastTab);
            } else {
              nav.appendChild(pricingTab);
            }

            if (!navHasPricing(nav)) {
              addPricingBanner();
            }
          }

          addPricingTab();
          document.addEventListener('DOMContentLoaded', addPricingTab);
          window.addEventListener('load', addPricingTab);
          window.addEventListener('popstate', addPricingTab);
          setTimeout(addPricingTab, 300);
          setTimeout(addPricingTab, 1200);

          new MutationObserver(function() {
            clearTimeout(window.__NRITAX_IOS_PRICING_NAV_TIMER__);
            window.__NRITAX_IOS_PRICING_NAV_TIMER__ = setTimeout(addPricingTab, 80);
          }).observe(document.documentElement || document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'href', 'aria-label']
          });
        })();
        """#
    }

    /// Removes blank dashboard placeholders and lets the page scroll to its natural height.
    private func emptySpaceFixScript() -> String {
        #"""
        (function() {
          var emptySpaceFix = `
            .empty-space, [class*="spacer"],
            [class*="placeholder"],
            [data-spacer="true"] {
              display: none !important;
            }
            html, body {
              min-height: 100dvh !important;
              height: auto !important;
              overflow-y: auto !important;
              background: #f6f8fc !important;
            }
            #root {
              min-height: 100dvh !important;
              height: auto !important;
              background: #f6f8fc !important;
            }
            main, [role="main"], #root > div {
              min-height: 100dvh !important;
              height: auto !important;
              padding-bottom: calc(76px + env(safe-area-inset-bottom)) !important;
              margin-bottom: 0 !important;
            }
            main > *:last-child,
            [role="main"] > *:last-child,
            #root > div > *:last-child {
              margin-bottom: 0 !important;
            }
          `;

          function injectEmptySpaceFix() {
            var head = document.head || document.getElementsByTagName('head')[0];
            if (!head || document.getElementById('nritax-ios-empty-space-style')) {
              return;
            }
            var style = document.createElement('style');
            style.id = 'nritax-ios-empty-space-style';
            style.textContent = emptySpaceFix;
            head.appendChild(style);
          }

          function removeLargeBlankAreas() {
            injectEmptySpaceFix();
            document.querySelectorAll('div, section, footer').forEach(function(node) {
              if (!(node instanceof HTMLElement)) return;
              var className = String(node.className || '').toLowerCase();
              var id = String(node.id || '').toLowerCase();
              if (id === 'root' || id === 'app' || className.indexOf('nav') !== -1 || className.indexOf('tab') !== -1 || id.indexOf('pricing-banner') !== -1) return;

              var style = window.getComputedStyle(node);
              var rect = node.getBoundingClientRect();
              var text = String(node.innerText || node.textContent || '').trim();
              var hasContent = text.length > 0 || node.querySelector('img, svg, canvas, video, iframe, button, a, input, textarea, select');
              var minHeight = parseFloat(style.minHeight || '0');
              var paddingBottom = parseFloat(style.paddingBottom || '0');
              var marginBottom = parseFloat(style.marginBottom || '0');
              var looksBlank = !hasContent && rect.height > 80;

              if (looksBlank || minHeight > 360 || paddingBottom > 120 || marginBottom > 120) {
                node.style.setProperty('min-height', '0', 'important');
                node.style.setProperty('height', hasContent ? 'auto' : '0', 'important');
                node.style.setProperty('padding-bottom', hasContent ? '16px' : '0', 'important');
                node.style.setProperty('margin-bottom', '0', 'important');
                node.style.setProperty('overflow', hasContent ? 'visible' : 'hidden', 'important');
              }
            });
          }

          removeLargeBlankAreas();
          document.addEventListener('DOMContentLoaded', removeLargeBlankAreas);
          window.addEventListener('load', removeLargeBlankAreas);
          setTimeout(removeLargeBlankAreas, 300);
          setTimeout(removeLargeBlankAreas, 1200);

          new MutationObserver(function() {
            clearTimeout(window.__NRITAX_IOS_EMPTY_SPACE_TIMER__);
            window.__NRITAX_IOS_EMPTY_SPACE_TIMER__ = setTimeout(removeLargeBlankAreas, 100);
          }).observe(document.documentElement || document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
          });
        })();
        """#
    }

    /// Returns a script that patches pointer-events on iPad so taps reach the in-page chat UI.
    private func pointerEventsInjectionScript() -> String {
        """
        (function() {
          if (window.__NRITAX_IOS_POINTER_FIX__) {
            return;
          }
          window.__NRITAX_IOS_POINTER_FIX__ = true;

          function enablePointerEvents(el) {
            if (!(el instanceof HTMLElement)) {
              return;
            }
            el.style.pointerEvents = 'auto';
            el.style.touchAction = 'manipulation';
            el.style.webkitTouchCallout = 'none';
            el.style.webkitUserSelect = 'auto';
          }

          function patchInteractiveElements(root) {
            if (!root || !root.querySelectorAll) {
              return;
            }
            var selector = 'a, button, input, textarea, select, summary, [role="button"], [onclick], [aria-label*="more"]';
            root.querySelectorAll(selector).forEach(enablePointerEvents);
          }

          function applyRootFix() {
            if (document.documentElement) {
              document.documentElement.style.pointerEvents = 'auto';
              document.documentElement.style.touchAction = 'manipulation';
            }
            if (document.body) {
              document.body.style.pointerEvents = 'auto';
              document.body.style.touchAction = 'manipulation';
            }
            patchInteractiveElements(document);
          }

          applyRootFix();
          var observer = new MutationObserver(applyRootFix);
          observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
          window.addEventListener('load', applyRootFix);
          setTimeout(applyRootFix, 500);
        })();
        """
    }

    /// Hides the floating web YUKTI widget in the iOS wrapper so it cannot cover the native home flow.
    private func iosFloatingYuktiWidgetFixScript() -> String {
        #"""
        (function() {
          if (window.__NRITAX_IOS_YUKTI_WIDGET_FIX__) {
            return;
          }
          window.__NRITAX_IOS_YUKTI_WIDGET_FIX__ = true;
          window.__NRITAX_IOS_WRAPPER__ = true;
          localStorage.setItem('nritax_ios_wrapper', 'true');

          function installStyle() {
            var head = document.head || document.getElementsByTagName('head')[0];
            if (!head || document.getElementById('nritax-ios-hide-floating-yukti-style')) {
              return;
            }

            var style = document.createElement('style');
            style.id = 'nritax-ios-hide-floating-yukti-style';
            style.textContent = `
              button[aria-label="Open YUKTI widget"],
              button[aria-label="Close YUKTI widget"] {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
              }
            `;
            head.appendChild(style);
          }

          function hideFloatingWidget() {
            var path = String(window.location.pathname || '').toLowerCase();
            if (path.indexOf('ios-yukti') !== -1 || path.indexOf('yukti') !== -1 || path.indexOf('tigerbot-avatar') !== -1 || path.indexOf('tigerbot-avator') !== -1) {
              var existingStyle = document.getElementById('nritax-ios-hide-floating-yukti-style');
              if (existingStyle && existingStyle.parentNode) {
                existingStyle.parentNode.removeChild(existingStyle);
              }
              Array.prototype.slice.call(document.querySelectorAll(
                'button[aria-label="Open YUKTI widget"], button[aria-label="Close YUKTI widget"]'
              )).forEach(function(control) {
                if (!(control instanceof HTMLElement)) return;
                var candidate = control.parentElement;
                while (candidate && candidate !== document.body) {
                  var style = window.getComputedStyle(candidate);
                  var text = String(candidate.innerText || candidate.textContent || '').toLowerCase();
                  if (style.position === 'fixed' && text.indexOf('yukti') !== -1) {
                    candidate.style.removeProperty('display');
                    candidate.style.removeProperty('visibility');
                    candidate.style.removeProperty('pointer-events');
                    candidate.removeAttribute('aria-hidden');
                    return;
                  }
                  candidate = candidate.parentElement;
                }
              });
              return;
            }
            installStyle();

            var controls = Array.prototype.slice.call(document.querySelectorAll(
              'button[aria-label="Open YUKTI widget"], button[aria-label="Close YUKTI widget"]'
            ));

            controls.forEach(function(control) {
              if (!(control instanceof HTMLElement)) {
                return;
              }

              var candidate = control.parentElement;
              while (candidate && candidate !== document.body) {
                var style = window.getComputedStyle(candidate);
                var text = String(candidate.innerText || candidate.textContent || '').toLowerCase();
                if (style.position === 'fixed' && text.indexOf('yukti') !== -1) {
                  candidate.style.setProperty('display', 'none', 'important');
                  candidate.style.setProperty('visibility', 'hidden', 'important');
                  candidate.style.setProperty('pointer-events', 'none', 'important');
                  candidate.setAttribute('aria-hidden', 'true');
                  return;
                }
                candidate = candidate.parentElement;
              }
            });
          }

          hideFloatingWidget();
          document.addEventListener('DOMContentLoaded', hideFloatingWidget);
          window.addEventListener('load', hideFloatingWidget);
          setTimeout(hideFloatingWidget, 250);
          setTimeout(hideFloatingWidget, 1000);

          new MutationObserver(function() {
            clearTimeout(window.__NRITAX_IOS_YUKTI_WIDGET_FIX_TIMER__);
            window.__NRITAX_IOS_YUKTI_WIDGET_FIX_TIMER__ = setTimeout(hideFloatingWidget, 60);
          }).observe(document.documentElement || document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'aria-label']
          });
        })();
        """#
    }

    /// Replaces a logo-only or otherwise blank hosted page with a usable native-style iOS home surface.
    private func iosBlankHomeRecoveryScript() -> String {
        #"""
        (function() {
          if (window.__NRITAX_IOS_BLANK_HOME_RECOVERY__) {
            return;
          }
          window.__NRITAX_IOS_BLANK_HOME_RECOVERY__ = true;
          window.__NRITAX_IOS_WRAPPER__ = true;
          localStorage.setItem('nritax_ios_wrapper', 'true');

          function getStoredUserName() {
            try {
              var raw = localStorage.getItem('user');
              if (!raw) return 'Guest';
              var user = JSON.parse(raw);
              var name = String(user && user.name || '').trim();
              return name ? name.split(/\s+/)[0] : 'Guest';
            } catch (_) {
              return 'Guest';
            }
          }

          function hasToken() {
            try {
              return Boolean(localStorage.getItem('token'));
            } catch (_) {
              return false;
            }
          }

          function hasUsableContent() {
            if (document.querySelector('[data-nritax-ios-recovery-home="true"]')) return true;
            if (document.querySelector('input[type="email"], input[type="password"], textarea')) return true;

            var text = String(document.body && document.body.innerText || '').replace(/\s+/g, ' ').trim();
            if (/your ai tax assistant|good morning|ai chat|calculate|consult/i.test(text)) return true;

            var interactiveCount = document.querySelectorAll('main button, main a[href], [role="main"] button, [role="main"] a[href]').length;
            return text.length > 180 && interactiveCount >= 2;
          }

          function shouldRecover() {
            if (!document.body) return false;
            if (hasUsableContent()) return false;

            var path = String(window.location.pathname || '/').toLowerCase();
            var text = String(document.body.innerText || '').replace(/\s+/g, ' ').trim();
            var root = document.getElementById('root');
            var rootHeight = root && root.getBoundingClientRect ? root.getBoundingClientRect().height : 0;
            var looksLikeLogoShell = /nritax/i.test(text) && text.length < 140;
            var routeShouldHaveHome = path === '/' || path === '/home' || path === '/dashboard' || path === '/login';
            var visuallyEmpty = text.length < 90 || rootHeight < window.innerHeight * 0.35;

            return routeShouldHaveHome && (looksLikeLogoShell || visuallyEmpty);
          }

          function make(tag, text, className) {
            var el = document.createElement(tag);
            if (className) el.className = className;
            if (text) el.textContent = text;
            return el;
          }

          function routeTo(path) {
            if (path === '/login') {
              window.dispatchEvent(new Event('nritax:require-login'));
              setTimeout(function() {
                if (!document.querySelector('[role="dialog"], input[type="email"], input[type="password"]')) {
                  window.location.href = '/login';
                }
              }, 180);
              return;
            }
            window.location.href = path;
          }

          function renderRecoveryHome() {
            if (!shouldRecover()) return;

            var userName = getStoredUserName();
            var signedIn = hasToken();
            document.documentElement.style.setProperty('background', '#f2f2f7', 'important');
            document.documentElement.style.setProperty('height', 'auto', 'important');
            document.body.innerHTML = '';
            document.body.style.cssText = 'margin:0!important;background:#f2f2f7!important;min-height:100dvh!important;font-family:-apple-system,BlinkMacSystemFont,"SF Pro","Segoe UI",sans-serif!important;color:#0f172a!important;';

            var style = document.createElement('style');
            style.textContent = `
              .nritax-ios-recovery {
                min-height: 100dvh;
                padding: calc(56px + env(safe-area-inset-top)) 16px calc(76px + env(safe-area-inset-bottom));
                box-sizing: border-box;
              }
              .nritax-ios-recovery-inner {
                max-width: 760px;
                margin: 0 auto;
                display: grid;
                gap: 18px;
              }
              .nritax-ios-recovery-top {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 20;
                height: calc(48px + env(safe-area-inset-top));
                padding: env(safe-area-inset-top) 16px 0;
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(26,60,255,.96);
                color: white;
                font-weight: 700;
                letter-spacing: 0;
                box-shadow: 0 1px 0 rgba(255,255,255,.2);
              }
              .nritax-ios-recovery-hero,
              .nritax-ios-recovery-card {
                border-radius: 22px;
                background: white;
                box-shadow: 0 2px 12px rgba(0,0,0,.08);
              }
              .nritax-ios-recovery-hero {
                padding: 22px;
              }
              .nritax-ios-recovery-eyebrow {
                margin: 0;
                color: #64748b;
                font-size: 13px;
                font-weight: 700;
              }
              .nritax-ios-recovery-title {
                margin: 8px 0 0;
                font-size: 32px;
                line-height: 1.05;
                color: #0f172a;
              }
              .nritax-ios-recovery-copy {
                margin: 12px 0 0;
                color: #475569;
                font-size: 15px;
                line-height: 1.5;
              }
              .nritax-ios-recovery-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 14px;
              }
              .nritax-ios-recovery-card {
                min-height: 112px;
                border: 0;
                padding: 18px;
                text-align: left;
                color: #0f172a;
                font: inherit;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
              }
              .nritax-ios-recovery-icon {
                width: 34px;
                height: 34px;
                border-radius: 12px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                background: #e8eeff;
                color: #1a3cff;
                font-weight: 800;
              }
              .nritax-ios-recovery-label {
                font-size: 15px;
                font-weight: 700;
              }
              .nritax-ios-recovery-primary {
                min-height: 52px;
                border: 0;
                border-radius: 18px;
                background: #1a3cff;
                color: white;
                font-size: 16px;
                font-weight: 800;
                box-shadow: 0 8px 22px rgba(26,60,255,.24);
              }
              .nritax-ios-recovery-nav {
                position: fixed;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 20;
                height: calc(56px + env(safe-area-inset-bottom));
                padding-bottom: env(safe-area-inset-bottom);
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                background: rgba(255,255,255,.94);
                border-top: 1px solid rgba(0,0,0,.12);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
              }
              .nritax-ios-recovery-tab {
                border: 0;
                background: transparent;
                color: #8e8e93;
                font-size: 10px;
                font-weight: 600;
              }
              .nritax-ios-recovery-tab:first-child {
                color: #1a3cff;
              }
            `;
            document.head.appendChild(style);

            var top = make('div', 'NRITAX.AI', 'nritax-ios-recovery-top');
            var root = make('main', '', 'nritax-ios-recovery');
            root.setAttribute('data-nritax-ios-recovery-home', 'true');
            var inner = make('section', '', 'nritax-ios-recovery-inner');
            var hero = make('section', '', 'nritax-ios-recovery-hero');
            hero.appendChild(make('p', 'Good morning, ' + userName + '!', 'nritax-ios-recovery-eyebrow'));
            hero.appendChild(make('h1', 'Your AI Tax Assistant', 'nritax-ios-recovery-title'));
            hero.appendChild(make('p', signedIn ? 'Continue with NRI tax help, calculators, expert consultation, and your profile.' : 'Sign in to access NRI tax help, calculators, expert consultation, and your profile.', 'nritax-ios-recovery-copy'));
            inner.appendChild(hero);

            var grid = make('div', '', 'nritax-ios-recovery-grid');
            [
              ['AI', 'AI Chat', '/chat'],
              ['₹', 'Calculate', '/calculators'],
              ['CP', 'Consult', '/consult'],
              ['ME', 'Profile', '/profile']
            ].forEach(function(item) {
              var card = make('button', '', 'nritax-ios-recovery-card');
              card.type = 'button';
              card.appendChild(make('span', item[0], 'nritax-ios-recovery-icon'));
              card.appendChild(make('span', item[1], 'nritax-ios-recovery-label'));
              card.addEventListener('click', function() { routeTo(item[2]); });
              grid.appendChild(card);
            });
            inner.appendChild(grid);

            if (!signedIn) {
              var login = make('button', 'Sign In', 'nritax-ios-recovery-primary');
              login.type = 'button';
              login.addEventListener('click', function() { routeTo('/login'); });
              inner.appendChild(login);
            }

            root.appendChild(inner);
            var nav = make('nav', '', 'nritax-ios-recovery-nav');
            [
              ['Home', '/home'],
              ['Chat', '/chat'],
              ['Consult', '/consult'],
              ['Pricing', '/pricing'],
              ['Profile', '/profile']
            ].forEach(function(item) {
              var tab = make('button', item[0], 'nritax-ios-recovery-tab');
              tab.type = 'button';
              tab.addEventListener('click', function() { routeTo(item[1]); });
              nav.appendChild(tab);
            });

            document.body.appendChild(top);
            document.body.appendChild(root);
            document.body.appendChild(nav);
          }

          function scheduleRecovery() {
            setTimeout(renderRecoveryHome, 450);
            setTimeout(renderRecoveryHome, 1200);
            setTimeout(renderRecoveryHome, 2500);
          }

          scheduleRecovery();
          document.addEventListener('DOMContentLoaded', scheduleRecovery);
          window.addEventListener('load', scheduleRecovery);
          window.addEventListener('popstate', scheduleRecovery);
        })();
        """#
    }

    /// Fixes iPad taps on three-dot and overflow menus inside the wrapped web dashboard.
    private func threeDotsFixScript() -> String {
        #"""
        (function() {
          function fixMenus() {
            var selectors = [
              '[class*="dots"]','[class*="menu-btn"]',
              '[class*="more"]','[class*="options"]',
              '[class*="kebab"]','[class*="ellipsis"]',
              'button[aria-label*="more"]',
              'button[aria-label*="menu"]'
            ];
            selectors.forEach(function(sel) {
              document.querySelectorAll(sel).forEach(function(el) {
                el.style.pointerEvents = 'auto';
                el.style.zIndex = '99999';
                el.style.position = 'relative';
                el.addEventListener('touchstart', function(e) {
                  e.stopPropagation();
                  el.click();
                }, {passive: true});
              });
            });
          }
          fixMenus();
          new MutationObserver(fixMenus)
            .observe(document.body || document.documentElement, {childList:true, subtree:true});
        })();
        """#
    }

    /// Returns a script that keeps popups, consent banners, and Apple sign-in taps from blocking auth.
    private func popupHandlingScript() -> String {
        """
        (function() {
          if (window.__NRITAX_IOS_POPUP_PATCHED__) {
            return;
          }
          window.__NRITAX_IOS_POPUP_PATCHED__ = true;

          var native = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nritaxNative;
          var clickTexts = ['accept', 'agree', 'allow', 'continue', 'got it', 'close', 'dismiss'];

          function post(action, payload) {
            if (!native) {
              return;
            }
            try {
              native.postMessage(Object.assign({ action: action }, payload || {}));
            } catch (error) {
              console.error('[nritax-ios] native message failed', error);
            }
          }

          function normalize(value) {
            return String(value || '').trim().toLowerCase();
          }

          function maybeHandleAppleTap(target) {
            var element = target && target.closest ? target.closest('button, a, div[role=\"button\"]') : null;
            if (!element) {
              return false;
            }
            var text = normalize(element.innerText || element.textContent || element.getAttribute('aria-label'));
            var hasAppleMarker =
              text.indexOf('apple') !== -1 ||
              normalize(element.id).indexOf('apple') !== -1 ||
              normalize(element.className).indexOf('apple') !== -1;
            if (!hasAppleMarker) {
              return false;
            }
            post('appleSignIn');
            return true;
          }

          function dismissBlockers() {
            var selectors = [
              'button',
              '[role=\"button\"]',
              '[aria-label]'
            ];
            selectors.forEach(function(selector) {
              document.querySelectorAll(selector).forEach(function(node) {
                var text = normalize(node.innerText || node.textContent || node.getAttribute('aria-label'));
                if (clickTexts.some(function(candidate) { return text === candidate || text.indexOf(candidate) === 0; })) {
                  node.click();
                }
              });
            });
          }

          window.open = function(url) {
            if (!url) {
              return null;
            }
            try {
              var parsed = new URL(url, window.location.href);
              if (parsed.hostname === 'nritax.ai' || parsed.hostname.endsWith('.nritax.ai')) {
                window.location.href = parsed.toString();
              } else {
                post('openExternal', { url: parsed.toString() });
              }
            } catch (error) {
              console.error('[nritax-ios] failed to normalize popup URL', error);
            }
            return null;
          };

          document.addEventListener('click', function(event) {
            if (maybeHandleAppleTap(event.target)) {
              event.preventDefault();
              event.stopPropagation();
            }
          }, true);

          dismissBlockers();
          new MutationObserver(dismissBlockers).observe(document.documentElement || document.body, {
            childList: true,
            subtree: true
          });
          window.addEventListener('load', dismissBlockers);
          setTimeout(dismissBlockers, 1200);
        })();
        """
    }

    /// Returns CSS/JS that keeps the AI chat visible, scrollable, and above the blue iOS background issue.
    private func aiChatVisibilityFixScript() -> String {
        #"""
        (function() {
          function installChatVisibilityFix() {
            var head = document.head || document.getElementsByTagName('head')[0];
            if (!head || document.getElementById('nritax-ios-ai-chat-visibility-fix')) return;
            var style = document.createElement('style');
            style.id = 'nritax-ios-ai-chat-visibility-fix';
            style.textContent = `
              [class*="chat"], [class*="message"],
              [class*="conversation"], [class*="thread"],
              [id*="chat"], [id*="message"] {
                background: #ffffff !important; /* FIX BUG 1: Make hidden chat surfaces white instead of blue. */
                color: #000000 !important; /* FIX BUG 1: Restore readable chat text. */
                visibility: visible !important; /* FIX BUG 1: Force chat UI visible. */
                opacity: 1 !important; /* FIX BUG 1: Force chat UI opaque. */
                display: flex !important; /* FIX BUG 1: Restore chat layout. */
                flex-direction: column !important; /* FIX BUG 1: Keep messages/input stacked vertically. */
                height: 100% !important; /* FIX BUG 1: Fill available chat page height. */
              }
              body, html, #root, #app,
              [class*="layout"], [class*="container"] {
                background: #ffffff !important; /* FIX BUG 1: Stop the blue background from covering chat. */
              }
              [class*="messages"], [class*="message-list"],
              [class*="conversation"], [class*="thread"],
              [role="log"] {
                overflow-y: auto !important; /* FIX BUG 1: Make chat messages scrollable. */
                -webkit-overflow-scrolling: touch !important; /* FIX BUG 1: Preserve smooth iOS scrolling. */
                flex: 1 1 auto !important; /* FIX BUG 1: Let messages occupy space above the input. */
                min-height: 0 !important; /* FIX BUG 1: Prevent flex overflow from hiding messages. */
              }
              [class*="input"], [class*="composer"],
              [class*="prompt"], form:has(textarea),
              form:has(input[type="text"]) {
                margin-top: auto !important; /* FIX BUG 1: Keep chat input area at the bottom. */
                flex: 0 0 auto !important; /* FIX BUG 1: Prevent input from stretching over messages. */
                background: #ffffff !important; /* FIX BUG 1: Keep input area visible. */
                z-index: 10 !important; /* FIX BUG 1: Keep input above scrollable messages. */
              }
              [class*="upgrade"],[class*="banner"],
              [class*="plan-card"] {
                position: relative !important; /* FIX BUG 5: Prevent upgrade card absolute/fixed overlap. */
                z-index: 1 !important; /* FIX BUG 5: Keep upgrade card below interactive overlays. */
                margin-bottom: 16px !important; /* FIX BUG 5: Add spacing below upgrade/pricing card. */
              }
            `;
            head.appendChild(style);
          }
          installChatVisibilityFix();
          document.addEventListener('DOMContentLoaded', installChatVisibilityFix);
          window.addEventListener('load', installChatVisibilityFix);
          new MutationObserver(installChatVisibilityFix)
            .observe(document.documentElement || document.body, {childList: true, subtree: true});
        })();
        """#
    }

    /// Returns JS that forces bottom nav items to receive iOS touch events and route correctly.
    private func bottomNavTouchFixScript() -> String {
        #"""
        (function() {
          function fixNavigation() {
            var navItems = document.querySelectorAll(
              'nav a, nav button, ' +
              '[class*="tab-item"], [class*="nav-item"], ' +
              '[class*="bottom-nav"] a, ' +
              '[class*="bottom-nav"] button, ' +
              '[class*="tabbar"] a, ' +
              '[class*="tabbar"] button, ' +
              '[role="tab"], [class*="tab-link"]'
            );
            navItems.forEach(function(item) {
              if (item.dataset.nritaxIosBottomNavFixed === 'true') return;
              item.dataset.nritaxIosBottomNavFixed = 'true';
              item.style.pointerEvents = 'auto'; // FIX BUG 3: Ensure taps are not swallowed by CSS.
              item.style.zIndex = '9999'; // FIX BUG 3: Raise nav items above overlays.
              item.style.position = 'relative'; // FIX BUG 3: Make z-index effective.
              item.style.cursor = 'pointer'; // FIX BUG 3: Preserve interactive affordance.

              item.addEventListener('touchstart',
              function(e) {
                e.stopPropagation(); // FIX BUG 3: Prevent parent wrappers from blocking tab taps.
                var label = String(item.innerText || item.textContent || item.getAttribute('aria-label') || '').toLowerCase();
                if (label.indexOf('yukti') !== -1) {
                  window.location.href = '/yukti'; // FIX: Force the Yukti bottom tab to open the Yukti route instead of the dashboard/home route.
                  return;
                }
                var href = item.getAttribute('href') ||
                  (item.querySelector('a') && item.querySelector('a').getAttribute('href'));
                if (href && href !== '#') {
                  window.location.href = href; // FIX BUG 3: Route anchor-based tabs explicitly.
                } else {
                  item.click(); // FIX BUG 3: Trigger button/tab click handlers on iOS touch.
                }
              }, {passive: false});
            });
          }
          fixNavigation();
          new MutationObserver(fixNavigation)
            .observe(document.body || document.documentElement, {childList: true, subtree: true});
        })();
        """#
    }

    /// Returns JS that makes Pricing and Plans links navigate to the Pricing route.
    private func pricingTouchFixScript() -> String {
        #"""
        (function() {
          function fixPricing() {
            var pricingItems = document.querySelectorAll(
              '[href*="pricing"],[href*="plans"],' +
              '[class*="pricing"],[class*="plans"]'
            );
            pricingItems.forEach(function(item) {
              if (item.dataset.nritaxIosPricingFixed === 'true') return;
              item.dataset.nritaxIosPricingFixed = 'true';
              item.style.pointerEvents = 'auto'; // FIX BUG 4: Ensure Pricing tab can receive touches.
              item.style.zIndex = '9999'; // FIX BUG 4: Keep Pricing target above overlapping layers.
              item.addEventListener('touchstart',
              function(e) {
                e.stopPropagation(); // FIX BUG 4: Stop parent nav handlers from eating the tap.
                window.location.href = '/pricing'; // FIX BUG 4: Force navigation to Pricing.
              }, {passive: false});
            });
          }
          fixPricing();
          new MutationObserver(fixPricing)
            .observe(document.body || document.documentElement, {childList: true, subtree: true});
        })();
        """#
    }

    /// Returns JS that removes login/sign-in modals after an authenticated session is injected.
    private func dismissLoginModalScript() -> String {
        #"""
        (function() {
          function closeModals() {
            var modals = document.querySelectorAll(
              '[class*="modal"],[class*="popup"],' +
              '[class*="overlay"],[class*="dialog"]'
            );
            modals.forEach(function(modal) {
              var text = modal.innerText || '';
              if (text.includes('Login') ||
                  text.includes('Sign in') ||
                  text.includes('Password') ||
                  text.includes('Email')) {
                modal.style.display = 'none'; // FIX BUG 2: Hide stale login modal after auth.
                modal.remove(); // FIX BUG 2: Remove stale login modal from DOM.
              }
            });
          }
          closeModals();
          setTimeout(closeModals, 500);
          setTimeout(closeModals, 1000);
          setTimeout(closeModals, 2000);
          new MutationObserver(closeModals)
            .observe(document.body || document.documentElement, {childList:true, subtree:true});
        })();
        """#
    }

    /// Returns JS that makes AI chat three-dots/kebab buttons respond to touch on iOS.
    private func threeDotsTouchFixScript() -> String {
        #"""
        (function() {
          function fixDots() {
            var selectors = [
              '[class*="dots"]','[class*="more-btn"]',
              '[class*="options-btn"]','[class*="menu-btn"]',
              'button[aria-label*="more" i]',
              'button[aria-label*="menu" i]',
              '[class*="kebab"]','[class*="ellipsis"]'
            ];
            selectors.forEach(function(sel) {
              document.querySelectorAll(sel)
              .forEach(function(el) {
                if (el.dataset.nritaxIosDotsFixed === 'true') return;
                el.dataset.nritaxIosDotsFixed = 'true';
                el.style.pointerEvents = 'auto'; // FIX BUG 6: Ensure overflow buttons can receive touches.
                el.style.zIndex = '99999'; // FIX BUG 6: Raise overflow buttons above chat layers.
                el.style.position = 'relative'; // FIX BUG 6: Make z-index effective.
                el.addEventListener('touchstart',
                function(e) {
                  e.stopPropagation(); // FIX BUG 6: Prevent chat container from swallowing the tap.
                  e.preventDefault(); // FIX BUG 6: Avoid iOS synthetic event conflicts.
                  el.click(); // FIX BUG 6: Open the menu using the site's existing click handler.
                }, {passive: false});
              });
            });
          }
          fixDots();
          new MutationObserver(fixDots)
            .observe(document.body || document.documentElement, {childList: true, subtree: true});
        })();
        """#
    }
}

/// Handles WKWebView navigation, popup windows, and native Apple sign-in triggers.
extension ViewController: WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    /// Decides whether a navigation should stay inside the wrapper or leave the app.
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        if url.isFileURL {
            decisionHandler(.allow)
            return
        }

        if let scheme = url.scheme?.lowercased(), ["tel", "mailto", "sms"].contains(scheme) {
            openExternally(url)
            decisionHandler(.cancel)
            return
        }

        if url.path.lowercased().contains("pricing") || // FIX BUG 4: Allow Pricing route navigation inside WKWebView.
            url.path.lowercased().contains("plans") || // FIX BUG 4: Allow Plans route aliases used by subscription pages.
            url.path.lowercased().contains("subscription") { // FIX BUG 4: Allow Subscription route aliases used by upgrade flows.
            decisionHandler(.allow)
            return
        }

        // FIX: Allow navigation to Google/LinkedIn domains (OAuth, reCAPTCHA, gstatic, etc.)
        if let host = url.host?.lowercased(),
           (host.contains("google.com") ||
            host.contains("gstatic.com") ||
            host.contains("recaptcha") ||
            host.contains("linkedin.com") ||
            host.contains("licdn.com")) {
            decisionHandler(.allow)
            return
        }

        // Explicitly keep the pricing route inside the WKWebView.
        if isAllowedHost(url.host), url.path.lowercased() == "/pricing" {
            let isLocalhost = isLocalDevelopmentHost(url.host)
            if !isLocalhost && url.scheme?.lowercased() == "http" {
                var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
                components?.scheme = "https"
                if let secureURL = components?.url {
                    loadURL(secureURL)
                    decisionHandler(.cancel)
                    return
                }
            }

            decisionHandler(.allow)
            return
        }

        if isAllowedHost(url.host) {
            // Allow all nritax.ai navigation, including dynamic app routes such as /chat, /dashboard, /consultation,
            // /pricing, and any nested paths or client-side route changes.
            let isLocalhost = isLocalDevelopmentHost(url.host)
            if !isLocalhost && url.scheme?.lowercased() == "http" {
                var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
                components?.scheme = "https"
                if let secureURL = components?.url {
                    loadURL(secureURL)
                    decisionHandler(.cancel)
                    return
                }
            }

            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
            return
        }

        openExternally(url)
        decisionHandler(.cancel)
    }

    /// Tracks top-level navigations so the overlay and retry state follow the active page.
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        activePageURL = webView.url
        activityIndicator.startAnimating()
        scheduleLoadingFallback()
        hideRetryState()
        updateBackButtonVisibility()
    }

    /// Hides the loading state after the main page and any redirects finish successfully.
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hasFinishedInitialLoad = true
        lastFailedURL = nil
        activePageURL = webView.url
        finishLoadingState()
        updateAppleOverlayVisibility()
        updateBackButtonVisibility()
        applyPendingBundledRouteIfNeeded()
        injectPendingSessionIfNeeded()
    }

    /// Injects the auth token and user from the native login screen into the WebView's localStorage.
    private func injectPendingSessionIfNeeded() {
        let token = UserDefaults.standard.string(forKey: "pendingAuthToken") ?? ""
        let user = UserDefaults.standard.string(forKey: "pendingAuthUser") ?? ""
        guard !token.isEmpty else { return }
        UserDefaults.standard.set(token, forKey: "nritaxAuthToken")
        if !user.isEmpty {
            UserDefaults.standard.set(user, forKey: "nritaxNativeUser")
        }
        UserDefaults.standard.removeObject(forKey: "pendingAuthToken")
        UserDefaults.standard.removeObject(forKey: "pendingAuthUser")

        let escaped = token.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
        let escapedUser = user.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
        let script = """
        try {
          localStorage.setItem('token', '\(escaped)');
          if ('\(escapedUser)'.length > 0) { localStorage.setItem('user', '\(escapedUser)'); }
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new Event('auth-changed'));
        } catch(e) {}
        """
        webView.evaluateJavaScript(script)
    }

    /// Converts top-level provisional load failures into a retry card instead of a blank white screen.
    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        handleNavigationFailure(error, currentURL: webView.url)
    }

    /// Converts committed navigation failures into a retry card instead of leaving stale content visible.
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleNavigationFailure(error, currentURL: webView.url)
    }

    /// Keeps popup requests inside the same WKWebView so auth flows do not open blank windows.
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        guard let url = navigationAction.request.url else {
            return nil
        }

        if isAllowedHost(url.host) {
            loadURL(url)
        } else {
            openExternally(url)
        }

        return nil
    }

    /// Handles JavaScript alerts using the native iOS alert controller.
    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        let alert = UIAlertController(title: "NRITAX.AI", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler()
        })
        present(alert, animated: true)
    }

    /// Allows the system to prompt for media capture on trusted nritax.ai pages.
    @available(iOS 15.0, *)
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        decisionHandler(isAllowedHost(origin.host) ? .prompt : .deny)
    }

    /// Receives bridge messages from injected JavaScript for Apple sign-in and external links.
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nritaxNative" else {
            return
        }

        guard let body = message.body as? [String: Any], let action = body["action"] as? String else {
            return
        }

        switch action {
        case "appleSignIn":
            startAppleSignIn()
        case "openExternal":
            guard let urlString = body["url"] as? String, let url = URL(string: urlString) else {
                return
            }
            openExternally(url)
        default:
            break
        }
    }

    /// Converts navigation failures into a clean retry state while ignoring benign cancellations.
    private func handleNavigationFailure(_ error: Error, currentURL: URL?) {
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
            return
        }

        let failedURL = currentURL ?? lastRequestedURL ?? appURL

        lastFailedURL = failedURL
        activePageURL = failedURL
        showRetryState(message: "The page could not be loaded. Please retry to continue signing in.")
    }
}

/// Handles native Sign in with Apple callbacks from AuthenticationServices.
extension ViewController: ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    /// Returns the window used to anchor the native Sign in with Apple sheet.
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        self.view.window!
    }

    /// Exchanges a successful Apple authorization result with the backend for a web session.
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        logAppleSignIn("ASAuthorizationController completed successfully.")
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            handleAppleFailure(message: "Apple did not return an Apple ID credential.")
            return
        }

        exchangeAppleCredential(with: credential)
    }

    /// Surfaces clear cancellation and failure messages from the native Apple sheet.
    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let nsError = error as NSError
        let message: String

        logAppleSignIn("ASAuthorizationController failed: \(nsError.domain) (\(nsError.code)) \(error.localizedDescription)")

        if nsError.domain == ASAuthorizationError.errorDomain,
           let authorizationError = ASAuthorizationError.Code(rawValue: nsError.code) {
            switch authorizationError {
            case .canceled:
                message = "You cancelled Sign in with Apple before it finished."
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

extension ViewController: UIDocumentPickerDelegate {
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else { return }
        switch activeDocumentPick {
        case .profilePhoto:
            activeDocumentPick = nil
            storeNativeProfilePhoto(from: url)
            return
        case .expertResume, .none:
            activeDocumentPick = nil
        }

        let didAccess = url.startAccessingSecurityScopedResource()
        defer {
            if didAccess {
                url.stopAccessingSecurityScopedResource()
            }
        }

        expertResumeField?.text = url.lastPathComponent
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        activeDocumentPick = nil
        expertResumeField?.text = expertResumeField?.text
    }
}

/// Defines wrapper-specific errors that should never be silently ignored.
private enum WrapperError: Error {
    case serializationFailed
}

/// Encodes the native Apple credential payload posted to the backend.
private struct AppleBackendRequest: Encodable {
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

/// Decodes the backend response required to restore the website session.
private struct AppleBackendResponse: Decodable {
    let success: Bool?
    let message: String?
    let error: String?
    let user: AppleBackendUser?
    let token: String?
}

/// Captures the auth user payload that the website already stores in localStorage.
private struct AppleBackendUser: Codable {
    let id: String?
    let _id: String?
    let name: String?
    let email: String?
    let provider: String?
    let profileImage: String?
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

private extension NSLayoutConstraint {
    func withPriority(_ priority: UILayoutPriority) -> NSLayoutConstraint {
        self.priority = priority
        return self
    }
}

private extension UIButton {
    func alignImageAboveTitle(spacing: CGFloat) {
        let titleText = title(for: .normal) ?? ""
        var title = AttributedString(titleText)
        title.font = titleLabel?.font ?? UIFont.systemFont(ofSize: 11, weight: .semibold)

        var configuration = UIButton.Configuration.plain()
        configuration.image = image(for: .normal)
        configuration.attributedTitle = title
        configuration.imagePlacement = .top
        configuration.imagePadding = spacing
        configuration.contentInsets = NSDirectionalEdgeInsets(top: spacing, leading: 0, bottom: spacing, trailing: 0)
        configuration.baseForegroundColor = tintColor
        self.configuration = configuration
    }
}
