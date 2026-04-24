package com.nritaxai.app; // Reverse-domain notation keeps the Java package globally unique for Play Store publishing.

import android.os.Bundle;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Allow the emulator build to call a local HTTP API such as 10.0.2.2:5000
        // even when the app itself is served from an HTTPS Capacitor origin.
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
    }
}
