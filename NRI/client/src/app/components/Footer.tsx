import { Globe, Mail, Phone, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="size-8 text-blue-400" />
              <span className="text-xl text-white">NRITAX<span className="text-blue-400">.AI</span></span>
            </div>
            <p className="text-sm">
              AI-powered tax solutions for Non-Resident Indians navigating global tax complexities.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/#features" className="hover:text-blue-400 transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/#updates" className="hover:text-blue-400 transition-colors">
                  Tax Updates
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-blue-400 transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/#compliance" className="hover:text-blue-400 transition-colors">
                  Compliance
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-white text-lg mb-4">Services</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/chat" className="hover:text-blue-400 transition-colors">
                  AI Tax Assistant
                </Link>
              </li>
              <li>
                <Link to="/calculators" className="hover:text-blue-400 transition-colors">
                  Tax Calculator
                </Link>
              </li>
              <li>
                <Link to="/#ai-chat" className="hover:text-blue-400 transition-colors">
                  DTAA Guidance
                </Link>
              </li>
              <li>
                <Link to="/#ai-chat" className="hover:text-blue-400 transition-colors">
                  Tax Planning
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white text-lg mb-4">Contact</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="size-4" />
                <a href="mailto:support@nritax.ai" className="hover:text-blue-400 transition-colors">
                  support@nritax.ai
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-4" />
                <a href="tel:1800674829" className="hover:text-blue-400 transition-colors">
                  1800-NRI-TAX
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="size-4 mt-0.5" />
                <span>Mumbai, India</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-sm text-center">
          <p>&copy; {new Date().getFullYear()} NRITAX.AI. All rights reserved.</p>
          <p className="mt-2 text-xs text-gray-500">
            Guided by Associate/Fellow Members of ICAI | DTAA Compliant | SOC 2 Standards
          </p>
        </div>
      </div>
    </footer>
  );
}
